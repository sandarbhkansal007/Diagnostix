import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router";
import { AssistantLauncher } from "./AssistantLauncher";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);
  const wasMobileNavOpen = useRef(false);

  useEffect(() => {
    if (!isMobileNavOpen) {
      if (wasMobileNavOpen.current) {
        menuButtonRef.current?.focus();
        wasMobileNavOpen.current = false;
      }
      return;
    }

    wasMobileNavOpen.current = true;
    mobileNavigationRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
        return;
      }

      if (event.key === "Tab") {
        const focusableItems = Array.from(
          mobileNavigationRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled])',
          ) ?? [],
        ).filter((item) => item.tabIndex >= 0);
        const firstItem = focusableItems[0];
        const lastItem = focusableItems.at(-1);

        if (event.shiftKey && document.activeElement === firstItem) {
          event.preventDefault();
          lastItem?.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          firstItem?.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileNavOpen]);

  function closeMobileNavigation() {
    setIsMobileNavOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar app-sidebar--desktop" aria-label="Application sidebar">
        <Sidebar />
      </aside>

      {isMobileNavOpen && (
        <div
          className="app-mobile-drawer"
          id="mobile-navigation"
          ref={mobileNavigationRef}
          role="dialog"
          aria-label="Mobile navigation"
          aria-modal="true"
        >
          <button
            className="app-mobile-drawer__scrim"
            type="button"
            aria-label="Dismiss navigation"
            onClick={closeMobileNavigation}
          />
          <aside
            className="app-sidebar app-sidebar--mobile"
            aria-label="Application sidebar"
          >
            <Sidebar
              mobile
              onClose={closeMobileNavigation}
              onNavigate={closeMobileNavigation}
            />
          </aside>
        </div>
      )}

      <div className="app-shell__main" inert={isMobileNavOpen}>
        <header className="app-topbar">
          <button
            className="app-icon-button app-topbar__menu"
            type="button"
            aria-label="Open navigation"
            aria-controls="mobile-navigation"
            aria-expanded={isMobileNavOpen}
            onClick={() => setIsMobileNavOpen(true)}
            ref={menuButtonRef}
          >
            <Menu size={21} aria-hidden="true" />
          </button>
          <p className="app-topbar__context">Patient workspace</p>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      {!isMobileNavOpen && <AssistantLauncher />}
    </div>
  );
}