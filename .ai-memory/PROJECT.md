# Project overview

- **Purpose:** Provide local Python workflow demos and a web workbench prototype for human-reviewed business operations.
- **Stack:** Python 3.10+ standard library; Next.js 16, React 19, TypeScript, Web Crypto signed sessions, Zod, Vitest.
- **Optional service:** Local Ollama inference for the Python CLI; the Next.js web application is 100% self-contained and requires zero external databases or third-party paid services.
- **Entry points:** `python3 -m workflow_demo`; `web/src/app/page.tsx`; workspace APIs under `web/src/app/api/`.
- **Users and environments:** Local CLI users and web workspace staff. Live production deployment at https://workline-workbench.vercel.app.

## Commands

- `python3 -m workflow_demo demo` — run both sample cases.
- `python3 -m workflow_demo --db ./workflows.sqlite3 list` — inspect cases.
- `python3 -m unittest discover -s tests -v` — run tests.
- `cd web && npm ci && npm run dev` — install and start the web app.
- `cd web && npm run lint && npm run typecheck && npm test && npm run build` — validate the web app.
- `cd web && npx vercel deploy --prod --yes` — deploy to Vercel production.

## Structure

- `workflow_demo/agents.py` — deterministic and optional local-model analysis.
- `workflow_demo/service.py` — input validation and workflow orchestration.
- `workflow_demo/store.py` — SQLite state, review transitions, and audit history.
- `workflow_demo/__main__.py` — CLI.
- `catalog/workflows.json` — definitions for the 12 web templates.
- `web/src/app/` — public landing/demo, instant-role login, workspace queue, and API routes.
- `web/src/lib/auth/` — signed cookie session and demo operational personas.
- `web/src/lib/store/cases.ts` — serverless workflow cases and audit event store with pre-seeded operational queues and idempotency.
- `web/src/lib/workflow-engine.ts` — deterministic validation and analysis for all web templates.
- `samples/` — sample invoice and support-ticket JSON.
- `tests/` — standard-library unit and workflow tests.
- `web/src/lib/workflow-engine.test.ts` — web catalog and analysis tests.
- `README.md` — setup, operation, and contest scope notes.

## Conventions and constraints

- No payment or customer message is sent. Every case pauses for human review.
- Workflow IDs are idempotent for identical input; changed input under an existing ID is rejected.
- Failed model analysis can be retried and is recorded in the audit history.
- The contest-rules PDF is local source material and excluded from the public repository.
- Decisions create manual instructions; no external business action is executed.
- Hosted deployment is live on Vercel without requiring external third-party services.
