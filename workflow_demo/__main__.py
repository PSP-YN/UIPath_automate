import argparse
import json
import sys
from pathlib import Path

from .agents import AgentError
from .service import WorkflowError, json_input, process_invoice, process_ticket
from .store import Store, StoreError


DEFAULT_DB = Path.home() / ".local/share/uipath_automate/workflows.sqlite3"
SAMPLES = Path(__file__).resolve().parent.parent / "samples"


def build_parser():
    parser = argparse.ArgumentParser(
        prog="workflow-demo",
        description="Run free, local-first workflows with human approval gates.",
    )
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="SQLite database path.")
    commands = parser.add_subparsers(dest="command", required=True)

    run = commands.add_parser("run", help="Start a workflow from a JSON file.")
    run.add_argument("workflow", choices=("invoice", "support"))
    run.add_argument("input", type=Path)
    run.add_argument("--engine", choices=("rules", "ollama"), default="rules")
    run.add_argument("--model", default="qwen2.5:3b")

    demo = commands.add_parser("demo", help="Run both sample workflows.")
    demo.add_argument("--engine", choices=("rules", "ollama"), default="rules")
    demo.add_argument("--model", default="qwen2.5:3b")

    review = commands.add_parser("review", help="Approve or reject a pending case.")
    review.add_argument("workflow", choices=("invoice", "support"))
    review.add_argument("case_id")
    review.add_argument("decision", choices=("approve", "reject"))
    review.add_argument("--note", default="")

    listing = commands.add_parser("list", help="List workflow cases.")
    listing.add_argument(
        "--status",
        choices=("processing", "pending_review", "approved", "rejected", "failed"),
    )

    events = commands.add_parser("events", help="Show the audit history for a case.")
    events.add_argument("workflow", choices=("invoice", "support"))
    events.add_argument("case_id")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    store = Store(args.db)
    try:
        if args.command == "run":
            raw = json_input(args.input)
            result = _process(store, args.workflow, raw, args.engine, args.model)
            _print(result)
        elif args.command == "demo":
            invoice = json_input(SAMPLES / "invoice.json")
            ticket = json_input(SAMPLES / "support_ticket.json")
            _print(_process(store, "invoice", invoice, args.engine, args.model))
            _print(_process(store, "support", ticket, args.engine, args.model))
        elif args.command == "review":
            workflow = "support" if args.workflow == "support" else "invoice"
            _print(store.review(workflow, args.case_id, args.decision, args.note))
        elif args.command == "list":
            _print(store.list_runs(args.status))
        elif args.command == "events":
            workflow = "support" if args.workflow == "support" else "invoice"
            _print(store.list_events(workflow, args.case_id))
    except (AgentError, StoreError, WorkflowError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


def _process(store, workflow, data, engine, model):
    processor = process_ticket if workflow == "support" else process_invoice
    return processor(data, store, engine, model)


def _print(value):
    print(json.dumps(value, indent=2, sort_keys=True))


if __name__ == "__main__":
    raise SystemExit(main())
