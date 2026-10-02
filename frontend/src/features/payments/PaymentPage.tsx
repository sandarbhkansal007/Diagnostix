import { CheckCircle2, CreditCard, LoaderCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { APP_ROUTES } from "../../app/routePaths";
import { ApiError } from "../../lib/apiError";
import { fetchBookingById } from "../bookings/bookingsService";
import { createPayment } from "./paymentService";

interface PaymentSummary {
  readonly bookingId: number;
  readonly amount: string;
  readonly appointment: string;
  readonly status: string;
}

export function PaymentPage() {
  const { bookingId } = useParams();
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<"success" | "failure" | null>(null);

  useEffect(() => {
    async function loadSummary() {
      const numericId = Number(bookingId);
      if (!Number.isInteger(numericId)) {
        setErrorMessage("This payment could not be found.");
        setIsLoading(false);
        return;
      }

      try {
        const booking = await fetchBookingById(numericId);
        setSummary({
          bookingId: booking.id,
          amount: booking.amount,
          appointment: booking.appointment_datetime,
          status: booking.status,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setErrorMessage("This booking could not be found.");
        } else if (error instanceof ApiError) {
          setErrorMessage("This payment summary could not be loaded. Please try again.");
        } else {
          setErrorMessage("This payment summary could not be loaded. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadSummary();
  }, [bookingId]);

  async function handlePayment(outcome: "SUCCESS" | "FAILED") {
    if (!summary) {
      return;
    }

    setPaying(true);
    setPaymentError(null);

    try {
      await createPayment({ booking_id: summary.bookingId, simulation_outcome: outcome });
      setPaymentResult(outcome === "SUCCESS" ? "success" : "failure");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setPaymentError("This booking cannot be paid in its current state.");
      } else {
        setPaymentError("The payment could not be completed. Please try again.");
      }
    } finally {
      setPaying(false);
    }
  }

  if (isLoading) {
    return (
      <div className="catalogue-page">
        <div className="catalogue-state catalogue-state--loading" role="status" aria-label="Loading payment summary">
          <LoaderCircle size={18} aria-hidden="true" />
          <span>Loading payment summary…</span>
        </div>
      </div>
    );
  }

  if (errorMessage || !summary) {
    return (
      <div className="catalogue-page">
        <div className="catalogue-state catalogue-state--error" role="alert">
          <p>{errorMessage ?? "This payment could not be loaded."}</p>
          <Link to={APP_ROUTES.bookings}>Back to bookings</Link>
        </div>
      </div>
    );
  }

  if (paymentResult === "success") {
    return (
      <div className="catalogue-page">
        <div className="catalogue-empty">
          <CheckCircle2 size={32} aria-hidden="true" />
          <h2>Payment successful</h2>
          <p>Your payment has been processed.</p>
          <div className="payment-actions">
            <Link className="catalogue-card__link" to={`/app/bookings/${summary.bookingId}`}>
              View booking
            </Link>
            <Link className="catalogue-card__link" to={APP_ROUTES.dashboard}>
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (paymentResult === "failure") {
    return (
      <div className="catalogue-page">
        <div className="catalogue-empty">
          <XCircle size={32} aria-hidden="true" />
          <h2>Payment could not be completed</h2>
          <p>We could not process this payment.</p>
          <div className="payment-actions">
            <button className="settings-logout" type="button" onClick={() => void handlePayment("SUCCESS")}>
              Try again
            </button>
            <Link className="catalogue-card__link" to={`/app/bookings/${summary.bookingId}`}>
              View booking
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="catalogue-page">
      <header className="catalogue-header">
        <div>
          <p className="catalogue-header__eyebrow">PAYMENT</p>
          <h1>Complete payment</h1>
        </div>
      </header>

      <section className="catalogue-detail-summary">
        <div className="catalogue-card__top">
          <span className="catalogue-card__tag">Payment summary</span>
          <CreditCard size={18} aria-hidden="true" />
        </div>
        <div className="booking-detail-grid">
          <div>
            <span className="settings-item__label">Booking</span>
            <strong>#{summary.bookingId}</strong>
          </div>
          <div>
            <span className="settings-item__label">Amount</span>
            <strong>{summary.amount}</strong>
          </div>
          <div>
            <span className="settings-item__label">Appointment</span>
            <strong>{new Date(summary.appointment).toLocaleString()}</strong>
          </div>
          <div>
            <span className="settings-item__label">Status</span>
            <strong>{summary.status}</strong>
          </div>
        </div>
      </section>

      {paymentError && (
        <div className="catalogue-state catalogue-state--error" role="alert">
          <p>{paymentError}</p>
        </div>
      )}

      <div className="payment-actions">
        <button className="settings-logout" type="button" onClick={() => void handlePayment("SUCCESS")} disabled={paying}>
          {paying ? "Processing…" : "Pay now"}
        </button>
        <button className="settings-logout settings-logout--danger" type="button" onClick={() => void handlePayment("FAILED")} disabled={paying}>
          Simulate failure
        </button>
      </div>
    </div>
  );
}
