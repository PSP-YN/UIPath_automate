import json
from datetime import date
from decimal import Decimal, InvalidOperation

from .agents import AgentError, analyze_invoice, analyze_ticket


class WorkflowError(Exception):
    pass


def process_invoice(raw, store, engine="rules", model="qwen2.5:3b"):
    invoice = validate_invoice(raw)
    case_id = invoice["invoice_number"]
    if not store.begin_run("invoice", case_id, invoice):
        return store.get_run("invoice", case_id)
    try:
        analysis = analyze_invoice(invoice, engine, model)
    except AgentError:
        store.fail_run("invoice", case_id, "Agent analysis failed.")
        raise
    result = {
        **analysis,
        "total": invoice["total"],
        "currency": invoice["currency"],
        "human_approval_required": True,
        "release_action": "Create payment-ready instruction only after approval; no payment is sent.",
    }
    store.complete_run("invoice", case_id, result)
    return store.get_run("invoice", case_id)


def process_ticket(raw, store, engine="rules", model="qwen2.5:3b"):
    ticket = validate_ticket(raw)
    case_id = ticket["ticket_id"]
    if not store.begin_run("support", case_id, ticket):
        return store.get_run("support", case_id)
    try:
        analysis = analyze_ticket(ticket, engine, model)
    except AgentError:
        store.fail_run("support", case_id, "Agent analysis failed.")
        raise
    result = {
        **analysis,
        "human_approval_required": True,
        "release_action": "Approve the draft before sending; no message is sent automatically.",
    }
    store.complete_run("support", case_id, result)
    return store.get_run("support", case_id)


def validate_invoice(raw):
    if not isinstance(raw, dict):
        raise WorkflowError("Invoice input must be a JSON object.")
    required = (
        "vendor",
        "invoice_number",
        "invoice_date",
        "due_date",
        "currency",
        "subtotal",
        "tax",
        "total",
        "description",
    )
    values = {}
    for field in required:
        value = raw.get(field)
        if not isinstance(value, str) or not value.strip():
            raise WorkflowError(f"Invoice field '{field}' must be a non-empty string.")
        if len(value.strip()) > 500:
            raise WorkflowError(f"Invoice field '{field}' must be 500 characters or fewer.")
        values[field] = value.strip()
    for field in ("invoice_date", "due_date"):
        try:
            values[field] = date.fromisoformat(values[field]).isoformat()
        except (TypeError, ValueError) as error:
            raise WorkflowError(f"Invoice field '{field}' must be an ISO date.") from error
    currency = values["currency"]
    if len(currency) != 3 or not currency.isascii() or not currency.isalpha():
        raise WorkflowError("Invoice currency must be a three-letter code.")
    values["currency"] = currency.upper()
    amounts = {}
    for field in ("subtotal", "tax", "total"):
        try:
            amount = Decimal(str(values[field]))
        except (InvalidOperation, ValueError) as error:
            raise WorkflowError(f"Invoice field '{field}' must be a number.") from error
        if not amount.is_finite() or amount < 0:
            raise WorkflowError(f"Invoice field '{field}' must be a finite non-negative amount.")
        amounts[field] = amount
    if abs(amounts["subtotal"] + amounts["tax"] - amounts["total"]) > Decimal("0.01"):
        raise WorkflowError("Invoice total must equal subtotal plus tax.")
    values.update({field: float(amount) for field, amount in amounts.items()})
    return values


def validate_ticket(raw):
    if not isinstance(raw, dict):
        raise WorkflowError("Support input must be a JSON object.")
    required = ("ticket_id", "customer_name", "subject", "message")
    values = {}
    for field in required:
        value = raw.get(field)
        if not isinstance(value, str) or not value.strip():
            raise WorkflowError(f"Support field '{field}' is required.")
        value = value.strip()
        if field != "message" and len(value) > 200:
            raise WorkflowError(f"Support field '{field}' must be 200 characters or fewer.")
        if field == "message" and len(value) > 10000:
            raise WorkflowError("Support message must be 10,000 characters or fewer.")
        values[field] = value
    return values


def json_input(path):
    try:
        with open(path, encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        raise WorkflowError(f"Cannot read JSON input '{path}': {error}") from error
    if not isinstance(data, dict):
        raise WorkflowError(f"JSON input '{path}' must contain an object.")
    return data
