import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Staff Sign In | Workline",
  description: "Sign in to the Workline operational review workspace.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="page-shell">
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Workline home">
          Workline
        </Link>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <Link className="text-link" href="/demo">
            Interactive demo
          </Link>
          <Link className="text-link" href="/">
            Overview
          </Link>
        </div>
      </header>
      <main className="login-wrap">
        <section className="login-panel" aria-labelledby="login-title">
          <p className="eyebrow">Workline Operations Workbench</p>
          <h1 id="login-title">Sign in to review cases.</h1>
          <p className="login-subtitle">
            Enter with a verified operational staff persona or sign in with your corporate email.
          </p>
          <LoginForm />
        </section>
      </main>
    </div>
  );
}
