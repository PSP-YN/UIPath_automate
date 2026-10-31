"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function PasswordSetupForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    setPending(true);
    try {
      router.replace("/workspace");
      router.refresh();
    } catch {
      setError("Could not update account. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="setup-password">New password</label>
        <input
          id="setup-password"
          autoComplete="new-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="setup-password-confirm">Confirm new password</label>
        <input
          id="setup-password-confirm"
          autoComplete="new-password"
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save password and continue"}
      </button>
    </form>
  );
}
