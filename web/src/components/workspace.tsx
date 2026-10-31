"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { workflows, getWorkflow } from "@/lib/catalog";
import type {
  Json,
  WorkflowRunRow,
  WorkflowStatus,
  WorkspaceRole,
} from "@/lib/database.types";
import { validateWorkflowInput } from "@/lib/workflow-engine";

type WorkspaceSession = {
  email: string;
  name?: string;
  role: WorkspaceRole;
  workspaceName: string;
};

type WorkflowEvent = {
  id: number;
  run_id: string;
  actor_id: string | null;
  actor_email?: string;
  event: "submitted" | "approved" | "rejected" | "retry_started";
  details: Json;
  created_at: string;
};

type StatusFilter = "all" | WorkflowStatus;

const summaryFields: Record<string, string> = {
  "invoice-review": "vendor",
  "support-triage": "subject",
  "purchase-request": "item",
  "expense-reimbursement": "category",
  "employee-onboarding": "employee_name",
  "leave-request": "leave_type",
  "contract-intake": "counterparty",
  "lead-qualification": "company",
  "sales-quote-approval": "customer",
  "it-access-request": "system",
  "inventory-reorder": "item_name",
  "policy-exception": "policy_area",
};

import { getSampleInput } from "@/lib/sample-data";

function getLocalRuns(): WorkflowRunRow[] {
  if (typeof window === "undefined") return [];
  try {
    const data = window.localStorage.getItem("workline_local_runs");
    return data ? (JSON.parse(data) as WorkflowRunRow[]) : [];
  } catch {
    return [];
  }
}

function saveLocalRun(run: WorkflowRunRow) {
  if (typeof window === "undefined") return;
  try {
    const runs = getLocalRuns().filter((r) => r.id !== run.id);
    runs.unshift(run);
    window.localStorage.setItem(
      "workline_local_runs",
      JSON.stringify(runs.slice(0, 50)),
    );
  } catch {
    // ignore localStorage errors
  }
}

function responseError(payload: unknown): string | undefined {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return undefined;
}

function inputSummary(run: WorkflowRunRow): string {
  const workflow = getWorkflow(run.template_id);
  const summaryField = summaryFields[run.template_id];
  if (!workflow || !summaryField) return workflow?.name ?? run.template_id;
  if (
    typeof run.input_data !== "object" ||
    run.input_data === null ||
    Array.isArray(run.input_data)
  ) {
    return workflow.name;
  }
  const value = run.input_data[summaryField];
  return typeof value === "string" || typeof value === "number"
    ? String(value).slice(0, 120)
    : workflow.name;
}

function displayValue(value: Json | undefined): string {
  if (value === undefined || value === null || value === "") return "Not provided";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function dateLabel(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

export function Workspace() {
  const router = useRouter();
  const [session, setSession] = useState<WorkspaceSession>();
  const [sessionError, setSessionError] = useState("");
  const [allRuns, setAllRuns] = useState<WorkflowRunRow[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("pending_review");
  const [selectedId, setSelectedId] = useState("");
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [showNewCase, setShowNewCase] = useState(false);
  const [workflowId, setWorkflowId] = useState(workflows[0]?.id ?? "");
  const [input, setInput] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reviewNote, setReviewNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [pendingAction, setPendingAction] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const historyRequestId = useRef(0);

  const filteredRuns = allRuns.filter(
    (run) => filter === "all" || run.status === filter,
  );

  const countPending = allRuns.filter((r) => r.status === "pending_review").length;
  const countApproved = allRuns.filter((r) => r.status === "approved").length;
  const countRejected = allRuns.filter((r) => r.status === "rejected").length;
  const countAll = allRuns.length;

  const selectedRun = allRuns.find((run) => run.id === selectedId);
  const selectedWorkflow = selectedRun
    ? getWorkflow(selectedRun.template_id)
    : undefined;
  const selectedInput =
    selectedRun &&
    typeof selectedRun.input_data === "object" &&
    selectedRun.input_data !== null &&
    !Array.isArray(selectedRun.input_data)
      ? selectedRun.input_data
      : {};

  const canReview =
    session !== undefined &&
    ["owner", "admin", "reviewer"].includes(session.role);

  const loadEvents = useCallback(async (runId: string) => {
    const requestId = ++historyRequestId.current;
    setEvents([]);
    setEventsError("");
    if (!runId) {
      setEventsLoading(false);
      return;
    }

    setEventsLoading(true);
    try {
      const response = await fetch(`/api/runs/${runId}/events`, {
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      if (requestId !== historyRequestId.current) return;
      if (!response.ok) {
        setEventsError(
          responseError(payload) ?? "Case history could not be loaded.",
        );
        return;
      }
      if (!Array.isArray(payload)) {
        setEventsError("The history service returned an unexpected response.");
        return;
      }
      setEvents(payload as WorkflowEvent[]);
    } catch (error) {
      if (requestId === historyRequestId.current) {
        setEventsError(errorMessage(error));
      }
    } finally {
      if (requestId === historyRequestId.current) {
        setEventsLoading(false);
      }
    }
  }, []);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    setRunsError("");
    try {
      const response = await fetch(`/api/runs`, { cache: "no-store" });
      const payload: unknown = await response.json();
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        setAllRuns([]);
        setSelectedId("");
        setRunsError(
          responseError(payload) ?? "Workflow cases could not be loaded.",
        );
        return;
      }
      if (!Array.isArray(payload)) {
        setRunsError("The workflow service returned an unexpected response.");
        return;
      }
      const serverRuns = payload as WorkflowRunRow[];
      const localRuns = getLocalRuns();
      const runMap = new Map<string, WorkflowRunRow>();
      for (const run of serverRuns) runMap.set(run.id, run);
      for (const run of localRuns) {
        const existing = runMap.get(run.id);
        if (
          !existing ||
          new Date(run.updated_at).getTime() >=
            new Date(existing.updated_at).getTime()
        ) {
          runMap.set(run.id, run);
        }
      }
      const nextRuns = Array.from(runMap.values()).sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setAllRuns(nextRuns);
      setSelectedId((current) => {
        if (nextRuns.some((r) => r.id === current)) return current;
        const matching = nextRuns.find(
          (r) => filter === "all" || r.status === filter,
        );
        return matching?.id ?? nextRuns[0]?.id ?? "";
      });
    } catch (error) {
      setAllRuns([]);
      setSelectedId("");
      setRunsError(errorMessage(error));
    } finally {
      setRunsLoading(false);
    }
  }, [filter, router]);

  useEffect(() => {
    let active = true;
    async function loadSession() {
      setSessionError("");
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const payload: unknown = await response.json();
        if (!active) return;
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          setSessionError(
            responseError(payload) ?? "Workspace access could not be checked.",
          );
          return;
        }
        if (
          typeof payload === "object" &&
          payload !== null &&
          "email" in payload &&
          "role" in payload &&
          "workspaceName" in payload &&
          typeof payload.email === "string" &&
          typeof payload.role === "string" &&
          typeof payload.workspaceName === "string"
        ) {
          setSession({
            email: payload.email,
            name: "name" in payload && typeof payload.name === "string" ? payload.name : undefined,
            role: payload.role as WorkspaceRole,
            workspaceName: payload.workspaceName,
          });
        } else {
          setSessionError("Workspace details could not be read.");
        }
      } catch (error) {
        if (active) setSessionError(errorMessage(error));
      }
    }
    void loadSession();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (session) {
      timer = setTimeout(() => {
        void loadRuns();
      }, 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loadRuns, session]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (selectedId) {
      timer = setTimeout(() => {
        void loadEvents(selectedId);
      }, 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [loadEvents, selectedId]);

  function changeWorkflow(nextId: string) {
    setWorkflowId(nextId);
    setInput({});
    setFieldErrors({});
  }

  function fillSampleData() {
    const sample = getSampleInput(workflowId);
    if (Object.keys(sample).length > 0) {
      setInput(sample);
      setFieldErrors({});
    }
  }

  async function submitCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    setActionSuccess("");
    const result = validateWorkflowInput(workflowId, input);
    if (!result.success) {
      setFieldErrors(result.errors);
      return;
    }

    setFieldErrors({});
    setPendingAction(true);
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ workflowId, input: result.data }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setActionError(
          responseError(payload) ?? "The workflow case could not be submitted.",
        );
        return;
      }
      setShowNewCase(false);
      setInput({});
      setWorkflowId(workflows[0]?.id ?? "");
      setFilter("pending_review");
      const run = payload as WorkflowRunRow;
      saveLocalRun(run);
      setAllRuns((current) => [
        run,
        ...current.filter((item) => item.id !== run.id),
      ]);
      setSelectedId(run.id);
      setActionSuccess("Case submitted successfully for review.");
      setTimeout(() => setActionSuccess(""), 4000);
      await loadRuns();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setPendingAction(false);
    }
  }

  async function decide(decision: "approve" | "reject") {
    if (!selectedRun) return;
    setActionError("");
    setActionSuccess("");
    setPendingAction(true);
    try {
      const response = await fetch(`/api/runs/${selectedRun.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: reviewNote }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setActionError(
          responseError(payload) ?? "The workflow decision could not be saved.",
        );
        return;
      }
      const updated = payload as WorkflowRunRow;
      saveLocalRun(updated);
      setAllRuns((current) =>
        current.map((run) => (run.id === updated.id ? updated : run)),
      );
      setReviewNote("");
      setActionSuccess(
        decision === "approve"
          ? "Case approved for processing."
          : "Case rejected.",
      );
      setTimeout(() => setActionSuccess(""), 4000);
      await loadEvents(selectedRun.id);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setPendingAction(false);
    }
  }

  async function signOut() {
    setActionError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setActionError("Sign out could not be completed. Try again.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  const currentTemplate = getWorkflow(workflowId);

  return (
    <div className="page-shell">
      <header className="site-header">
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <Link className="wordmark" href="/" aria-label="Workline home">
            Workline
          </Link>
          <span className="workspace-badge">
            {session?.workspaceName || "Operations Workbench"}
          </span>
        </div>
        <div className="user-bar">
          {session && (
            <div className="user-pill">
              <span className="user-avatar" aria-hidden="true">
                {(session.name || session.email)[0]?.toUpperCase()}
              </span>
              <div className="user-details">
                <span className="user-name">
                  {session.name || session.email}
                </span>
                <span className="user-role-badge">{session.role}</span>
              </div>
            </div>
          )}
          <button
            className="button button-quiet button-small"
            type="button"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="workspace-main section-wrap">
        {sessionError ? (
          <div className="notice workspace-notice" role="alert">
            <strong>Workspace could not be opened.</strong>
            <p>{sessionError}</p>
            <Link className="button button-primary" href="/login">
              Return to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="workspace-header">
              <div>
                <p className="eyebrow">Case Management Queue</p>
                <h1>Operational Review Workbench</h1>
                <p className="workspace-subhead">
                  Every business case passes deterministic rule checks and pauses
                  for a verified human decision.
                </p>
              </div>
              <button
                className="button button-primary"
                type="button"
                onClick={() => {
                  setShowNewCase((prev) => !prev);
                  setActionError("");
                  setActionSuccess("");
                }}
              >
                {showNewCase ? "Close Form" : "+ Create Intake Case"}
              </button>
            </div>

            {actionSuccess && (
              <div className="notice notice-success" role="status">
                <strong>Success:</strong> {actionSuccess}
              </div>
            )}

            {actionError && (
              <div className="notice notice-error" role="alert">
                <strong>Action notice:</strong> {actionError}
              </div>
            )}

            {showNewCase && (
              <section
                className="new-case-drawer"
                aria-labelledby="new-case-title"
              >
                <div className="drawer-header">
                  <div>
                    <h2 id="new-case-title">Intake New Workflow Case</h2>
                    <p>Select a template and provide case facts for analysis.</p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="button button-quiet button-small"
                      type="button"
                      onClick={fillSampleData}
                    >
                      ✨ Auto-fill Sample Data
                    </button>
                    <button
                      className="button button-quiet button-small"
                      type="button"
                      onClick={() => setShowNewCase(false)}
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>

                <form className="new-case-form" onSubmit={submitCase}>
                  <div className="field">
                    <label htmlFor="workflow-picker">Workflow Template</label>
                    <select
                      id="workflow-picker"
                      value={workflowId}
                      onChange={(e) => changeWorkflow(e.target.value)}
                    >
                      {workflows.map((wf) => (
                        <option key={wf.id} value={wf.id}>
                          {wf.name} ({wf.area})
                        </option>
                      ))}
                    </select>
                    {currentTemplate && (
                      <p className="field-hint">{currentTemplate.description}</p>
                    )}
                  </div>

                  <div className="template-fields-grid">
                    {currentTemplate?.fields.map((field) => (
                      <div className="field" key={field.id}>
                        <label htmlFor={`field-${field.id}`}>
                          {field.label}
                          {field.required && (
                            <span className="required-star" aria-hidden="true">
                              *
                            </span>
                          )}
                        </label>

                        {field.type === "select" ? (
                          <select
                            id={`field-${field.id}`}
                            value={input[field.id] || ""}
                            onChange={(e) =>
                              setInput((cur) => ({
                                ...cur,
                                [field.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Select an option...</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === "textarea" ? (
                          <textarea
                            id={`field-${field.id}`}
                            rows={3}
                            maxLength={field.maxLength}
                            value={input[field.id] || ""}
                            onChange={(e) =>
                              setInput((cur) => ({
                                ...cur,
                                [field.id]: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          <input
                            id={`field-${field.id}`}
                            type={
                              field.type === "number"
                                ? "number"
                                : field.type === "date"
                                  ? "date"
                                  : field.type === "email"
                                    ? "email"
                                    : "text"
                            }
                            step={field.type === "number" ? "any" : undefined}
                            min={field.min}
                            max={field.max}
                            maxLength={field.maxLength}
                            value={input[field.id] || ""}
                            onChange={(e) =>
                              setInput((cur) => ({
                                ...cur,
                                [field.id]: e.target.value,
                              }))
                            }
                          />
                        )}

                        {fieldErrors[field.id] && (
                          <span className="field-error" role="alert">
                            {fieldErrors[field.id]}
                          </span>
                        )}
                        {field.help && (
                          <span className="field-hint">{field.help}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="form-actions">
                    <button
                      className="button button-primary"
                      type="submit"
                      disabled={pendingAction}
                    >
                      {pendingAction
                        ? "Submitting Case..."
                        : "Submit to Review Queue"}
                    </button>
                    <button
                      className="button button-quiet"
                      type="button"
                      onClick={() => setShowNewCase(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </section>
            )}

            <div className="workspace-filter-bar">
              <div className="filter-tabs" role="tablist" aria-label="Case status filters">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === "pending_review"}
                  className={`filter-tab ${filter === "pending_review" ? "tab-active" : ""}`}
                  onClick={() => setFilter("pending_review")}
                >
                  <span className="dot dot-amber" aria-hidden="true" />
                  Awaiting Review
                  <span className="tab-count">{countPending}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === "approved"}
                  className={`filter-tab ${filter === "approved" ? "tab-active" : ""}`}
                  onClick={() => setFilter("approved")}
                >
                  <span className="dot dot-emerald" aria-hidden="true" />
                  Approved
                  <span className="tab-count">{countApproved}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === "rejected"}
                  className={`filter-tab ${filter === "rejected" ? "tab-active" : ""}`}
                  onClick={() => setFilter("rejected")}
                >
                  <span className="dot dot-ruby" aria-hidden="true" />
                  Rejected
                  <span className="tab-count">{countRejected}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === "all"}
                  className={`filter-tab ${filter === "all" ? "tab-active" : ""}`}
                  onClick={() => setFilter("all")}
                >
                  All Cases
                  <span className="tab-count">{countAll}</span>
                </button>
              </div>

              <button
                className="button button-quiet button-small"
                type="button"
                onClick={() => void loadRuns()}
                disabled={runsLoading}
              >
                {runsLoading ? "Refreshing..." : "↻ Refresh Queue"}
              </button>
            </div>

            {runsError && (
              <div className="notice notice-error" role="alert">
                <strong>Queue notice:</strong> {runsError}
              </div>
            )}

            <div className="workbench-grid">
              {/* Left Column: Case Queue */}
              <section
                className="workbench-column queue-column"
                aria-labelledby="queue-heading"
              >
                <div className="column-header">
                  <h2 id="queue-heading">Queue ({filteredRuns.length})</h2>
                  <span className="column-subtext">Click to inspect</span>
                </div>

                {runsLoading ? (
                  <div className="empty-state">
                    <p>Loading cases from queue...</p>
                  </div>
                ) : filteredRuns.length === 0 ? (
                  <div className="empty-state">
                    <p>No cases found matching this filter.</p>
                    <button
                      className="button button-quiet button-small"
                      type="button"
                      onClick={() => setFilter("all")}
                    >
                      Show All Cases
                    </button>
                  </div>
                ) : (
                  <div className="case-cards-list" role="list">
                    {filteredRuns.map((run) => {
                      const wf = getWorkflow(run.template_id);
                      const isSelected = selectedId === run.id;
                      return (
                        <div
                          key={run.id}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          className={`case-card ${isSelected ? "case-card-selected" : ""}`}
                          onClick={() => {
                            setSelectedId(run.id);
                            setReviewNote("");
                            setActionError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              setSelectedId(run.id);
                              setReviewNote("");
                              setActionError("");
                            }
                          }}
                        >
                          <div className="case-card-top">
                            <span className="case-workflow-name">
                              {wf?.name || run.template_id}
                            </span>
                            <span
                              className={`status-pill status-${run.status}`}
                            >
                              {run.status.replace("_", " ")}
                            </span>
                          </div>
                          <div className="case-card-title">
                            {inputSummary(run)}
                          </div>
                          <div className="case-card-footer">
                            <span className="case-timestamp">
                              {dateLabel(run.created_at)}
                            </span>
                            <span className="case-creator">
                              By {run.created_by.split("@")[0]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Right Column: Case Inspector & Decision Console */}
              <section
                className="workbench-column detail-column"
                aria-labelledby="detail-heading"
              >
                {!selectedRun ? (
                  <div className="empty-state" style={{ minHeight: "400px" }}>
                    <h3>No Case Selected</h3>
                    <p>Select a case from the queue to inspect checks and review.</p>
                  </div>
                ) : (
                  <div className="case-detail-container">
                    <div className="detail-header-card">
                      <div className="detail-meta-left">
                        <span className="eyebrow">
                          {selectedWorkflow?.area || "Operations"} · Case ID:{" "}
                          {selectedRun.id.slice(0, 8)}
                        </span>
                        <h2 id="detail-heading">
                          {selectedWorkflow?.name || selectedRun.template_id}
                        </h2>
                        <p className="detail-subtitle">
                          Submitted by <strong>{selectedRun.created_by}</strong> ·{" "}
                          <time dateTime={selectedRun.created_at}>
                            {dateLabel(selectedRun.created_at)}
                          </time>
                        </p>
                      </div>
                      <div className="detail-status-badge">
                        <span
                          className={`status-pill status-${selectedRun.status}`}
                        >
                          {selectedRun.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    {/* Step Flow Preview */}
                    <div className="case-stepper">
                      <div className="step-item step-complete">
                        <span className="step-badge">1</span>
                        <span>Intake Verified</span>
                      </div>
                      <div className="step-connector" />
                      <div className="step-item step-complete">
                        <span className="step-badge">2</span>
                        <span>Rule Engine Run</span>
                      </div>
                      <div className="step-connector" />
                      <div
                        className={`step-item ${selectedRun.status === "pending_review" ? "step-active" : "step-complete"}`}
                      >
                        <span className="step-badge">3</span>
                        <span>
                          {selectedRun.status === "pending_review"
                            ? "Awaiting Human Review"
                            : "Human Decision Made"}
                        </span>
                      </div>
                      <div className="step-connector" />
                      <div
                        className={`step-item ${selectedRun.status !== "pending_review" ? "step-complete" : "step-pending"}`}
                      >
                        <span className="step-badge">4</span>
                        <span>Audit Log Sealed</span>
                      </div>
                    </div>

                    {/* Submitted Facts Card */}
                    <div className="card-panel">
                      <h3 className="card-panel-title">Submitted Request Facts</h3>
                      <dl className="facts-grid">
                        {Object.entries(selectedInput).map(([key, value]) => (
                          <div className="fact-item" key={key}>
                            <dt>{key.replaceAll("_", " ")}</dt>
                            <dd>{displayValue(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    {/* Rule Engine Checks Card */}
                    <div className="card-panel">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.75rem",
                        }}
                      >
                        <h3 className="card-panel-title" style={{ margin: 0 }}>
                          Automated Rule Verification
                        </h3>
                        <button
                          type="button"
                          className="text-link"
                          style={{ fontSize: "0.85rem" }}
                          onClick={() => setShowRawJson((prev) => !prev)}
                        >
                          {showRawJson ? "Show Formatted" : "View Raw JSON"}
                        </button>
                      </div>

                      {showRawJson ? (
                        <pre className="data-block">
                          {JSON.stringify(selectedRun.analysis, null, 2)}
                        </pre>
                      ) : (
                        <div className="analysis-formatted">
                          {typeof selectedRun.analysis === "object" &&
                          selectedRun.analysis !== null &&
                          "checks" in selectedRun.analysis &&
                          Array.isArray(selectedRun.analysis.checks) ? (
                            <ul className="checks-list">
                              {selectedRun.analysis.checks.map((rawCheck, idx) => {
                                const check =
                                  typeof rawCheck === "object" && rawCheck !== null
                                    ? (rawCheck as Record<string, unknown>)
                                    : {};
                                const status = String(check.status || "pass");
                                const rule = String(check.rule || "Check");
                                const detail = String(check.detail || "");
                                return (
                                  <li
                                    key={idx}
                                    className={`check-row check-${status}`}
                                  >
                                    <span className="check-icon" aria-hidden="true">
                                      {status === "flag" ? "⚠️" : "✓"}
                                    </span>
                                    <div className="check-copy">
                                      <strong>{rule}</strong>
                                      <p>{detail}</p>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <pre className="data-block">
                              {JSON.stringify(selectedRun.analysis, null, 2)}
                            </pre>
                          )}

                          {typeof selectedRun.analysis === "object" &&
                            selectedRun.analysis !== null &&
                            "summary" in selectedRun.analysis &&
                            typeof selectedRun.analysis.summary === "string" && (
                              <div className="analysis-summary-box">
                                <strong>System Summary:</strong>{" "}
                                {selectedRun.analysis.summary}
                              </div>
                            )}

                          {typeof selectedRun.analysis === "object" &&
                            selectedRun.analysis !== null &&
                            "recommendation" in selectedRun.analysis &&
                            typeof selectedRun.analysis.recommendation ===
                              "string" && (
                              <div className="analysis-recommendation-box">
                                <strong>Recommendation:</strong>{" "}
                                {selectedRun.analysis.recommendation}
                              </div>
                            )}
                        </div>
                      )}
                    </div>

                    {/* Approved Output or Decision Note */}
                    {selectedRun.decision_note && (
                      <div className="card-panel decision-card">
                        <h3 className="card-panel-title">Recorded Review Decision</h3>
                        <p className="decision-note-text">
                          &ldquo;{selectedRun.decision_note}&rdquo;
                        </p>
                        <p className="decision-reviewer">
                          Decided by:{" "}
                          <strong>
                            {selectedRun.reviewed_by || "Reviewer"}
                          </strong>{" "}
                          · Status:{" "}
                          <span
                            className={`status-pill status-${selectedRun.status}`}
                          >
                            {selectedRun.status}
                          </span>
                        </p>

                        {selectedRun.approved_output && (
                          <div style={{ marginTop: "1rem" }}>
                            <p className="field-hint">
                              Manual Processing Instructions (No direct automated
                              transaction):
                            </p>
                            <pre className="data-block data-block-small">
                              {JSON.stringify(selectedRun.approved_output, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Review Decision Gate */}
                    {selectedRun.status === "pending_review" && (
                      <div className="card-panel review-decision-gate">
                        <h3 className="card-panel-title">
                          Human Review & Gatekeeper Decision
                        </h3>
                        {canReview ? (
                          <div className="decision-form">
                            <div className="field">
                              <label htmlFor="review-decision-note">
                                Review Decision Note (Optional)
                              </label>
                              <textarea
                                id="review-decision-note"
                                rows={3}
                                maxLength={1000}
                                placeholder="Add guidance, reconciliation details, or reason for decision..."
                                value={reviewNote}
                                onChange={(e) => setReviewNote(e.target.value)}
                              />
                            </div>
                            <div className="decision-button-row">
                              <button
                                className="button button-primary"
                                type="button"
                                disabled={pendingAction}
                                onClick={() => void decide("approve")}
                              >
                                {pendingAction ? "Saving..." : "✓ Approve Case"}
                              </button>
                              <button
                                className="button button-danger"
                                type="button"
                                disabled={pendingAction}
                                onClick={() => void decide("reject")}
                              >
                                {pendingAction ? "Saving..." : "✕ Reject Case"}
                              </button>
                            </div>
                            <p className="privacy-note" style={{ marginTop: "0.75rem" }}>
                              Human approval gates external action. Workline never
                              initiates banking transactions, customer messages, or
                              procurement orders.
                            </p>
                          </div>
                        ) : (
                          <div className="notice" role="status">
                            Your role (<strong>{session?.role}</strong>) has intake
                            authority. Case review and decision approval require a
                            reviewer or admin role.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Audit History Log */}
                    <div className="card-panel audit-history-card">
                      <h3 className="card-panel-title">Audit Trail & Event Log</h3>
                      {eventsLoading ? (
                        <p className="field-hint">Loading immutable audit logs...</p>
                      ) : eventsError ? (
                        <p className="field-error">{eventsError}</p>
                      ) : events.length === 0 ? (
                        <p className="field-hint">No audit events recorded yet.</p>
                      ) : (
                        <ol className="audit-timeline">
                          {events.map((event) => (
                            <li key={event.id} className="timeline-item">
                              <div className="timeline-dot" aria-hidden="true" />
                              <div className="timeline-content">
                                <div className="timeline-header">
                                  <strong>{event.event.replace("_", " ")}</strong>
                                  <time dateTime={event.created_at}>
                                    {dateLabel(event.created_at)}
                                  </time>
                                </div>
                                {event.actor_email && (
                                  <span className="timeline-actor">
                                    Actor: {event.actor_email}
                                  </span>
                                )}
                                {typeof event.details === "object" &&
                                  event.details !== null &&
                                  Object.keys(event.details).length > 0 && (
                                    <pre className="data-block data-block-small">
                                      {JSON.stringify(event.details, null, 2)}
                                    </pre>
                                  )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      <footer className="site-footer">
        <Link className="wordmark" href="/">
          Workline
        </Link>
        <p>Operational workflow prototypes with immutable human-in-the-loop review.</p>
        <Link href="/demo">Try Public Demo</Link>
      </footer>
    </div>
  );
}
