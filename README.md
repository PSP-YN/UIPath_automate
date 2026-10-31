# UIPath_automate

Two free, local-first workflow demos inspired by the UiPath Agents at Work: The Maestro Automate Challenge:

1. **Supplier invoice review** validates invoice fields and totals, flags large invoices, and pauses for human approval before producing a payment instruction marked for manual payment. It never initiates a payment.
2. **Customer-support triage** classifies and routes a request, drafts a response, and pauses for human approval before saving the approved reply. It never sends a message.

Both workflows start from a JSON file or the included sample data, store cases and audit events in SQLite, and can retry a failed analysis. Re-running an identical case is idempotent; reusing its ID with changed input is rejected.

## Requirements

- Python 3.10 or later
- No packages to install; the default rule-based engine uses only the Python standard library.
- Optional AI analysis: [Ollama](https://ollama.com/) running locally with a model such as `qwen2.5:3b`. This uses local inference, not a hosted API or paid service.

## Run

From the repository root:

```bash
python3 -m workflow_demo demo
```

By default, the SQLite database is stored at `~/.local/share/uipath_automate/workflows.sqlite3`. To keep a demo database in the current directory:

```bash
python3 -m workflow_demo --db ./workflows.sqlite3 demo
```

The demo creates two cases in `pending_review`. Review them explicitly:

```bash
python3 -m workflow_demo --db ./workflows.sqlite3 list --status pending_review
python3 -m workflow_demo --db ./workflows.sqlite3 review invoice NS-2026-1042 approve --note "Matched to the purchase order."
python3 -m workflow_demo --db ./workflows.sqlite3 review support SUP-2026-0081 reject --note "Please revise the draft."
python3 -m workflow_demo --db ./workflows.sqlite3 events support SUP-2026-0081
```

Start a single case from your own JSON file:

```bash
python3 -m workflow_demo --db ./workflows.sqlite3 run invoice path/to/invoice.json
python3 -m workflow_demo --db ./workflows.sqlite3 run support path/to/ticket.json
```

See [`samples/`](./samples/) for the required input shapes. A rejected or approved case cannot be reviewed again; correct a failed analysis by re-running the same unchanged input. Cases and audit history are stored locally and are not sent anywhere by the default engine.

## Optional local AI analysis

Install and start Ollama, then download a model once:

```bash
ollama pull qwen2.5:3b
python3 -m workflow_demo --db ./workflows.sqlite3 demo --engine ollama --model qwen2.5:3b
```

The app only sends model requests to a loopback Ollama host (`127.0.0.1`, `localhost`, or `::1`). Set `OLLAMA_HOST` only if Ollama listens on a different local port, for example `http://127.0.0.1:11434`. If it is unavailable or returns invalid data, the case is marked failed and can be retried; use the default `rules` engine without Ollama.

The agent proposes analysis; it cannot approve an invoice or send a customer response. Validate any model-generated analysis before taking action.

## Verify

```bash
python3 -m unittest discover -s tests -v
```

The tests cover input validation, invoice reconciliation, idempotency, audit events, retries, model response validation, and human-approval gates.

## Contest notes

The provided rules call for an end-to-end Maestro Automate project, coding-agent collaboration, multiple actors, testing, and a narrated demo video. This repository provides runnable local workflow prototypes, not a deployed UiPath Maestro project. The default engine is deterministic; the optional local model adds AI-assisted analysis but does not connect to UiPath Maestro or external business systems. Before a contest submission, import or recreate these flows in Maestro, record and link the required narrated video, and complete the official submission form. The source regulation PDF is intentionally not redistributed in this public repository.
