import { useEffect, useState } from "react";
import { ApiError } from "../../../lib/apiError";
import {
  fetchBookings,
  fetchDiagnosticCentres,
  fetchDiagnosticTests,
} from "../dashboardService";
import type { Booking, DiagnosticCentre, DiagnosticTest } from "../types";

export type DashboardResourceState<T> =
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly data: T }
  | { readonly status: "error"; readonly message: string };

interface DashboardResource<T> {
  readonly state: DashboardResourceState<T>;
  readonly retry: () => void;
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return "Your session could not be verified. Please sign out and sign in again.";
  }
  if (error instanceof TypeError) {
    return "Unable to connect to Diagnostix. Check your connection and try again.";
  }
  return "This section could not be loaded. Please try again.";
}

function useDashboardResource<T>(request: () => Promise<T>): DashboardResource<T> {
  const [state, setState] = useState<DashboardResourceState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isActive = true;
    setState({ status: "loading" });

    request()
      .then((data) => {
        if (isActive) {
          setState({ status: "success", data });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setState({ status: "error", message: getLoadErrorMessage(error) });
        }
      });

    return () => {
      isActive = false;
    };
  }, [attempt, request]);

  return { state, retry: () => setAttempt((current) => current + 1) };
}

export interface DashboardData {
  readonly bookings: DashboardResource<Booking[]>;
  readonly tests: DashboardResource<DiagnosticTest[]>;
  readonly centres: DashboardResource<DiagnosticCentre[]>;
}

export function useDashboardData(): DashboardData {
  const bookings = useDashboardResource(fetchBookings);
  const tests = useDashboardResource(fetchDiagnosticTests);
  const centres = useDashboardResource(fetchDiagnosticCentres);

  return { bookings, tests, centres };
}