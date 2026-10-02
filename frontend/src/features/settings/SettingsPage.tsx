import { Lock, LogOut, Mail, User } from "lucide-react";
import { useAuth } from "../auth/hooks/useAuth";

export function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="catalogue-page">
      <header className="catalogue-header">
        <div>
          <p className="catalogue-header__eyebrow">PROFILE</p>
          <h1>Settings</h1>
        </div>
      </header>

      <section className="catalogue-detail-summary">
        <div className="catalogue-card__top">
          <span className="catalogue-card__tag">Account</span>
          <User size={18} aria-hidden="true" />
        </div>
        <div className="settings-list">
          <div className="settings-item">
            <Mail size={16} aria-hidden="true" />
            <div>
              <span className="settings-item__label">Email</span>
              <strong>{user?.email ?? "Not available"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="catalogue-section">
        <h2>Security</h2>
        <div className="settings-list">
          <div className="settings-item settings-item--muted">
            <Lock size={16} aria-hidden="true" />
            <div>
              <span className="settings-item__label">Change password</span>
              <strong>Coming in Phase 7</strong>
            </div>
          </div>
          <button className="settings-logout" type="button" onClick={logout}>
            <LogOut size={16} aria-hidden="true" />
            Log out
          </button>
        </div>
      </section>
    </div>
  );
}
