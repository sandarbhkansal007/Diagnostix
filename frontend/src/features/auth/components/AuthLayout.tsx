import { Activity } from "lucide-react";
import type { ReactNode } from "react";
import clinicalLabImage from "../../../assets/clinical-lab.jpg";

export function AuthLayout({ children }: { readonly children: ReactNode }) {
  return (
    <main className="auth-page" style={{ backgroundImage: `url(${clinicalLabImage})` }}>
      <div className="auth-page__overlay" aria-hidden="true" />
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="auth-brand__mark">
            <Activity size={19} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span>DIAGNOSTIX</span>
        </div>
        {children}
      </section>
      <p className="auth-page__caption">Trusted diagnostic care, made clear.</p>
    </main>
  );
}