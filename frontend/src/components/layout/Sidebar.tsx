import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  MapPin,
  Settings,
  X,
} from "lucide-react";
import { NavLink } from "react-router";
import { APP_ROUTES } from "../../app/routePaths";
import { useAuth } from "../../features/auth/hooks/useAuth";

const navigationItems = [
  { label: "Dashboard", path: APP_ROUTES.dashboard, Icon: LayoutDashboard },
  { label: "Tests", path: APP_ROUTES.tests, Icon: FlaskConical },
  { label: "Diagnostic Centres", path: APP_ROUTES.centres, Icon: MapPin },
  { label: "Bookings", path: APP_ROUTES.bookings, Icon: CalendarDays },
  { label: "Reports", path: APP_ROUTES.reports, Icon: ChartNoAxesCombined },
  { label: "Settings", path: APP_ROUTES.settings, Icon: Settings },
];

interface SidebarProps {
  readonly mobile?: boolean;
  readonly onNavigate?: () => void;
  readonly onClose?: () => void;
}

export function Sidebar({ mobile = false, onNavigate, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const initials = user?.email.slice(0, 1).toUpperCase() ?? "D";

  return (
    <div className="app-sidebar__inner">
      <div className="app-sidebar__header">
        <div className="app-brand">
          <span className="app-brand__mark">
            <Activity size={19} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="app-brand__name">DIAGNOSTIX</span>
        </div>
        {mobile && (
          <button
            className="app-icon-button app-sidebar__close"
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X size={19} aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="app-sidebar__eyebrow">PATIENT PORTAL</p>

      <nav className="app-sidebar__nav" aria-label="Primary navigation">
        {navigationItems.map(({ label, path, Icon }) => (
          <NavLink
            className={({ isActive }) =>
              isActive ? "app-nav-link app-nav-link--active" : "app-nav-link"
            }
            end={path === APP_ROUTES.dashboard}
            key={path}
            onClick={onNavigate}
            to={path}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="app-sidebar__account">
        <div className="app-account">
          <span className="app-account__avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="app-account__email" title={user?.email}>
            {user?.email}
          </span>
        </div>
        <button className="app-logout" type="button" onClick={logout}>
          <LogOut size={17} aria-hidden="true" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}