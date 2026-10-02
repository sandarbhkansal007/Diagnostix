import { CalendarClock, CreditCard, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { APP_ROUTES } from "../../app/routePaths";
import { ApiError } from "../../lib/apiError";
import { fetchCentreById, fetchCentreTests } from "../centres/centreService";
import type { DiagnosticCentre } from "../dashboard/types";
import { createBooking } from "./bookingsService";

interface OfferSelection {
  readonly id: number;
  readonly test_id: number;
  readonly test_name: string;
  readonly description: string | null;
  readonly price: string;
}

function formatAmount(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function BookingCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const centreId = Number(searchParams.get("centreId") ?? "");
  const testId = Number(searchParams.get("testId") ?? "");

  const [centre, setCentre] = useState<DiagnosticCentre | null>(null);
  const [offer, setOffer] = useState<OfferSelection | null>(null);
  const [appointment, setAppointment] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadSelection() {
      if (!Number.isFinite(centreId) || centreId <= 0 || !Number.isFinite(testId) || testId <= 0) {
        setErrorMessage("This booking cannot be created from the current selection.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [nextCentre, nextOffers] = await Promise.all([
          fetchCentreById(centreId),
          fetchCentreTests(centreId),
        ]);
        const selectedOffer = nextOffers.find((item) => item.test_id === testId) ?? null;
        if (!selectedOffer) {
          setErrorMessage("This test is not available at the selected centre.");
          setCentre(nextCentre);
          setOffer(null);
          setIsLoading(false);
          return;
        }

        setCentre(nextCentre);
        setOffer(selectedOffer);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setErrorMessage("This centre or test selection could not be found.");
        } else if (error instanceof ApiError) {
          setErrorMessage("We couldn’t load this booking selection. Please try again.");
        } else if (error instanceof TypeError) {
          setErrorMessage("This booking selection is temporarily unavailable. Please try again.");
        } else {
          setErrorMessage("We couldn’t load this booking selection. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadSelection();
  }, [centreId, testId]);

  const minimumDateTime = useMemo(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 30);
    return date.toISOString().slice(0, 16);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!centre || !offer || !appointment) {
      setErrorMessage("Choose a future appointment time before continuing.");
      return;
    }

    const selectedDate = new Date(appointment);
    if (Number.isNaN(selectedDate.getTime()) || selectedDate <= new Date()) {
      setErrorMessage("Please choose a future appointment date and time.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const createdBooking = await createBooking({
        centre_test_id: offer.id,
        appointment_datetime: selectedDate.toISOString(),
      });
      navigate(`/app/bookings/${createdBooking.id}/payment`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage("We couldn’t confirm this booking. Please review the appointment and try again.");
      } else {
        setErrorMessage("We couldn’t confirm this booking. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="catalogue-page">
        <div className="catalogue-state catalogue-state--loading" role="status" aria-label="Loading booking details">
          <LoaderCircle size={18} aria-hidden="true" />
          <span>Preparing your booking…</span>
        </div>
      </div>
    );
  }

  if (errorMessage || !centre || !offer) {
    return (
      <div className="catalogue-page">
        <div className="catalogue-state catalogue-state--error" role="alert">
          <p>{errorMessage ?? "This booking cannot be created from the current selection."}</p>
          <Link to={APP_ROUTES.centres}>Back to centres</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="catalogue-page">
      <header className="catalogue-header catalogue-header--detail">
        <div>
          <Link className="catalogue-back" to={APP_ROUTES.centres}>
            Back to centres
          </Link>
          <p className="catalogue-header__eyebrow">BOOKING</p>
          <h1>Confirm appointment</h1>
        </div>
      </header>

      <section className="catalogue-detail-summary">
        <div className="catalogue-card__top">
          <span className="catalogue-card__tag">Booking summary</span>
          <CalendarClock size={18} aria-hidden="true" />
        </div>
        <div className="booking-detail-grid">
          <div>
            <span className="settings-item__label">Centre</span>
            <strong>{centre.name}</strong>
          </div>
          <div>
            <span className="settings-item__label">Location</span>
            <strong>{centre.location}</strong>
          </div>
          <div>
            <span className="settings-item__label">Test</span>
            <strong>{offer.test_name}</strong>
          </div>
          <div>
            <span className="settings-item__label">Price</span>
            <strong>{formatAmount(offer.price)}</strong>
          </div>
        </div>
      </section>

      <section className="catalogue-section">
        <h2>Select appointment</h2>
        <form className="booking-form" onSubmit={handleSubmit}>
          <label className="booking-form__field">
            <span>Appointment time</span>
            <input
              type="datetime-local"
              min={minimumDateTime}
              value={appointment}
              onChange={(event) => setAppointment(event.target.value)}
            />
          </label>

          {errorMessage && (
            <div className="catalogue-state catalogue-state--error" role="alert">
              <p>{errorMessage}</p>
            </div>
          )}

          <button className="settings-logout" type="submit" disabled={isSubmitting}>
            <CreditCard size={16} aria-hidden="true" />
            {isSubmitting ? "Confirming…" : "Confirm booking"}
          </button>
        </form>
      </section>
    </div>
  );
}
