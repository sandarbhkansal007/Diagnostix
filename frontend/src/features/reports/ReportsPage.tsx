import { FileText } from "lucide-react";
import { Link } from "react-router";
import { APP_ROUTES } from "../../app/routePaths";

export function ReportsPage() {
  return (
    <div className="catalogue-page">
      <header className="catalogue-header">
        <div>
          <p className="catalogue-header__eyebrow">REPORTS</p>
          <h1>Reports</h1>
        </div>
      </header>

      <div className="catalogue-empty" aria-live="polite">
        <FileText size={28} aria-hidden="true" />
        <h2>No reports yet</h2>
        <p>Reports and result summaries will appear here when the backend is ready.</p>
        <Link className="catalogue-card__link" to={APP_ROUTES.dashboard}>Back to dashboard</Link>
      </div>
    </div>
  );
}
