import { Lock, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { APP_ROUTES } from "../../app/routePaths";
import { ApiError, formatApiErrorMessage } from "../../lib/apiError";
import { changePassword, getProfile, updateProfile } from "../auth/authService";
import { useAuth } from "../auth/hooks/useAuth";

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getProfile();
        setEmail(profile.email);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          void logout();
          navigate(APP_ROUTES.login, { replace: true });
        } else {
          setProfileError("Unable to load your profile right now.");
        }
      }
    }

    if (user?.email) {
      setEmail(user.email);
    }

    void loadProfile();
  }, [navigate, logout, user?.id, user?.email]);

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setPasswordSuccess(null);
    setPasswordError(null);
    setIsSavingProfile(true);

    try {
      const updatedUser = await updateProfile({ email: email.trim() });
      setEmail(updatedUser.email);
      setProfileSuccess("Profile updated successfully.");
    } catch (error) {
      setProfileError(formatApiErrorMessage(error, "Unable to update your profile."));
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSuccess(null);
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please complete all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);

    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      setPasswordSuccess("Password updated successfully. You have been signed out.");
      await logout();
      navigate(APP_ROUTES.login, { replace: true });
    } catch (error) {
      setPasswordError(formatApiErrorMessage(error, "Unable to change your password."));
    } finally {
      setIsChangingPassword(false);
    }
  }

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

        <form className="booking-form" onSubmit={handleSaveProfile}>
          <label className="booking-form__field" htmlFor="profile-email">
            Email
            <input
              id="profile-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          {profileError ? <p role="alert">{profileError}</p> : null}
          {profileSuccess ? <p role="status">{profileSuccess}</p> : null}

          <button className="catalogue-card__link" type="submit" disabled={isSavingProfile}>
            {isSavingProfile ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>

      <section className="catalogue-section">
        <h2>Security</h2>
        <form className="booking-form" onSubmit={handlePasswordChange}>
          <label className="booking-form__field" htmlFor="current-password">
            Current password
            <input
              id="current-password"
              name="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>

          <label className="booking-form__field" htmlFor="new-password">
            New password
            <input
              id="new-password"
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>

          <label className="booking-form__field" htmlFor="confirm-password">
            Confirm new password
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>

          {passwordError ? <p role="alert">{passwordError}</p> : null}
          {passwordSuccess ? <p role="status">{passwordSuccess}</p> : null}

          <button className="settings-logout settings-logout--danger" type="submit" disabled={isChangingPassword}>
            <Lock size={16} aria-hidden="true" />
            {isChangingPassword ? "Updating password..." : "Change password"}
          </button>
        </form>

        <div className="settings-list" style={{ marginTop: "1rem" }}>
          <button
            className="settings-logout"
            type="button"
            onClick={() => {
              void logout();
            }}
          >
            <LogOut size={16} aria-hidden="true" />
            Log out
          </button>
        </div>
      </section>
    </div>
  );
}
