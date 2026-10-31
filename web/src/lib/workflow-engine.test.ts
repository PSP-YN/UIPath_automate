import { describe, expect, it } from "vitest";
import { workflows } from "./catalog";
import { analyzeWorkflow, validateWorkflowInput } from "./workflow-engine";

describe("workflow catalog", () => {
  it("contains the original two flows and ten additional business workflows", () => {
    expect(workflows).toHaveLength(12);
    expect(new Set(workflows.map((workflow) => workflow.id)).size).toBe(12);
  });

  it("validates and analyzes a complete request for every workflow template", () => {
    for (const workflow of workflows) {
      const input = Object.fromEntries(
        workflow.fields.map((field) => [
          field.id,
          field.type === "email"
            ? "example@example.com"
            : field.type === "date"
              ? "2026-10-30"
              : field.type === "number"
                ? String(field.min ?? 0)
                : field.type === "select"
                  ? field.options?.[0] ?? ""
                  : "Example request",
        ]),
      );
      const validation = validateWorkflowInput(workflow.id, input);
      expect(validation.success, workflow.id).toBe(true);
      if (validation.success) {
        const analysis = analyzeWorkflow(workflow.id, validation.data);
        expect(analysis.route.length, workflow.id).toBeGreaterThan(0);
        expect(analysis.review_reasons.length, workflow.id).toBeGreaterThan(0);
      }
    }
  });

  it("rejects unknown workflows, unexpected input keys, and missing required values", () => {
    expect(validateWorkflowInput("not-a-workflow", {})).toMatchObject({ success: false });
    expect(validateWorkflowInput("invoice-review", { unexpected: "value" })).toMatchObject({
      success: false,
    });
    expect(validateWorkflowInput("support-triage", {})).toMatchObject({ success: false });
  });

  it("reports missing and invalid numeric inputs without throwing", () => {
    const missing = validateWorkflowInput("purchase-request", {
      requester_email: "buyer@example.com",
      department: "Operations",
      vendor: "Example supplier",
      item: "Replacement equipment",
      budget_available: "1000",
      currency: "USD",
      business_reason: "Replace damaged equipment",
    });
    expect(missing).toMatchObject({
      success: false,
      errors: { requested_amount: "This field is required." },
    });

    const invalid = validateWorkflowInput("purchase-request", {
      requester_email: "buyer@example.com",
      department: "Operations",
      vendor: "Example supplier",
      item: "Replacement equipment",
      requested_amount: "not-a-number",
      budget_available: "1000",
      currency: "USD",
      business_reason: "Replace damaged equipment",
    });
    expect(invalid).toMatchObject({ success: false });
  });

  it("reconciles invoices and rejects impossible date and amount combinations", () => {
    const invoice = {
      vendor: "Example supplier",
      invoice_number: "INV-1",
      invoice_date: "2026-10-10",
      due_date: "2026-11-10",
      currency: "USD",
      subtotal: "100",
      tax: "8",
      total: "108",
      description: "Office supplies",
    };
    const valid = validateWorkflowInput("invoice-review", invoice);
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(analyzeWorkflow("invoice-review", valid.data).findings.reconciled).toBe(true);
    }
    expect(validateWorkflowInput("invoice-review", { ...invoice, total: "200" })).toMatchObject({
      success: false,
    });
    expect(
      validateWorkflowInput("invoice-review", { ...invoice, due_date: "2026-10-01" }),
    ).toMatchObject({ success: false });
  });

  it("routes urgent support tickets without sending a reply", () => {
    const ticket = validateWorkflowInput("support-triage", {
      ticket_id: "T-1",
      customer_name: "Sample customer",
      customer_email: "",
      subject: "Urgent login error",
      message: "I cannot access my account.",
    });
    expect(ticket.success).toBe(true);
    if (ticket.success) {
      const result = analyzeWorkflow("support-triage", ticket.data);
      expect(result.risk).toBe("urgent");
      expect(result.route).toBe("Account Support");
      expect(result.findings.draft_reply).toEqual(expect.any(String));
    }
  });

  it("compares workflow requests against values supplied from company policy", () => {
    const request = analyzeWorkflow("purchase-request", {
      requester_email: "buyer@example.com",
      department: "Operations",
      vendor: "Example supplier",
      item: "Replacement equipment",
      requested_amount: 1200,
      budget_available: 1000,
      currency: "USD",
      business_reason: "Replace damaged equipment",
    });
    expect(request.risk).toBe("attention");
    expect(request.review_reasons[0]).toContain("available budget entered");

    const discount = analyzeWorkflow("sales-quote-approval", {
      customer: "Example customer",
      customer_email: "buyer@example.com",
      quote_reference: "Q-1",
      amount: 1200,
      discount_percent: 15,
      approval_limit_percent: 10,
      expires_on: "2026-12-01",
      summary: "Software license",
    });
    expect(discount.risk).toBe("attention");
  });

  it("calculates an inventory suggestion without ordering stock", () => {
    const result = analyzeWorkflow("inventory-reorder", {
      item_code: "SKU-1",
      item_name: "Paper",
      stock_on_hand: 4,
      reorder_point: 5,
      target_stock: 20,
      supplier: "Example supplier",
      unit_cost: 2,
      currency: "USD",
      lead_time_days: 14,
    });
    expect(result.findings.suggested_quantity).toBe(16);
    expect(result.findings.estimated_cost).toBe(32);
    expect(result.summary).toContain("review");
  });

  it("keeps all release actions gated by human review", () => {
    expect(workflows.every((workflow) => workflow.gated_action.length > 0)).toBe(true);
    const incident = analyzeWorkflow("policy-exception", {
      reporter_email: "reporter@example.com",
      policy_area: "Access",
      occurred_on: "2026-10-30",
      severity: "High",
      contained: "No",
      description: "Redacted test report",
    });
    expect(incident.risk).toBe("urgent");
  });
});
