import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  FlaskConical,
  LoaderCircle,
  MapPin,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";
import { APP_ROUTES } from "../../app/routePaths";
import { useAuth } from "../auth/hooks/useAuth";
import { formatAmount, formatAppointmentDateTime, getGreeting, getUpcomingBookings } from "./dashboardData";
import { useDashboardData, type DashboardResourceState } from "./hooks/useDashboardData";
import type { BookingStatus, DiagnosticCentre, DiagnosticTest } from "./types";

const bookingStatusLabels: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly icon: typeof CalendarDays;
}) {
  return (
    <div className="dashboard-metric">
      <div className="dashboard-metric__top">
        <dt>{label}</dt>
        <span className="dashboard-metric__icon">
          <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <dd>{value}</dd>
    </div>
  );
}

function SectionLoading({ label }: { readonly label: string }) {
  return (
    <div className="dashboard-loading" role="status" aria-label={`Loading ${label}`}>
      <LoaderCircle size={18} aria-hidden="true" />
      <span>Loading {label.toLowerCase()}…</span>
    </div>
  );
}

function SectionError({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <div className="dashboard-error" role="alert">
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function BookingStatusBadge({ status }: { readonly status: BookingStatus }) {
  return <span className={`booking-status booking-status--${status.toLowerCase()}`}>{bookingStatusLabels[status]}</span>;
}

function AppointmentList({ bookings }: { readonly bookings: ReturnType<typeof getUpcomingBookings> }) {
  if (bookings.length === 0) {
    return (
      <div className="dashboard-empty">
        <CalendarClock size={23} strokeWidth={1.7} aria-hidden="true" />
        <h3>No upcoming appointments</h3>
        <p>Book a diagnostic test when you’re ready.</p>
        <Link to={APP_ROUTES.tests}>
          Browse tests <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <ul className="dashboard-booking-list">
      {bookings.slice(0, 4).map((booking) => {
        const appointment = formatAppointmentDateTime(booking.appointment_datetime);

        return (
          <li className="dashboard-booking" key={booking.id}>
            <div className="dashboard-booking__main">
              <div className="dashboard-booking__reference">
                <span>Booking #{booking.id}</span>
                <BookingStatusBadge status={booking.status} />
              </div>
              <time className="dashboard-booking__date" dateTime={booking.appointment_datetime}>
                <span>{appointment.date}</span>
                {appointment.time && <span>{appointment.time}</span>}
              </time>
            </div>
            <div className="dashboard-booking__detail">
              <span>Offering reference #{booking.centre_test_id}</span>
              <span>Amount {formatAmount(booking.amount)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ResourceLoadingOrError<T>({
  resource,
  label,
  onRetry,
  children,
}: {
  readonly resource: DashboardResourceState<T>;
  readonly label: string;
  readonly onRetry: () => void;
  readonly children: (data: T) => React.ReactNode;
}) {
  if (resource.status === "loading") {
    return <SectionLoading label={label} />;
  }
  if (resource.status === "error") {
    return <SectionError message={resource.message} onRetry={onRetry} />;
  }
  return children(resource.data);
}

function TestPreview({ tests }: { readonly tests: readonly DiagnosticTest[] }) {
  if (tests.length === 0) {
    return <p className="dashboard-empty-copy">No diagnostic tests are available yet.</p>;
  }

  return (
    <ul className="dashboard-catalogue-list">
      {tests.slice(0, 4).map((test) => (
        <li key={test.id}>
          <span className="dashboard-catalogue-list__icon">
            <FlaskConical size={17} aria-hidden="true" />
          </span>
          <div>
            <h3>{test.name}</h3>
            {test.description && <p>{test.description}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function CentrePreview({ centres }: { readonly centres: readonly DiagnosticCentre[] }) {
  if (centres.length === 0) {
    return <p className="dashboard-empty-copy">No diagnostic centres are available yet.</p>;
  }

  return (
    <ul className="dashboard-catalogue-list">
      {centres.slice(0, 3).map((centre) => (
        <li key={centre.id}>
          <span className="dashboard-catalogue-list__icon">
            <MapPin size={17} aria-hidden="true" />
          </span>
          <div>
            <h3>{centre.name}</h3>
            <p>{centre.location}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { bookings, tests, centres } = useDashboardData();
  const upcomingBookings =
    bookings.state.status === "success" ? getUpcomingBookings(bookings.state.data) : [];

  const upcomingCount = bookings.state.status === "success" ? upcomingBookings.length : "—";
  const bookingCount = bookings.state.status === "success" ? bookings.state.data.length : "—";
  const testCount = tests.state.status === "success" ? tests.state.data.length : "—";
  const centreCount = centres.state.status === "success" ? centres.state.data.length : "—";

  return (
    <div className="dashboard-page">
      <section className="dashboard-greeting" aria-labelledby="dashboard-title">
        <div>
          <p className="dashboard-greeting__eyebrow">YOUR HEALTH OVERVIEW</p>
          <h1 id="dashboard-title">{getGreeting(new Date())}</h1>
          <p>Manage your diagnostic journey from one place.</p>
        </div>
        <p className="dashboard-greeting__identity">
          <UserRound size={17} aria-hidden="true" />
          <span>{user?.email}</span>
        </p>
      </section>

      <section aria-labelledby="dashboard-summary-title">
        <h2 className="visually-hidden" id="dashboard-summary-title">
          At a glance
        </h2>
        <dl className="dashboard-metrics">
          <MetricCard label="Upcoming appointments" value={upcomingCount} icon={CalendarClock} />
          <MetricCard label="Total bookings" value={bookingCount} icon={CalendarDays} />
          <MetricCard label="Available tests" value={testCount} icon={FlaskConical} />
          <MetricCard label="Diagnostic centres" value={centreCount} icon={MapPin} />
        </dl>
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-panel" aria-labelledby="dashboard-appointments-title">
          <div className="dashboard-panel__heading">
            <div>
              <p className="dashboard-panel__eyebrow">YOUR BOOKINGS</p>
              <h2 id="dashboard-appointments-title">Upcoming appointments</h2>
            </div>
            <Link className="dashboard-text-link" to={APP_ROUTES.bookings}>
              View bookings <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <ResourceLoadingOrError
            resource={bookings.state}
            label="upcoming appointments"
            onRetry={bookings.retry}
          >
            {(data) => <AppointmentList bookings={getUpcomingBookings(data)} />}
          </ResourceLoadingOrError>
        </section>

        <div className="dashboard-aside">
          <section className="dashboard-quick-actions" aria-labelledby="dashboard-actions-title">
            <p className="dashboard-panel__eyebrow">GET STARTED</p>
            <h2 id="dashboard-actions-title">Quick actions</h2>
            <div className="dashboard-actions">
              <Link to={APP_ROUTES.tests}>
                <FlaskConical size={17} aria-hidden="true" />
                <span>Browse tests</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link to={APP_ROUTES.centres}>
                <MapPin size={17} aria-hidden="true" />
                <span>Find centres</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link to={APP_ROUTES.bookings}>
                <CalendarDays size={17} aria-hidden="true" />
                <span>View bookings</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section className="dashboard-panel dashboard-panel--compact" aria-labelledby="dashboard-tests-title">
            <div className="dashboard-panel__heading">
              <div>
                <p className="dashboard-panel__eyebrow">DIAGNOSTIC OPTIONS</p>
                <h2 id="dashboard-tests-title">Available tests</h2>
              </div>
              <Link className="dashboard-icon-link" to={APP_ROUTES.tests} aria-label="View all tests">
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <ResourceLoadingOrError
              resource={tests.state}
              label="diagnostic tests"
              onRetry={tests.retry}
            >
              {(data) => <TestPreview tests={data} />}
            </ResourceLoadingOrError>
          </section>

          <section className="dashboard-panel dashboard-panel--compact" aria-labelledby="dashboard-centres-title">
            <div className="dashboard-panel__heading">
              <div>
                <p className="dashboard-panel__eyebrow">CARE LOCATIONS</p>
                <h2 id="dashboard-centres-title">Diagnostic centres</h2>
              </div>
              <Link className="dashboard-icon-link" to={APP_ROUTES.centres} aria-label="View all centres">
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <ResourceLoadingOrError
              resource={centres.state}
              label="diagnostic centres"
              onRetry={centres.retry}
            >
              {(data) => <CentrePreview centres={data} />}
            </ResourceLoadingOrError>
          </section>
        </div>
      </div>
    </div>
  );
}