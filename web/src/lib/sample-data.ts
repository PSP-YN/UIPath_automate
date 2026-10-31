export const SAMPLE_INPUTS: Record<string, Record<string, string>> = {
  "invoice-review": {
    vendor: "Meridian Logistics Inc",
    invoice_number: "INV-2026-904",
    invoice_date: "2026-10-25",
    due_date: "2026-11-24",
    currency: "USD",
    subtotal: "2850.00",
    tax: "256.50",
    total: "3106.50",
    description: "Palletized freight transit and bonded warehousing services.",
  },
  "support-triage": {
    ticket_id: "TCK-5521",
    customer_name: "Liam O'Connor",
    customer_email: "liam@fintechcore.io",
    subject: "Urgent: Webhook payload signature mismatch",
    message:
      "Our verification service reports HMAC SHA256 failure on production payment webhooks starting 10:15 UTC. Need temporary grace period or key sync.",
  },
  "purchase-request": {
    requester_email: "dev.team@workline.internal",
    department: "Platform Engineering",
    vendor: "Datadog Cloud Monitoring",
    item: "APM Tracing Enterprise Ingestion Pack (Annual)",
    requested_amount: "4200.00",
    budget_available: "12000.00",
    currency: "USD",
    business_reason:
      "Distributed tracing visibility for microservices latency reduction and SLO alerting.",
  },
  "expense-reimbursement": {
    employee_email: "claire.chen@workline.internal",
    category: "Client Meeting",
    amount: "145.20",
    currency: "USD",
    receipt_reference: "RCPT-NY-883",
    description: "Dinner discussion with strategic supplier account leads.",
  },
  "employee-onboarding": {
    employee_name: "Kavita Raman",
    employee_email: "kavita.r@workline.internal",
    role_title: "Senior Reliability Engineer",
    department: "Cloud Operations",
    start_date: "2026-11-15",
    manager_email: "marcus.vance@workline.internal",
    hardware_spec: "Standard Unix Engineering Laptop",
  },
  "leave-request": {
    employee_name: "David Kim",
    leave_type: "Annual Paid Leave",
    start_date: "2026-12-22",
    end_date: "2026-12-29",
    coverage_colleague: "Sarah Jenkins",
    reason: "Year-end family leave. Shift coverage confirmed with team lead.",
  },
  "contract-intake": {
    counterparty: "Atlas Data Pipeline Technologies",
    contract_type: "Software License Agreement",
    effective_date: "2026-11-10",
    governing_law: "California",
    liability_cap: "2x Annual Contract Value",
    notes: "Mutual IP protection clauses reviewed and confirmed.",
  },
  "lead-qualification": {
    company: "Helios Energy Solutions",
    contact_name: "Arthur Pendelton",
    contact_email: "arthur@helios-energy.com",
    employee_count: "250",
    annual_revenue: "15000000",
    primary_interest: "Workflow Automation & Governance Workbench",
  },
  "sales-quote-approval": {
    customer: "Global Maritime Freight Corp",
    quote_reference: "QTE-2026-081",
    total_contract_value: "84000.00",
    standard_discount_percent: "12",
    requested_discount_percent: "15",
    justification: "Multi-year enterprise commitment with 3-year upfront payment.",
  },
  "it-access-request": {
    user_email: "elena.r@workline.internal",
    system: "Production Kubernetes Read-Only Observability",
    access_level: "Read-Only Auditor",
    business_justification:
      "Audit verification of container runtime security logs.",
    duration_days: "30",
  },
  "inventory-reorder": {
    item_name: "Heavy-Duty Thermal Barcode Ribbon (Pack of 12)",
    sku: "RBN-THM-12PK",
    current_stock: "8",
    reorder_threshold: "20",
    suggested_quantity: "60",
    supplier: "Industrial Barcode Direct",
  },
  "policy-exception": {
    policy_area: "Information Security",
    requester: "Site Operations",
    exception_description:
      "Temporary allowance for staging cluster egress to vendor sandbox.",
    risk_assessment:
      "Low. Staging environment contains only synthetic anonymized test fixtures.",
    mitigation:
      "Egress port limited to TLS 443 with automated teardown after 48 hours.",
  },
};

export function getSampleInput(workflowId: string): Record<string, string> {
  return SAMPLE_INPUTS[workflowId] ? { ...SAMPLE_INPUTS[workflowId] } : {};
}
