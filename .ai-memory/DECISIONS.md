# Decisions
Durable, verified decisions only. Format: `YYYY-MM-DD: decision. Why. Tradeoff. Revisit when.`
- 2026-10-31: Keep the default workflows dependency-free and offline, with optional local-only Ollama analysis. This meets the no-cost requirement without sending case data to a hosted model; rule-based categorization is less flexible than a real model. Revisit when a Maestro deployment or approved model integration is available.
- 2026-10-31: Require human approval before preparing payment-ready instructions or customer replies. This prevents the prototype from initiating financial or customer-facing actions.
