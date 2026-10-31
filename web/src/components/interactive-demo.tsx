"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { workflows, type Workflow } from "@/lib/catalog";
import {
  analyzeWorkflow,
  validateWorkflowInput,
  type WorkflowAnalysis,
} from "@/lib/workflow-engine";

type DemoDecision = "approved" | "rejected" | undefined;

import { getSampleInput } from "@/lib/sample-data";

function sampleFor(workflowId: string): Record<string, string> {
  return getSampleInput(workflowId);
}

function FieldControl({
  workflow,
  fieldId,
  value,
  error,
  onChange,
}: {
  workflow: Workflow;
  fieldId: string;
  value: string;
  error?: string;
  onChange: (fieldId: string, value: string) => void;
}) {
  const field = workflow.fields.find((item) => item.id === fieldId);
  if (!field) return null;
  const inputId = `${workflow.id}-${field.id}`;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedBy = [
    field.help ? helpId : undefined,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(" ") || undefined;
  const common = {
    id: inputId,
    name: field.id,
    required: field.required,
    value,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    onChange: (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => onChange(field.id, event.target.value),
  };

  return (
    <div className={field.type === "textarea" ? "field field-wide" : "field"}>
      <label htmlFor={inputId}>
        {field.label}
        {field.required ? "" : " (optional)"}
      </label>
      {field.type === "textarea" ? (
        <textarea {...common} maxLength={field.maxLength} rows={4} />
      ) : field.type === "select" ? (
        <select {...common}>
          <option value="">Choose an option</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={field.type}
          maxLength={field.maxLength}
          min={field.type === "number" ? field.min : undefined}
          max={field.type === "number" ? field.max : undefined}
          step={field.type === "number" ? "any" : undefined}
        />
      )}
      {field.help && (
        <p className="field-help" id={helpId}>
          {field.help}
        </p>
      )}
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

export function InteractiveDemo({ compact = false }: { compact?: boolean }) {
  const [workflowId, setWorkflowId] = useState("invoice-review");
  const [values, setValues] = useState(() => sampleFor("invoice-review"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [analysis, setAnalysis] = useState<WorkflowAnalysis>();
  const [decision, setDecision] = useState<DemoDecision>();
  const workflow = workflows.find((item) => item.id === workflowId) ?? workflows[0];

  function changeWorkflow(nextId: string) {
    setWorkflowId(nextId);
    setValues(sampleFor(nextId));
    setErrors({});
    setAnalysis(undefined);
    setDecision(undefined);
  }

  function runChecks(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateWorkflowInput(workflow.id, values);
    if (!result.success) {
      setErrors(result.errors);
      setAnalysis(undefined);
      setDecision(undefined);
      return;
    }
    setErrors({});
    setAnalysis(analyzeWorkflow(workflow.id, result.data));
    setDecision(undefined);
  }

  function resetSample() {
    setValues(sampleFor(workflow.id));
    setErrors({});
    setAnalysis(undefined);
    setDecision(undefined);
  }

  return (
    <div className={`demo-panel ${compact ? "demo-panel-compact" : ""}`}>
      <div className="demo-form-side">
        <div className="demo-panel-header">
          <div>
            <h3>Sample intake</h3>
            <p>Browser-only demonstration. Not saved to a workspace.</p>
          </div>
          <span className="status-label status-routine">Sample data</span>
        </div>

        <div className="field" style={{ marginBottom: "1.25rem" }}>
          <label htmlFor={`demo-workflow-${compact ? "compact" : "full"}`}>
            Workflow
          </label>
          <select
            id={`demo-workflow-${compact ? "compact" : "full"}`}
            value={workflow.id}
            onChange={(event) => changeWorkflow(event.target.value)}
          >
            {workflows.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <form className="demo-form" noValidate onSubmit={runChecks}>
          <div className="field-grid">
            {workflow.fields.map((field) => (
              <FieldControl
                key={`${workflow.id}-${field.id}`}
                workflow={workflow}
                fieldId={field.id}
                value={values[field.id] ?? ""}
                error={errors[field.id]}
                onChange={(id, value) =>
                  setValues((current) => ({ ...current, [id]: value }))
                }
              />
            ))}
          </div>
          {errors.form && (
            <p className="form-error" role="alert">
              {errors.form}
            </p>
          )}
          <div className="form-actions">
            <button className="button button-primary" type="submit">
              Run rule checks
            </button>
            <button className="button button-quiet" type="button" onClick={resetSample}>
              Reset sample
            </button>
          </div>
        </form>
      </div>

      <div className="demo-result-side" aria-live="polite">
        {!analysis ? (
          <div className="result-empty">
            <h3>Review stage</h3>
            <p>
              Submit the sample to see validated facts and a human review
              decision. No external action runs here.
            </p>
          </div>
        ) : (
          <div className="result-content">
            <div className="demo-panel-header">
              <div>
                <h3>{decision ? "Decision recorded in demo" : "Checks complete"}</h3>
                <p>{analysis.summary}</p>
              </div>
              <span className={`status-label status-${analysis.risk}`}>
                {decision ?? analysis.risk}
              </span>
            </div>
            <p>
              <strong>Reviewer:</strong> {analysis.route}
            </p>
            <div>
              <p>
                <strong>Rule findings</strong>
              </p>
              <ul className="result-list">
                {analysis.review_reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
            {Object.keys(analysis.findings).length > 0 && (
              <div>
                <p>
                  <strong>Prepared evidence</strong>
                </p>
                <dl className="detail-content">
                  {Object.entries(analysis.findings).map(([name, value]) => (
                    <div key={name}>
                      <dt>{name.replaceAll("_", " ")}</dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {decision ? (
              <p className="notice" role="status">
                {decision === "approved"
                  ? `Sample approved for: ${workflow.gated_action}`
                  : "Sample rejected. No output was released."}
                {" "}The demonstration saved nothing and changed no external system.
              </p>
            ) : (
              <div className="review-actions">
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => setDecision("approved")}
                >
                  Approve sample
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => setDecision("rejected")}
                >
                  Reject sample
                </button>
              </div>
            )}
            <p className="form-note">
              This prototype uses deterministic rule checks. It is not a
              UiPath Maestro deployment or an AI model.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
