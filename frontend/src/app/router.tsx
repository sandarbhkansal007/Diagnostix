import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { AppLayout } from "../components/layout/AppLayout";
import { AuthProvider } from "../features/auth/AuthProvider";
import { AuthLoading } from "../features/auth/components/AuthLoading";
import { useAuth } from "../features/auth/hooks/useAuth";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { SignupPage } from "../features/auth/pages/SignupPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { BookingCreatePage } from "../features/bookings/BookingCreatePage";
import { BookingDetailPage } from "../features/bookings/BookingDetailPage";
import { BookingsPage } from "../features/bookings/BookingsPage";
import { CentreDetailPage } from "../features/centres/CentreDetailPage";
import { CentresPage } from "../features/centres/CentresPage";
import { PaymentPage } from "../features/payments/PaymentPage";
import { ReportsPage } from "../features/reports/ReportsPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { TestsPage } from "../features/tests/TestsPage";
import { APP_ROUTES } from "./routePaths";

function GuestOnlyRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoading />;
  }

  return user ? <Navigate to={APP_ROUTES.dashboard} replace /> : <Outlet />;
}

function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoading />;
  }

  if (!user) {
    return <Navigate to={APP_ROUTES.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function HomeRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoading />;
  }

  return <Navigate to={user ? APP_ROUTES.dashboard : APP_ROUTES.login} replace />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<GuestOnlyRoute />}>
            <Route path={APP_ROUTES.login} element={<LoginPage />} />
            <Route path={APP_ROUTES.signup} element={<SignupPage />} />
          </Route>
          <Route path={APP_ROUTES.app} element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="tests" element={<TestsPage />} />
              <Route path="centres" element={<CentresPage />} />
              <Route path="centres/:centreId" element={<CentreDetailPage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="bookings/new" element={<BookingCreatePage />} />
              <Route path="bookings/:bookingId" element={<BookingDetailPage />} />
              <Route path="bookings/:bookingId/payment" element={<PaymentPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to={APP_ROUTES.dashboard} replace />} />
            </Route>
          </Route>
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}