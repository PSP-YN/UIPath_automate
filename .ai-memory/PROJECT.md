# Project overview

- **Purpose:** Run two human-reviewed business workflow prototypes based on the Maestro Automate Challenge rules.
- **Stack:** Python 3.10+; Python standard library only.
- **Optional service:** Local Ollama inference; the default rule engine works offline.
- **Entry point:** `python3 -m workflow_demo`
- **Users and environments:** Local CLI users; case data and audit events stay in a local SQLite database.

## Commands

- `python3 -m workflow_demo demo` — run both sample cases.
- `python3 -m workflow_demo --db ./workflows.sqlite3 list` — inspect cases.
- `python3 -m unittest discover -s tests -v` — run tests.

## Structure

- `workflow_demo/agents.py` — deterministic and optional local-model analysis.
- `workflow_demo/service.py` — input validation and workflow orchestration.
- `workflow_demo/store.py` — SQLite state, review transitions, and audit history.
- `workflow_demo/__main__.py` — CLI.
- `samples/` — sample invoice and support-ticket JSON.
- `tests/` — standard-library unit and workflow tests.
- `README.md` — setup, operation, and contest scope notes.

## Conventions and constraints

- No payment or customer message is sent. Every case pauses for human review.
- Workflow IDs are idempotent for identical input; changed input under an existing ID is rejected.
- Failed model analysis can be retried and is recorded in the audit history.
- The contest-rules PDF is local source material and excluded from the public repository.
