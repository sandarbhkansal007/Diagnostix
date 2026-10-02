import { CalendarClock, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ApiError } from "../../lib/apiError";
import { fetchBookings, type Booking } from "./bookingsService";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatAmount(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
}

function SearchControl({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="catalogue-search">
      <span className="catalogue-search__label">Search bookings</span>
      <div className="catalogue-search__field">
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="Search bookings"
          placeholder="Search by ID or status"
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

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadBookings() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextBookings = await fetchBookings();
      setBookings(nextBookings);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage("We couldn’t load your bookings. Please try again.");
      } else if (error instanceof TypeError) {
        setErrorMessage("Your bookings are temporarily unavailable. Please try again.");
      } else {
        setErrorMessage("We couldn’t load your bookings. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadBookings();
  }, []);

  const filteredBookings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return bookings;
    }

    return bookings.filter((booking) => {
      const haystack = `${booking.id} ${booking.status} ${booking.centre_test_id}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [bookings, query]);

  return (
    <div className="catalogue-page">
      <header className="catalogue-header">
        <div>
          <p className="catalogue-header__eyebrow">MY BOOKINGS</p>
          <h1>Bookings</h1>
        </div>
        {!isLoading && !errorMessage && (
          <p className="catalogue-header__meta">
            {filteredBookings.length} result{filteredBookings.length === 1 ? "" : "s"}
          </p>
        )}
      </header>

      <div className="catalogue-toolbar">
        <SearchControl value={query} onChange={setQuery} />
      </div>

      {isLoading && (
        <div className="catalogue-state catalogue-state--loading" role="status" aria-label="Loading bookings">
          <LoaderCircle size={18} aria-hidden="true" />
          <span>Loading bookings…</span>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="catalogue-state catalogue-state--error" role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={() => void loadBookings()}>
            Try again
          </button>
        </div>
      )}

      {!isLoading && !errorMessage && filteredBookings.length === 0 && (
        <div className="catalogue-empty" aria-live="polite">
          <CalendarClock size={28} aria-hidden="true" />
          <h2>No bookings yet</h2>
          <p>Your upcoming and past bookings will appear here.</p>
        </div>
      )}

      {!isLoading && !errorMessage && filteredBookings.length > 0 && (
        <div className="catalogue-grid">
          {filteredBookings.map((booking) => (
            <article className="catalogue-card" key={booking.id}>
              <div className="catalogue-card__top">
                <span className="catalogue-card__tag">Booking #{booking.id}</span>
                <span className={`booking-status booking-status--${booking.status.toLowerCase()}`}>
                  {booking.status}
                </span>
              </div>
              <h2>{formatDateTime(booking.appointment_datetime)}</h2>
              <p className="catalogue-card__meta">Centre test ID: {booking.centre_test_id}</p>
              <p className="catalogue-card__meta">Amount: {formatAmount(booking.amount)}</p>
              <Link className="catalogue-card__link" to={`/app/bookings/${booking.id}`}>
                View details
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
