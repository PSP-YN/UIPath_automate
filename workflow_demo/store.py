import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


class StoreError(Exception):
    pass


class Store:
    def __init__(self, path):
        self.path = Path(path).expanduser()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS workflow_runs (
                    workflow TEXT NOT NULL,
                    case_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    input_json TEXT NOT NULL,
                    result_json TEXT,
                    attempts INTEGER NOT NULL,
                    decision_note TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (workflow, case_id)
                );
                CREATE TABLE IF NOT EXISTS workflow_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    workflow TEXT NOT NULL,
                    case_id TEXT NOT NULL,
                    event TEXT NOT NULL,
                    details TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                """
            )

    def _connect(self):
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        return connection

    def begin_run(self, workflow, case_id, input_data):
        serialized = json.dumps(input_data, sort_keys=True)
        now = _now()
        with self._connect() as connection:
            existing = connection.execute(
                "SELECT status, input_json FROM workflow_runs WHERE workflow = ? AND case_id = ?",
                (workflow, case_id),
            ).fetchone()
            if existing:
                if existing["input_json"] != serialized:
                    raise StoreError(
                        f"{workflow} case '{case_id}' already exists with different input."
                    )
                if existing["status"] == "failed":
                    connection.execute(
                        """UPDATE workflow_runs
                           SET status = 'processing', attempts = attempts + 1, updated_at = ?
                           WHERE workflow = ? AND case_id = ?""",
                        (now, workflow, case_id),
                    )
                    self._event(connection, workflow, case_id, "retry_started", {})
                    return True
                return False
            connection.execute(
                """INSERT INTO workflow_runs
                   (workflow, case_id, status, input_json, attempts, created_at, updated_at)
                   VALUES (?, ?, 'processing', ?, 1, ?, ?)""",
                (workflow, case_id, serialized, now, now),
            )
            self._event(connection, workflow, case_id, "started", {})
            return True

    def complete_run(self, workflow, case_id, result):
        now = _now()
        with self._connect() as connection:
            updated = connection.execute(
                """UPDATE workflow_runs
                   SET status = 'pending_review', result_json = ?, updated_at = ?
                   WHERE workflow = ? AND case_id = ? AND status = 'processing'""",
                (json.dumps(result, sort_keys=True), now, workflow, case_id),
            ).rowcount
            if updated != 1:
                raise StoreError(f"Cannot complete {workflow} case '{case_id}'.")
            self._event(connection, workflow, case_id, "analysis_completed", result)

    def fail_run(self, workflow, case_id, message):
        now = _now()
        with self._connect() as connection:
            connection.execute(
                """UPDATE workflow_runs SET status = 'failed', updated_at = ?
                   WHERE workflow = ? AND case_id = ? AND status = 'processing'""",
                (now, workflow, case_id),
            )
            self._event(connection, workflow, case_id, "failed", {"message": message})

    def review(self, workflow, case_id, decision, note=""):
        if decision not in {"approve", "reject"}:
            raise StoreError("Decision must be 'approve' or 'reject'.")
        if workflow not in {"invoice", "support"}:
            raise StoreError("Workflow must be 'invoice' or 'support'.")
        if not isinstance(note, str) or len(note) > 1000:
            raise StoreError("Review note must be a string of 1,000 characters or fewer.")
        status = "approved" if decision == "approve" else "rejected"
        with self._connect() as connection:
            row = connection.execute(
                """SELECT input_json, result_json FROM workflow_runs
                   WHERE workflow = ? AND case_id = ? AND status = 'pending_review'""",
                (workflow, case_id),
            ).fetchone()
            if row is None:
                raise StoreError(
                    f"{workflow} case '{case_id}' is not awaiting human review."
                )
            result = json.loads(row["result_json"])
            artifact = None
            if decision == "approve" and workflow == "invoice":
                invoice = json.loads(row["input_json"])
                artifact = {
                    "vendor": invoice["vendor"],
                    "invoice_number": invoice["invoice_number"],
                    "amount": result["total"],
                    "currency": result["currency"],
                    "status": "ready_for_manual_payment",
                    "payment_executed": False,
                }
                result["payment_instruction"] = artifact
            elif decision == "approve":
                artifact = result["draft_reply"]
                result["approved_reply"] = artifact
            updated = connection.execute(
                """UPDATE workflow_runs
                   SET status = ?, decision_note = ?, result_json = ?, updated_at = ?
                   WHERE workflow = ? AND case_id = ? AND status = 'pending_review'""",
                (
                    status,
                    note.strip(),
                    json.dumps(result, sort_keys=True),
                    _now(),
                    workflow,
                    case_id,
                ),
            ).rowcount
            if updated != 1:
                raise StoreError(
                    f"{workflow} case '{case_id}' is not awaiting human review."
                )
            self._event(
                connection,
                workflow,
                case_id,
                f"human_{decision}",
                {"note": note.strip(), "approved_artifact": artifact},
            )
        return self.get_run(workflow, case_id)

    def get_run(self, workflow, case_id):
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM workflow_runs WHERE workflow = ? AND case_id = ?",
                (workflow, case_id),
            ).fetchone()
        if row is None:
            raise StoreError(f"No {workflow} case found with ID '{case_id}'.")
        return _run_dict(row)

    def list_runs(self, status=None):
        query = "SELECT * FROM workflow_runs"
        parameters = ()
        if status:
            query += " WHERE status = ?"
            parameters = (status,)
        query += " ORDER BY created_at, workflow, case_id"
        with self._connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [_run_dict(row) for row in rows]

    def list_events(self, workflow, case_id):
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT event, details, created_at FROM workflow_events
                   WHERE workflow = ? AND case_id = ? ORDER BY id""",
                (workflow, case_id),
            ).fetchall()
        return [
            {"event": row["event"], "details": json.loads(row["details"]), "created_at": row["created_at"]}
            for row in rows
        ]

    @staticmethod
    def _event(connection, workflow, case_id, event, details):
        connection.execute(
            """INSERT INTO workflow_events (workflow, case_id, event, details, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (workflow, case_id, event, json.dumps(details, sort_keys=True), _now()),
        )


def _run_dict(row):
    return {
        "workflow": row["workflow"],
        "case_id": row["case_id"],
        "status": row["status"],
        "input": json.loads(row["input_json"]),
        "result": json.loads(row["result_json"]) if row["result_json"] else None,
        "attempts": row["attempts"],
        "decision_note": row["decision_note"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _now():
    return datetime.now(timezone.utc).isoformat()
