import { ArrowLeft, CalendarDays, LoaderCircle, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { APP_ROUTES } from "../../app/routePaths";
import { ApiError } from "../../lib/apiError";
import { cancelBooking, fetchBookingById, type Booking } from "./bookingsService";

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

export function BookingDetailPage() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    const numericId = Number(bookingId);
    if (!Number.isInteger(numericId)) {
      setErrorMessage("This booking could not be found.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setCancelError(null);

    try {
      const nextBooking = await fetchBookingById(numericId);
      setBooking(nextBooking);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setErrorMessage("This booking could not be found.");
      } else if (error instanceof ApiError) {
        setErrorMessage("We couldn’t load this booking right now. Please try again.");
      } else if (error instanceof TypeError) {
        setErrorMessage("This booking is temporarily unavailable. Please try again.");
      } else {
        setErrorMessage("We couldn’t load this booking right now. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  async function handleCancel() {
    if (!booking) {
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      const updatedBooking = await cancelBooking(booking.id);
      setBooking(updatedBooking);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setCancelError("This booking cannot be cancelled from its current state.");
      } else if (error instanceof ApiError) {
        setCancelError("The cancellation request could not be completed. Please try again.");
      } else {
        setCancelError("The cancellation request could not be completed. Please try again.");
      }
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="catalogue-page">
        <div className="catalogue-state catalogue-state--loading" role="status" aria-label="Loading booking details">
          <LoaderCircle size={18} aria-hidden="true" />
          <span>Loading booking details…</span>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="catalogue-page">
        <div className="catalogue-state catalogue-state--error" role="alert">
          <p>{errorMessage}</p>
          <Link to={APP_ROUTES.bookings}>Back to bookings</Link>
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  return (
    <div className="catalogue-page">
      <header className="catalogue-header catalogue-header--detail">
        <div>
          <Link className="catalogue-back" to={APP_ROUTES.bookings}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to bookings
          </Link>
          <p className="catalogue-header__eyebrow">BOOKING</p>
          <h1>Booking #{booking.id}</h1>
        </div>
      </header>

      <section className="catalogue-detail-summary">
        <div className="catalogue-card__top">
          <span className="catalogue-card__tag">Status</span>
          <CalendarDays size={18} aria-hidden="true" />
        </div>
        <div className="booking-detail-grid">
          <div>
            <span className="settings-item__label">Status</span>
            <strong>{booking.status}</strong>
          </div>
          <div>
            <span className="settings-item__label">Appointment</span>
            <strong>{formatDateTime(booking.appointment_datetime)}</strong>
          </div>
          <div>
            <span className="settings-item__label">Centre test ID</span>
            <strong>{booking.centre_test_id}</strong>
          </div>
          <div>
            <span className="settings-item__label">Amount</span>
            <strong>{formatAmount(booking.amount)}</strong>
          </div>
        </div>
      </section>

      {booking.status === "PENDING" && (
        <section className="catalogue-section">
          <h2>Actions</h2>
          {cancelError && (
            <div className="catalogue-state catalogue-state--error" role="alert">
              <p>{cancelError}</p>
            </div>
          )}
          <button className="settings-logout settings-logout--danger" type="button" onClick={handleCancel} disabled={isCancelling}>
            <XCircle size={16} aria-hidden="true" />
            {isCancelling ? "Cancelling…" : "Cancel booking"}
          </button>
        </section>
      )}
    </div>
  );
}
