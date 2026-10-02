import { FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { APP_ROUTES } from "../../app/routePaths";
import { ApiError } from "../../lib/apiError";
import { fetchReport, fetchReports, type Report } from "./reportsService";

export function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReports() {
      try {
        const nextReports = await fetchReports();
        setReports(nextReports);
        setSelectedReportId((current) => current ?? nextReports[0]?.id ?? null);
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.status === 401) {
          setError("Your session has expired. Please sign in again.");
        } else {
          setError("Unable to load reports right now. Please try again shortly.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadReports();
  }, []);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId],
  );

  async function handleSelectReport(reportId: number) {
    setSelectedReportId(reportId);
    setDetailError(null);

    try {
      const detail = await fetchReport(reportId);
      setReports((currentReports) => {
        const index = currentReports.findIndex((report) => report.id === reportId);
        if (index === -1) {
          return currentReports;
        }

        const nextReports = [...currentReports];
        nextReports[index] = detail;
        return nextReports;
      });
    } catch {
      setDetailError("Unable to load the selected report right now. Please try again.");
    }
  }

  return (
    <div className="catalogue-page">
      <header className="catalogue-header">
        <div>
          <p className="catalogue-header__eyebrow">REPORTS</p>
          <h1>Reports</h1>
        </div>
      </header>

      {isLoading ? (
        <div className="catalogue-empty" aria-live="polite">
          <p>Loading your reports…</p>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="catalogue-empty" aria-live="polite">
          <FileText size={28} aria-hidden="true" />
          <h2>Unable to load reports</h2>
          <p>{error}</p>
          <Link className="catalogue-card__link" to={APP_ROUTES.dashboard}>Back to dashboard</Link>
        </div>
      ) : null}

      {!isLoading && !error && reports.length === 0 ? (
        <div className="catalogue-empty" aria-live="polite">
          <FileText size={28} aria-hidden="true" />
          <h2>No reports yet</h2>
          <p>Reports and result summaries will appear here when your clinician uploads them.</p>
          <Link className="catalogue-card__link" to={APP_ROUTES.dashboard}>Back to dashboard</Link>
        </div>
      ) : null}

      {!isLoading && !error && reports.length > 0 ? (
        <div className="booking-detail-grid" style={{ alignItems: "start" }}>
          <section className="catalogue-section" aria-label="Reports list">
            <h2>Available reports</h2>
            <ul className="catalogue-offers">
              {reports.map((report) => {
                const label = report.summary || `Report ${report.id}`;
                const statusLabel = String(report.status).toLowerCase();

                return (
                  <li key={report.id}>
                    <button
                      type="button"
                      className="catalogue-offer"
                      style={{ width: "100%", textAlign: "left", background: "transparent", border: 0 }}
                      onClick={() => {
                        void handleSelectReport(report.id);
                      }}
                    >
                      <div>
                        <h3>{label}</h3>
                        <p>{new Date(report.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="catalogue-offer__meta">
                        {statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {selectedReport ? (
            <section className="catalogue-section" aria-live="polite">
              {detailError ? <p role="alert">{detailError}</p> : null}
              <h2>{selectedReport.summary || `Report ${selectedReport.id}`}</h2>
              <div className="settings-list">
                <div className="settings-item">
                  <div>
                    <span className="settings-item__label">Status</span>
                    <strong>
                      {String(selectedReport.status).charAt(0).toUpperCase() +
                        String(selectedReport.status).slice(1).toLowerCase()}
                    </strong>
                  </div>
                </div>
                <div className="settings-item settings-item--muted">
                  <div>
                    <span className="settings-item__label">Summary</span>
                    <strong>{selectedReport.summary || "No summary provided."}</strong>
                  </div>
                </div>
                {selectedReport.findings ? (
                  <div className="settings-item settings-item--muted">
                    <div>
                      <span className="settings-item__label">Findings</span>
                      <strong>{selectedReport.findings}</strong>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
