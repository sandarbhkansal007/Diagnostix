import { FlaskConical, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../lib/apiError";
import type { DiagnosticTest } from "../dashboard/types";
import { fetchTests } from "./testsService";

function SearchControl({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="catalogue-search">
      <span className="catalogue-search__label">Search tests</span>
      <div className="catalogue-search__field">
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="Search tests"
          placeholder="Search by test name or description"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {value && (
          <button type="button" aria-label="Clear search" onClick={() => onChange("")}>
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </label>
  );
}

export function TestsPage() {
  const [query, setQuery] = useState("");
  const [tests, setTests] = useState<DiagnosticTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadTests() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextTests = await fetchTests();
      setTests(nextTests);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage("We couldn’t load the test catalogue right now. Please try again.");
      } else if (error instanceof TypeError) {
        setErrorMessage("The catalogue is temporarily unavailable. Please try again.");
      } else {
        setErrorMessage("We couldn’t load the test catalogue right now. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTests();
  }, []);

  const filteredTests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return tests;
    }

    return tests.filter((test) => {
      const haystack = `${test.name} ${test.description ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, tests]);

  return (
    <div className="catalogue-page">
      <header className="catalogue-header">
        <div>
          <p className="catalogue-header__eyebrow">PATIENT CATALOGUE</p>
          <h1>Tests</h1>
        </div>
        {!isLoading && !errorMessage && (
          <p className="catalogue-header__meta">
            {filteredTests.length} result{filteredTests.length === 1 ? "" : "s"}
          </p>
        )}
      </header>

      <div className="catalogue-toolbar">
        <SearchControl value={query} onChange={setQuery} />
      </div>

      {isLoading && (
        <div className="catalogue-state catalogue-state--loading" role="status" aria-label="Loading tests">
          <LoaderCircle size={18} aria-hidden="true" />
          <span>Loading tests…</span>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="catalogue-state catalogue-state--error" role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={() => void loadTests()}>
            Try again
          </button>
        </div>
      )}

      {!isLoading && !errorMessage && filteredTests.length === 0 && (
        <div className="catalogue-empty" aria-live="polite">
          <FlaskConical size={28} aria-hidden="true" />
          <h2>No diagnostic tests available</h2>
          <p>Adjust your search or check back later.</p>
        </div>
      )}

      {!isLoading && !errorMessage && filteredTests.length > 0 && (
        <div className="catalogue-grid">
          {filteredTests.map((test) => (
            <article className="catalogue-card" key={test.id}>
              <div className="catalogue-card__top">
                <span className="catalogue-card__tag">Test</span>
                <FlaskConical size={18} aria-hidden="true" />
              </div>
              <h2>{test.name}</h2>
              {test.description && <p>{test.description}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
