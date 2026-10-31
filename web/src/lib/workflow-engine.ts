import { z } from "zod";
import { getWorkflow, type Workflow } from "./catalog";

export type RiskLevel = "routine" | "attention" | "urgent";

export type WorkflowAnalysis = {
  risk: RiskLevel;
  summary: string;
  route: string;
  review_reasons: string[];
  findings: Record<string, string | number | boolean | null>;
};

export type ValidationResult =
  | { success: true; data: Record<string, string | number> }
  | { success: false; errors: Record<string, string> };

function fieldValidator(field: Workflow["fields"][number]) {
  if (field.type === "number") {
    let numberValidator = z.number().finite("Enter a valid number.");
    if (field.min !== undefined) numberValidator = numberValidator.min(field.min);
    if (field.max !== undefined) numberValidator = numberValidator.max(field.max);
    const normalizeNumber = (value: unknown) => {
      if (typeof value === "string" && value.trim() === "") return undefined;
      if (typeof value === "string") return Number(value);
      return value;
    };
    return field.required
      ? z.preprocess(normalizeNumber, numberValidator)
      : z.preprocess(normalizeNumber, numberValidator.optional());
  }

  let validator = z.string().trim();
  if (field.required) validator = validator.min(1, "This field is required.");
  if (field.maxLength !== undefined) validator = validator.max(field.maxLength);
  if (field.type === "email") {
    validator = validator.refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid email address.",
    );
  }
  if (field.type === "date") {
    validator = validator.refine(
      (value) =>
        value === "" ||
        (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
          new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value),
      "Enter a valid date.",
    );
  }
  if (field.type === "select" && field.options) {
    validator = validator.refine(
      (value) => value === "" || field.options?.includes(value) === true,
      "Choose one of the listed options.",
    );
  }
  return field.required ? validator : validator.optional();
}

export function validateWorkflowInput(
  workflowId: string,
  input: unknown,
): ValidationResult {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return { success: false, errors: { form: "Choose a listed workflow." } };
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, errors: { form: "Workflow input must be an object." } };
  }
  const inputRecord = input as Record<string, unknown>;

  const schema = z.object(
    Object.fromEntries(
      workflow.fields.map((field) => [field.id, fieldValidator(field)]),
    ),
  ).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      const fieldId = typeof field === "string" ? field : "form";
      const definition = workflow.fields.find((item) => item.id === fieldId);
      const value = inputRecord[fieldId];
      const message =
        definition?.required &&
        issue.code === "invalid_type" &&
        (value === undefined || value === "")
          ? "This field is required."
          : issue.message;
      errors[fieldId] ??= message;
    }
    return { success: false, errors };
  }

  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number>;
  const crossFieldError = validateRelatedFields(workflowId, data);
  return crossFieldError
    ? { success: false, errors: { form: crossFieldError } }
    : { success: true, data };
}

function validateRelatedFields(
  workflowId: string,
  input: Record<string, string | number>,
): string | undefined {
  const startsAfterEnds = [
    ["invoice-review", "invoice_date", "due_date", "Due date must be on or after the invoice date."],
    ["leave-request", "start_date", "end_date", "Last day must be on or after the first day."],
    ["contract-intake", "start_date", "end_date", "End date must be on or after the start date."],
  ] as const;
  const dateRule = startsAfterEnds.find(([id]) => id === workflowId);
  if (dateRule && String(input[dateRule[1]]) > String(input[dateRule[2]])) {
    return dateRule[3];
  }

  if (
    workflowId === "invoice-review" &&
    Math.abs(Number(input.subtotal) + Number(input.tax) - Number(input.total)) > 0.01
  ) {
    return "Invoice total must equal subtotal plus tax.";
  }
  if (
    workflowId === "inventory-reorder" &&
    Number(input.target_stock) < Number(input.reorder_point)
  ) {
    return "Target stock must be at least the reorder point.";
  }
  return undefined;
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function analyzeWorkflow(
  workflowId: string,
  input: Record<string, string | number>,
): WorkflowAnalysis {
  const workflow = getWorkflow(workflowId);
  if (!workflow) throw new Error("Choose a listed workflow before analysis.");

  const reasons: string[] = [];
  const findings: WorkflowAnalysis["findings"] = {};
  let route = workflow.reviewer;
  let risk: RiskLevel = "routine";
  const mark = (level: RiskLevel, reason: string) => {
    const rank: Record<RiskLevel, number> = { routine: 0, attention: 1, urgent: 2 };
    if (rank[level] > rank[risk]) risk = level;
    reasons.push(reason);
  };

  switch (workflowId) {
    case "invoice-review": {
      if (Number(input.total) >= 5000) {
        mark("attention", "Amount reaches the prototype review marker; compare it with company policy.");
      }
      findings.reconciled = true;
      findings.total = Number(input.total);
      route = "Finance";
      break;
    }
    case "support-triage": {
      const text = `${input.subject} ${input.message}`.toLowerCase();
      const categories = [
        ["billing", ["invoice", "refund", "charge", "payment", "bill"]],
        ["technical", ["error", "bug", "crash", "cannot", "can't", "issue"]],
        ["delivery", ["delivery", "shipment", "tracking", "package", "order"]],
        ["account", ["login", "password", "account", "sign in", "access"]],
      ] as const;
      const category = categories
        .map(([name, terms]) => ({
          name,
          score: terms.reduce((sum, term) => sum + Number(text.includes(term)), 0),
        }))
        .sort((a, b) => b.score - a.score)[0];
      const urgency = containsAny(text, ["urgent", "immediately", "emergency", "outage"]);
      if (urgency) mark("urgent", "The request contains an urgent-language indicator.");
      const selectedCategory = category.score ? category.name : "general";
      route = {
        billing: "Finance",
        technical: "Technical Support",
        delivery: "Order Support",
        account: "Account Support",
        general: "Customer Support",
      }[selectedCategory];
      findings.category = selectedCategory;
      findings.priority = urgency ? "urgent" : "normal";
      findings.draft_reply = `Hi ${String(input.customer_name)}, thanks for contacting us. Our ${route} team is reviewing your request and will follow up.`;
      break;
    }
    case "purchase-request":
      if (Number(input.requested_amount) > Number(input.budget_available)) {
        mark("attention", "Requested amount exceeds the available budget entered.");
      }
      findings.requested_amount = Number(input.requested_amount);
      findings.budget_available = Number(input.budget_available);
      route = "Budget owner";
      break;
    case "expense-reimbursement":
      if (!input.receipt_reference) mark("attention", "No receipt reference was supplied.");
      if (Number(input.amount) > Number(input.policy_cap)) {
        mark("attention", "Amount exceeds the policy cap entered by the requester.");
      }
      findings.amount = Number(input.amount);
      route = "Expense approver";
      break;
    case "employee-onboarding":
      if (input.access_profile === "Administrator") {
        mark("attention", "Requested access profile includes administrator access.");
      }
      findings.checklist_status = "Needs manager review";
      route = "Hiring manager";
      break;
    case "leave-request":
      findings.date_range = `${input.start_date} to ${input.end_date}`;
      route = "Line manager";
      break;
    case "contract-intake":
      if (input.auto_renewal === "Yes") mark("attention", "Contract intake reports an auto-renewal clause.");
      if (input.auto_renewal === "Unknown") mark("attention", "Auto-renewal status needs human confirmation.");
      findings.legal_review_required = true;
      route = "Contract owner";
      break;
    case "lead-qualification":
      if (input.contact_permission !== "Yes") {
        mark("attention", "Follow-up permission is not recorded as confirmed.");
      }
      if (input.timeframe === "Within 30 days") mark("attention", "The stated follow-up timeframe is near-term.");
      findings.follow_up_permitted = input.contact_permission === "Yes";
      route = "Sales owner";
      break;
    case "sales-quote-approval":
      if (Number(input.discount_percent) > Number(input.approval_limit_percent)) {
        mark("attention", "Proposed discount exceeds the approval limit entered.");
      }
      findings.discount_percent = Number(input.discount_percent);
      route = "Sales manager";
      break;
    case "it-access-request":
      if (input.role === "Administrator") mark("urgent", "Requested access is administrator-level.");
      if (input.manager_approval !== "Yes") {
        mark("attention", "Manager approval is not recorded as confirmed.");
      }
      findings.access_duration_days = Number(input.duration_days);
      route = "IT access reviewer";
      break;
    case "inventory-reorder": {
      const reorder = Number(input.stock_on_hand) <= Number(input.reorder_point);
      if (reorder) mark("attention", "Stock on hand is at or below the reorder point entered.");
      findings.reorder_suggested = reorder;
      findings.suggested_quantity = reorder
        ? Number(input.target_stock) - Number(input.stock_on_hand)
        : 0;
      findings.estimated_cost = Number(findings.suggested_quantity) * Number(input.unit_cost);
      route = "Inventory owner";
      break;
    }
    case "policy-exception":
      if (input.severity === "High" || input.contained === "No") {
        mark("urgent", "High severity or an uncontained issue requires prompt review.");
      } else if (input.severity === "Unknown" || input.contained === "Unknown") {
        mark("attention", "Severity or containment status needs confirmation.");
      }
      route = "Risk owner";
      break;
    default:
      throw new Error("Workflow analysis is not implemented.");
  }

  if (reasons.length === 0) reasons.push("No configured rule raised an exception; human review is still required.");
  return {
    risk,
    summary: `${workflow.name} is ready for ${route} review.`,
    route,
    review_reasons: reasons,
    findings,
  };
}
