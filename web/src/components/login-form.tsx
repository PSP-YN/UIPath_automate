"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DEMO_PERSONAS, type DemoPersona } from "@/lib/auth/personas";
import type { WorkspaceRole } from "@/lib/database.types";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("reviewer");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [activeTab, setActiveTab] = useState<"persona" | "custom">("persona");

  async function performLogin(targetEmail: string, targetRole: WorkspaceRole, name?: string) {
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, role: targetRole, name }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Sign-in could not be completed.");
        return;
      }
      router.replace("/workspace");
      router.refresh();
    } catch {
      setError("The sign-in service could not be reached. Try again shortly.");
    } finally {
      setPending(false);
    }
  }

  function handlePersonaClick(persona: DemoPersona) {
    performLogin(persona.email, persona.role, persona.name);
  }

  async function handleCustomSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }
    await performLogin(email, role);
  }

  return (
    <div className="login-experience">
      <div className="login-mode-tabs" role="tablist" aria-label="Sign-in options">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "persona"}
          className={`tab-btn ${activeTab === "persona" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("persona")}
        >
          Quick Demo Roles
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "custom"}
          className={`tab-btn ${activeTab === "custom" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("custom")}
        >
          Custom Account
        </button>
      </div>

      {activeTab === "persona" ? (
        <div className="persona-grid" role="region" aria-label="Select demo role">
          <p className="persona-hint">
            Select a verified operational persona to enter the workspace instantly:
          </p>
          <div className="persona-cards">
            {DEMO_PERSONAS.map((persona) => (
              <button
                key={persona.id}
                type="button"
                className="persona-card"
                disabled={pending}
                onClick={() => handlePersonaClick(persona)}
              >
                <div className="persona-header">
                  <div className="persona-avatar" aria-hidden="true">
                    {persona.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div className="persona-meta">
                    <span className="persona-name">{persona.name}</span>
                    <span className="persona-role-badge">{persona.title}</span>
                  </div>
                </div>
                <p className="persona-desc">{persona.description}</p>
                <div className="persona-action">
                  <span>Enter as {persona.title} →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form className="login-form" onSubmit={handleCustomSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              autoComplete="email"
              type="email"
              required
              maxLength={254}
              placeholder="e.g. yourname@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-role">Assigned Workspace Role</label>
            <select
              id="login-role"
              value={role}
              onChange={(event) => setRole(event.target.value as WorkspaceRole)}
            >
              <option value="reviewer">Reviewer (Evaluate & Decide Cases)</option>
              <option value="admin">Operations Admin (Full Management)</option>
              <option value="owner">Workspace Owner (Executive Director)</option>
              <option value="member">Intake Specialist (Submit New Cases)</option>
            </select>
          </div>
          <button className="button button-primary" type="submit" disabled={pending}>
            {pending ? "Entering workspace..." : "Continue to Workspace"}
          </button>
        </form>
      )}

      {error && (
        <p className="form-error" role="alert" style={{ marginTop: "1rem" }}>
          {error}
        </p>
      )}

      <div className="login-footer-notes">
        <span>🔒 Zero third-party telemetry</span>
        <span>•</span>
        <span>⚡ Production self-contained</span>
      </div>
    </div>
  );
}
