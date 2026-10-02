import { LoaderCircle, MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ApiError } from "../../lib/apiError";
import type { DiagnosticCentre } from "../dashboard/types";
import { fetchCentres } from "./centreService";

function SearchControl({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="catalogue-search">
      <span className="catalogue-search__label">Search centres</span>
      <div className="catalogue-search__field">
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="Search centres"
          placeholder="Search by centre name or location"
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

export function CentresPage() {
  const [query, setQuery] = useState("");
  const [centres, setCentres] = useState<DiagnosticCentre[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadCentres() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextCentres = await fetchCentres();
      setCentres(nextCentres);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage("We couldn’t load the centres list right now. Please try again.");
      } else if (error instanceof TypeError) {
        setErrorMessage("The centres list is temporarily unavailable. Please try again.");
      } else {
        setErrorMessage("We couldn’t load the centres list right now. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCentres();
  }, []);

  const filteredCentres = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return centres;
    }

    return centres.filter((centre) => {
      const haystack = `${centre.name} ${centre.location}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [centres, query]);

  return (
    <div className="catalogue-page">
      <header className="catalogue-header">
        <div>
          <p className="catalogue-header__eyebrow">CARE LOCATIONS</p>
          <h1>Diagnostic Centres</h1>
        </div>
        {!isLoading && !errorMessage && (
          <p className="catalogue-header__meta">
            {filteredCentres.length} result{filteredCentres.length === 1 ? "" : "s"}
          </p>
        )}
      </header>

      <div className="catalogue-toolbar">
        <SearchControl value={query} onChange={setQuery} />
      </div>

      {isLoading && (
        <div className="catalogue-state catalogue-state--loading" role="status" aria-label="Loading centres">
          <LoaderCircle size={18} aria-hidden="true" />
          <span>Loading centres…</span>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="catalogue-state catalogue-state--error" role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={() => void loadCentres()}>
            Try again
          </button>
        </div>
      )}

      {!isLoading && !errorMessage && filteredCentres.length === 0 && (
        <div className="catalogue-empty" aria-live="polite">
          <MapPin size={28} aria-hidden="true" />
          <h2>No diagnostic centres available</h2>
          <p>Adjust your search or check back later.</p>
        </div>
      )}

      {!isLoading && !errorMessage && filteredCentres.length > 0 && (
        <div className="catalogue-grid">
          {filteredCentres.map((centre) => (
            <article className="catalogue-card" key={centre.id}>
              <div className="catalogue-card__top">
                <span className="catalogue-card__tag">Centre</span>
                <MapPin size={18} aria-hidden="true" />
              </div>
              <h2>{centre.name}</h2>
              <p className="catalogue-card__meta">{centre.location}</p>
              <Link className="catalogue-card__link" to={`/app/centres/${centre.id}`}>
                View centre details
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
