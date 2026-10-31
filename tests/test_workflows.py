import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from workflow_demo.agents import AgentError, _ask_local_model, analyze_ticket
from workflow_demo.service import WorkflowError, process_invoice, process_ticket
from workflow_demo.store import Store, StoreError


INVOICE = {
    "vendor": "Northstar Office Supply",
    "invoice_number": "NS-2026-1042",
    "invoice_date": "2026-10-28",
    "due_date": "2026-11-27",
    "currency": "USD",
    "subtotal": "920.00",
    "tax": "73.60",
    "total": "993.60",
    "description": "Replacement laptop docks",
}

TICKET = {
    "ticket_id": "SUP-2026-0081",
    "customer_name": "Jordan Lee",
    "subject": "Urgent: account login error",
    "message": "I cannot sign in after resetting my password.",
}


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp_dir.name) / "test.sqlite3")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_invoice_requires_review_and_creates_audit_events(self):
        run = process_invoice(INVOICE, self.store)

        self.assertEqual(run["status"], "pending_review")
        self.assertTrue(run["result"]["human_approval_required"])
        self.assertIn("no payment is sent", run["result"]["release_action"])
        self.assertEqual(
            [event["event"] for event in self.store.list_events("invoice", run["case_id"])],
            ["started", "analysis_completed"],
        )

    def test_invoice_total_must_reconcile_before_run_is_created(self):
        invoice = {**INVOICE, "total": "1000"}

        with self.assertRaisesRegex(WorkflowError, "subtotal plus tax"):
            process_invoice(invoice, self.store)

        self.assertEqual(self.store.list_runs(), [])

    def test_identical_repeat_is_idempotent_but_changed_invoice_is_rejected(self):
        first = process_invoice(INVOICE, self.store)
        second = process_invoice(INVOICE, self.store)

        self.assertEqual(first["created_at"], second["created_at"])
        self.assertEqual(len(self.store.list_events("invoice", first["case_id"])), 2)
        with self.assertRaisesRegex(StoreError, "different input"):
            process_invoice({**INVOICE, "description": "Changed after submission"}, self.store)

    def test_human_approval_is_required_and_only_happens_once(self):
        process_invoice(INVOICE, self.store)
        invoice = self.store.review(
            "invoice", INVOICE["invoice_number"], "approve", "Matched to PO."
        )
        self.assertEqual(invoice["result"]["payment_instruction"]["amount"], 993.6)
        self.assertFalse(invoice["result"]["payment_instruction"]["payment_executed"])

        process_ticket(TICKET, self.store)
        approved = self.store.review("support", TICKET["ticket_id"], "approve", "Draft checked.")

        self.assertEqual(approved["status"], "approved")
        self.assertEqual(approved["decision_note"], "Draft checked.")
        self.assertEqual(approved["result"]["approved_reply"], approved["result"]["draft_reply"])
        with self.assertRaisesRegex(StoreError, "not awaiting human review"):
            self.store.review("support", TICKET["ticket_id"], "approve")

    def test_rejection_does_not_create_an_approved_artifact(self):
        process_ticket(TICKET, self.store)
        rejected = self.store.review(
            "support", TICKET["ticket_id"], "reject", "Draft needs more detail."
        )

        self.assertEqual(rejected["status"], "rejected")
        self.assertNotIn("approved_reply", rejected["result"])
        self.assertEqual(
            self.store.list_events("support", TICKET["ticket_id"])[-1]["event"],
            "human_reject",
        )

    def test_support_triage_sets_urgent_route_and_does_not_send_reply(self):
        run = process_ticket(TICKET, self.store)

        self.assertEqual(run["result"]["category"], "account")
        self.assertEqual(run["result"]["priority"], "urgent")
        self.assertEqual(run["result"]["team"], "Account Support")
        self.assertIn("no message is sent", run["result"]["release_action"])

    def test_rules_engine_categorizes_ticket(self):
        ticket = {
            **TICKET,
            "subject": "Please review a refund",
            "message": "I was charged twice for this order.",
        }
        result = analyze_ticket(ticket, engine="rules")
        self.assertEqual(result["category"], "billing")

    def test_local_model_json_response_is_parsed(self):
        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return None

            def read(self):
                return b'{"response":"{\\"risk\\":\\"low\\",\\"summary\\":\\"Looks consistent.\\",\\"review_reasons\\":[]}"}'

        with patch("workflow_demo.agents.urlopen", return_value=FakeResponse()):
            result = _ask_local_model("invoice facts", "qwen2.5:3b")

        self.assertEqual(result["risk"], "low")

    def test_ollama_url_must_be_local(self):
        with patch.dict(os.environ, {"OLLAMA_HOST": "https://example.com"}):
            with self.assertRaisesRegex(AgentError, "must point to a local"):
                _ask_local_model("prompt", "qwen2.5:3b")

    def test_model_cannot_return_unrecognized_ticket_category(self):
        with patch(
            "workflow_demo.agents._ask_local_model",
            return_value={
                "category": "refund",
                "priority": "urgent",
                "summary": "Refund request.",
                "draft_reply": "We will review this.",
            },
        ):
            with self.assertRaisesRegex(AgentError, "invalid support analysis"):
                analyze_ticket(TICKET, engine="ollama")

    def test_unknown_engine_is_rejected(self):
        with self.assertRaisesRegex(AgentError, "Engine must be"):
            analyze_ticket(TICKET, engine="free-cloud")

    def test_agent_failure_is_recorded_and_can_be_retried(self):
        with patch(
            "workflow_demo.service.analyze_invoice",
            side_effect=[AgentError("model unavailable"), {
                "risk": "low",
                "summary": "Invoice checked.",
                "review_reasons": [],
            }],
        ):
            with self.assertRaisesRegex(AgentError, "model unavailable"):
                process_invoice(INVOICE, self.store, engine="ollama")
            run = process_invoice(INVOICE, self.store, engine="ollama")

        self.assertEqual(run["status"], "pending_review")
        self.assertEqual(run["attempts"], 2)
        self.assertEqual(
            [event["event"] for event in self.store.list_events("invoice", run["case_id"])],
            ["started", "failed", "retry_started", "analysis_completed"],
        )


if __name__ == "__main__":
    unittest.main()
