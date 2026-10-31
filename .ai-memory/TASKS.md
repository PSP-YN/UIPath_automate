# Tasks (newest first)
Keep at most 15 entries; move older ones to TASKS.archive.md.

## Current goal
- None recorded.

## Log
- 2026-10-31: Removed Supabase dependency in favor of a 100% self-contained Next.js architecture (Web Crypto HMAC signed sessions, in-memory/serverless cases store with pre-seeded queues, idempotency, and audit trails). Overhauled UI with quick 1-click persona sign-in, case queue status counters, formatted rule checks, auto-fill sample data, and responsive design. Deployed to Vercel production at https://workline-workbench.vercel.app. Verification: 9 Vitest tests, typecheck, ESLint, Next.js production build, 12 Python unittest suite, live production HTTP 200 checks, production API login, session retrieval, pending review listing, and case approval with audit event creation.
- 2026-10-31: Expanded the repository with a 12-template Next.js/Supabase workflow workbench, invite-only auth flow, case submission/review UI, audit history, and landing/demo pages. Files: `web/`, `catalog/`, `supabase/`, `README.md`, `DESIGN.md`, `.ai-memory/`. Verification: web lint, typecheck, 9 Vitest tests, production build, Python 12-test suite, production `npm audit` (0 advisories), browser click-through and 320px overflow checks passed. Blockers: no app-specific Supabase project/credentials; local Supabase containers failed to start due registry/network timeouts; Vercel deployment and authenticated-database E2E cannot be completed without project config. Next: provision a separate Supabase project, seed owner, validate migration/RLS, configure Vercel and verify the hosted app; Maestro integration/demo submission remains separate work.
- 2026-10-31: Built and published the invoice-review and support-triage prototypes as public `PSP-YN/UIPath_automate`. Files: workflow package, tests, sample inputs, README, and project notes. Verification: 12 unit tests, bytecode compilation, CLI demo/re-run/approval/audit smoke checks, GitHub visibility `PUBLIC`, and clean `main` tracking `origin/main`. Next: none.
- 2026-10-31: AgentKit memory initialised. Verification: generated memory files inspected. Next: none.
