import Link from "next/link";
import { PasswordSetupForm } from "@/components/password-setup-form";

export const metadata = {
  title: "Set your password",
  robots: { index: false, follow: false },
};

export default function AccountSetupPage() {
  return (
    <div className="page-shell">
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Workline home">
          Workline
        </Link>
      </header>
      <main className="login-wrap">
        <section className="login-panel" aria-labelledby="password-title">
          <p className="eyebrow">Finish your invitation</p>
          <h1 id="password-title">Choose your password.</h1>
          <p>
            Set a password to finish joining the workspace. Use at least 12
            characters.
          </p>
          <PasswordSetupForm />
        </section>
      </main>
    </div>
  );
}
