import type {
  Json,
  WorkflowRunRow,
  WorkflowStatus,
} from "@/lib/database.types";

export type WorkflowEventRow = {
  id: number;
  workspace_id: string;
  run_id: string;
  actor_id: string | null;
  actor_email?: string;
  event: "submitted" | "approved" | "rejected" | "retry_started";
  details: Json;
  created_at: string;
};

// Realistic Seed Cases across flagship templates
const INITIAL_RUNS: WorkflowRunRow[] = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    workspace_id: "ws_workline_main",
    idempotency_key: "e1000000-0000-4000-8000-000000000001",
    template_id: "invoice-review",
    status: "pending_review",
    input_data: {
      vendor: "Apex Industrial Components Ltd",
      invoice_number: "INV-2026-8841",
      invoice_date: "2026-10-18",
      due_date: "2026-11-17",
      currency: "USD",
      subtotal: 4400.0,
      tax: 450.0,
      total: 4850.0,
      description:
        "Precision milled aluminum housings and tooling fasteners for batch Q4 assembly.",
    },
    analysis: {
      checks: [
        {
          rule: "Invoice subtotal plus tax matches total",
          status: "pass",
          detail: "4400.00 + 450.00 = 4850.00 (reconciliation complete)",
        },
        {
          rule: "Invoice date precedes due date",
          status: "pass",
          detail: "Invoice dated 2026-10-18, due 2026-11-17 (30-day net terms)",
        },
        {
          rule: "Invoice total within standard limits",
          status: "pass",
          detail: "Total $4,850.00 is below the $10,000 dual-approver threshold",
        },
      ],
      summary:
        "Mathematical and date checks passed cleanly. Standard 30-day payment schedule verified.",
      recommendation:
        "Approve payment voucher preparation. No automated transaction will be executed.",
    },
    approved_output: null,
    attempts: 1,
    created_by: "intake@workline.internal",
    reviewed_by: null,
    decision_note: null,
    created_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(), // 42 mins ago
    updated_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    workspace_id: "ws_workline_main",
    idempotency_key: "e1000000-0000-4000-8000-000000000002",
    template_id: "support-triage",
    status: "pending_review",
    input_data: {
      ticket_id: "TCK-9402",
      customer_name: "Sophia Lindqvist",
      customer_email: "sophia@nordiclogistics.se",
      subject: "Urgent: Webhook latency spike during regional warehouse handover",
      message:
        "Our logistics dispatch webhook experienced recurring 429 throttle codes starting 08:30 UTC. We need our API quota temporarily expanded while our engineers deploy Redis batch queue buffering.",
    },
    analysis: {
      checks: [
        {
          rule: "Corporate email validation",
          status: "pass",
          detail: "Domain verified against enterprise customer directory",
        },
        {
          rule: "Urgency keyword classification",
          status: "flag",
          detail:
            "Keywords detected: 'Urgent', 'latency spike', 'throttle codes'",
        },
        {
          rule: "Routing category assignment",
          status: "pass",
          detail: "Route to: Platform Infrastructure / SRE On-call Queue",
        },
      ],
      summary:
        "High-priority operational inquiry regarding API rate-limiting during active fleet dispatch.",
      recommendation:
        "Prioritize response to Tier 2 SRE lead. Review proposed temporary quota increase draft.",
    },
    approved_output: null,
    attempts: 1,
    created_by: "intake@workline.internal",
    reviewed_by: null,
    decision_note: null,
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(), // 18 mins ago
    updated_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: "a1000000-0000-4000-8000-000000000003",
    workspace_id: "ws_workline_main",
    idempotency_key: "e1000000-0000-4000-8000-000000000003",
    template_id: "purchase-request",
    status: "approved",
    input_data: {
      requester_email: "j.miller@workline.internal",
      department: "Software Engineering",
      vendor: "Dell Enterprise Direct",
      item: "High-performance GPU workstation nodes (2x Precision 7960)",
      requested_amount: 8600.0,
      budget_available: 15000.0,
      currency: "USD",
      business_reason:
        "Local model fine-tuning and offline AI benchmark evaluation to reduce third-party API cloud egress costs.",
    },
    analysis: {
      checks: [
        {
          rule: "Available departmental budget comparison",
          status: "pass",
          detail:
            "Requested $8,600.00 is well within available departmental balance of $15,000.00",
        },
        {
          rule: "Approved IT equipment vendor",
          status: "pass",
          detail: "Vendor matches active master agreement",
        },
      ],
      summary:
        "CapEx compute hardware request verified against Q4 infrastructure budget.",
      recommendation: "Eligible for procurement authorization voucher.",
    },
    approved_output: {
      action: "PO_AUTHORIZATION_PREPARED",
      details:
        "Manual purchase order PO-ENG-2026-092 authorized for submission to finance desk.",
    },
    attempts: 1,
    created_by: "j.miller@workline.internal",
    reviewed_by: "reviewer@workline.internal",
    decision_note:
      "Approved. Solid ROI on reducing cloud inference egress fees. Send PO to accounting.",
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: "a1000000-0000-4000-8000-000000000004",
    workspace_id: "ws_workline_main",
    idempotency_key: "e1000000-0000-4000-8000-000000000004",
    template_id: "expense-reimbursement",
    status: "approved",
    input_data: {
      employee_email: "elena.r@workline.internal",
      category: "Travel & Lodging",
      amount: 340.5,
      currency: "EUR",
      receipt_reference: "HOTEL-BER-4419",
      description:
        "Accommodations during IEEE European Tech Symposium in Berlin for keynote presentation.",
    },
    analysis: {
      checks: [
        {
          rule: "Policy ceiling check",
          status: "pass",
          detail: "340.50 EUR complies with the 400.00 EUR per diem hotel cap",
        },
        {
          rule: "Receipt attachment verification",
          status: "pass",
          detail: "Folio HOTEL-BER-4419 registered and cross-referenced",
        },
      ],
      summary: "Conference business expense compliant with corporate travel policy.",
      recommendation: "Approve for scheduled payroll reimbursement cycle.",
    },
    approved_output: {
      action: "REIMBURSEMENT_SCHEDULED",
      details: "Disbursement batch ref EXP-2026-442 tagged for next cycle.",
    },
    attempts: 1,
    created_by: "elena.r@workline.internal",
    reviewed_by: "admin@workline.internal",
    decision_note:
      "All hotel receipts verified against conference attendance itinerary.",
    created_at: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
  {
    id: "a1000000-0000-4000-8000-000000000005",
    workspace_id: "ws_workline_main",
    idempotency_key: "e1000000-0000-4000-8000-000000000005",
    template_id: "policy-exception",
    status: "rejected",
    input_data: {
      policy_area: "Information Security",
      requester: "DevOps Infrastructure Team",
      exception_description:
        "Request for temporary direct bastion SSH root access without hardware FIDO2 key during Sunday maintenance window.",
      risk_assessment:
        "Elevated credential interception risk during database index reconstruction.",
      mitigation:
        "Session recorded to internal audit log and IP restricted to secure office subnet.",
    },
    analysis: {
      checks: [
        {
          rule: "SOC2 Compliance Critical Boundary",
          status: "flag",
          detail:
            "Mandatory hardware token MFA waiver violates SOC2 Section 4.1 access requirements",
        },
        {
          rule: "Alternative mitigation available",
          status: "pass",
          detail: "Automated ephemeral session credentials through Teleport proxy available",
        },
      ],
      summary:
        "High risk security exception requesting bypass of fundamental MFA controls.",
      recommendation:
        "Reject. Direct requester to use ephemeral WebAuthn jumpbox session.",
    },
    approved_output: null,
    attempts: 1,
    created_by: "intake@workline.internal",
    reviewed_by: "admin@workline.internal",
    decision_note:
      "Rejected per compliance mandate. FIDO2 hardware tokens cannot be bypassed in production under any operational circumstances.",
    created_at: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 460).toISOString(),
  },
  {
    id: "a1000000-0000-4000-8000-000000000006",
    workspace_id: "ws_workline_main",
    idempotency_key: "e1000000-0000-4000-8000-000000000006",
    template_id: "inventory-reorder",
    status: "pending_review",
    input_data: {
      item_name: "Biodegradable Thermal Shipping Labels 4x6",
      sku: "SHP-LBL-4X6-ECO",
      current_stock: 45,
      reorder_threshold: 100,
      suggested_quantity: 500,
      supplier: "EcoPack Supplies Co",
    },
    analysis: {
      checks: [
        {
          rule: "Stock vs Threshold check",
          status: "pass",
          detail:
            "Current stock (45) is below replenishment threshold (100). Reorder triggered.",
        },
        {
          rule: "Standard order batch quantity",
          status: "pass",
          detail: "Suggested 500 units represents 45 days average consumption",
        },
      ],
      summary: "Inventory replenishment triggered for warehouse dispatch line.",
      recommendation:
        "Authorize manual purchase order transmission to primary supplier.",
    },
    approved_output: null,
    attempts: 1,
    created_by: "intake@workline.internal",
    reviewed_by: null,
    decision_note: null,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
    updated_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];

const INITIAL_EVENTS: WorkflowEventRow[] = [
  {
    id: 1,
    workspace_id: "ws_workline_main",
    run_id: "a1000000-0000-4000-8000-000000000001",
    actor_id: "usr_sub_003",
    actor_email: "intake@workline.internal",
    event: "submitted",
    details: { message: "Supplier invoice submitted via intake portal." },
    created_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
  },
  {
    id: 2,
    workspace_id: "ws_workline_main",
    run_id: "a1000000-0000-4000-8000-000000000002",
    actor_id: "usr_sub_003",
    actor_email: "intake@workline.internal",
    event: "submitted",
    details: { message: "Customer support ticket ingested and classified." },
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: 3,
    workspace_id: "ws_workline_main",
    run_id: "a1000000-0000-4000-8000-000000000003",
    actor_id: "usr_sub_001",
    actor_email: "j.miller@workline.internal",
    event: "submitted",
    details: { message: "Purchase requisition submitted with budget justification." },
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: 4,
    workspace_id: "ws_workline_main",
    run_id: "a1000000-0000-4000-8000-000000000003",
    actor_id: "usr_rev_001",
    actor_email: "reviewer@workline.internal",
    event: "approved",
    details: {
      note: "Approved. Solid ROI on reducing cloud inference egress fees. Send PO to accounting.",
    },
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 5,
    workspace_id: "ws_workline_main",
    run_id: "a1000000-0000-4000-8000-000000000004",
    actor_id: "usr_sub_002",
    actor_email: "elena.r@workline.internal",
    event: "submitted",
    details: { message: "Expense reimbursement submitted with receipt folio." },
    created_at: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
  },
  {
    id: 6,
    workspace_id: "ws_workline_main",
    run_id: "a1000000-0000-4000-8000-000000000004",
    actor_id: "usr_adm_002",
    actor_email: "admin@workline.internal",
    event: "approved",
    details: {
      note: "All hotel receipts verified against conference attendance itinerary.",
    },
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
  {
    id: 7,
    workspace_id: "ws_workline_main",
    run_id: "a1000000-0000-4000-8000-000000000005",
    actor_id: "usr_sub_003",
    actor_email: "intake@workline.internal",
    event: "submitted",
    details: { message: "Security policy exception submitted for change window." },
    created_at: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
  },
  {
    id: 8,
    workspace_id: "ws_workline_main",
    run_id: "a1000000-0000-4000-8000-000000000005",
    actor_id: "usr_adm_002",
    actor_email: "admin@workline.internal",
    event: "rejected",
    details: {
      note: "Rejected per compliance mandate. FIDO2 hardware tokens cannot be bypassed in production under any operational circumstances.",
    },
    created_at: new Date(Date.now() - 1000 * 60 * 460).toISOString(),
  },
  {
    id: 9,
    workspace_id: "ws_workline_main",
    run_id: "a1000000-0000-4000-8000-000000000006",
    actor_id: "usr_sub_003",
    actor_email: "intake@workline.internal",
    event: "submitted",
    details: { message: "Inventory replenish threshold alert triggered." },
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];

// In-memory runtime store shared within server process
let runsStore: WorkflowRunRow[] = [...INITIAL_RUNS];
let eventsStore: WorkflowEventRow[] = [...INITIAL_EVENTS];
let eventCounter = 100;

export function listWorkflowRuns(params?: {
  status?: WorkflowStatus;
  workspaceId?: string;
}): WorkflowRunRow[] {
  let items = [...runsStore];
  if (params?.workspaceId) {
    items = items.filter((r) => r.workspace_id === params.workspaceId);
  }
  if (params?.status) {
    items = items.filter((r) => r.status === params.status);
  }
  return items.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function getWorkflowRun(
  id: string,
  workspaceId?: string,
): WorkflowRunRow | undefined {
  return runsStore.find(
    (r) => r.id === id && (!workspaceId || r.workspace_id === workspaceId),
  );
}

export function submitWorkflowRun({
  idempotencyKey,
  templateId,
  input,
  analysis,
  actorEmail,
  actorId,
  workspaceId = "ws_workline_main",
}: {
  idempotencyKey: string;
  templateId: string;
  input: Record<string, unknown>;
  analysis: unknown;
  actorEmail: string;
  actorId: string;
  workspaceId?: string;
}): { run: WorkflowRunRow; created: boolean } {
  // Idempotency check:
  const existing = runsStore.find(
    (r) => r.idempotency_key === idempotencyKey && r.workspace_id === workspaceId,
  );

  if (existing) {
    // If exact same input:
    const existingInput = JSON.stringify(existing.input_data);
    const newInput = JSON.stringify(input);
    if (existingInput === newInput && existing.template_id === templateId) {
      return { run: existing, created: false };
    }
    // Changed input under existing idempotency key:
    throw new Error("IDEMPOTENCY_CONFLICT");
  }

  const now = new Date().toISOString();
  const runId = crypto.randomUUID();

  const newRun: WorkflowRunRow = {
    id: runId,
    workspace_id: workspaceId,
    idempotency_key: idempotencyKey,
    template_id: templateId,
    status: "pending_review",
    input_data: input as Json,
    analysis: analysis as Json,
    approved_output: null,
    attempts: 1,
    created_by: actorEmail || actorId,
    reviewed_by: null,
    decision_note: null,
    created_at: now,
    updated_at: now,
  };

  runsStore.unshift(newRun);

  // Add audit event
  eventsStore.push({
    id: ++eventCounter,
    workspace_id: workspaceId,
    run_id: runId,
    actor_id: actorId,
    actor_email: actorEmail,
    event: "submitted",
    details: {
      message: `Workflow case submitted for review by ${actorEmail}`,
    },
    created_at: now,
  });

  return { run: newRun, created: true };
}

export function reviewWorkflowRun({
  runId,
  decision,
  note,
  actorEmail,
  actorId,
  workspaceId = "ws_workline_main",
}: {
  runId: string;
  decision: "approve" | "reject";
  note: string;
  actorEmail: string;
  actorId: string;
  workspaceId?: string;
}): WorkflowRunRow {
  const index = runsStore.findIndex(
    (r) => r.id === runId && r.workspace_id === workspaceId,
  );
  if (index === -1) {
    throw new Error("NOT_FOUND");
  }

  const current = runsStore[index];
  if (!current) {
    throw new Error("NOT_FOUND");
  }

  if (current.status !== "pending_review") {
    throw new Error("ALREADY_DECIDED");
  }

  const now = new Date().toISOString();
  const newStatus: WorkflowStatus =
    decision === "approve" ? "approved" : "rejected";

  const approvedOutput =
    decision === "approve"
      ? {
          status: "APPROVED_FOR_PROCESSING",
          reviewer: actorEmail,
          instruction:
            "Manual review completed. Case is cleared for human action in designated operational system.",
          decided_at: now,
        }
      : null;

  const updatedRun: WorkflowRunRow = {
    ...current,
    status: newStatus,
    reviewed_by: actorEmail || actorId,
    decision_note: note.trim() || (decision === "approve" ? "Approved." : "Rejected."),
    approved_output: approvedOutput as Json,
    updated_at: now,
  };

  runsStore[index] = updatedRun;

  eventsStore.push({
    id: ++eventCounter,
    workspace_id: workspaceId,
    run_id: runId,
    actor_id: actorId,
    actor_email: actorEmail,
    event: decision === "approve" ? "approved" : "rejected",
    details: {
      decision,
      note: note.trim(),
      decided_by: actorEmail,
    },
    created_at: now,
  });

  return updatedRun;
}

export function listWorkflowEvents(
  runId: string,
  workspaceId?: string,
): WorkflowEventRow[] {
  return eventsStore
    .filter(
      (e) => e.run_id === runId && (!workspaceId || e.workspace_id === workspaceId),
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
}

// Reset store to seeds if needed (e.g., in automated tests)
export function resetStore(): void {
  runsStore = [...INITIAL_RUNS];
  eventsStore = [...INITIAL_EVENTS];
  eventCounter = 100;
}
