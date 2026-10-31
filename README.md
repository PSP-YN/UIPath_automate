# UIPath_automate

This repository contains two free, local-first Python workflow demos and a web workbench prototype inspired by the UiPath Agents at Work: The Maestro Automate Challenge.

The web catalog includes these 12 human-reviewed workflows:

- Supplier invoice review
- Customer support triage
- Purchase request
- Expense reimbursement
- Employee onboarding
- Leave request
- Contract intake
- Lead qualification
- Sales quote approval
- IT access request
- Inventory reorder review
- Policy exception intake

The web analysis is deterministic. Every approval is a manual instruction; no payment, message, account, order, or external-system change is executed. The public browser demo keeps sample input in page state only. The signed-in operational workspace is 100% self-contained with signed sessions, pre-seeded operational queues, and immutable audit logs.

Live production deployment: [https://workline-workbench.vercel.app](https://workline-workbench.vercel.app)

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

## Web workbench

The Next.js app is in [`web/`](./web/). It includes a public browser demo and an invite-only workspace with case submission, reviewer decisions, and an audit history. It is not connected to a hosted database or deployed by default.

Run the app locally:

```bash
cd web
npm ci
cp .env.example .env.local
npm run dev
```

The public demo works without environment variables. The staff workspace shows a setup state until all three values below are configured:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Keep the service-role key server-side. Never use a `NEXT_PUBLIC_` prefix for it.

### Configure a separate Supabase project

1. Create a new Supabase project for this app. Do not reuse a project containing unrelated business data.
2. From the repository root, link the Supabase CLI to that project and apply the migration:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

3. Keep public signups disabled. In the Supabase Auth URL configuration, set the site URL to the deployed app and allow the callback URL `https://YOUR_APP_DOMAIN/auth/callback`. For local testing, also allow `http://localhost:3000/auth/callback`.
4. Invite the first user from Supabase Auth. Copy that invited user's Auth UUID, then add the workspace owner in the Supabase SQL editor before they accept the invite:

   ```sql
   insert into public.workspace_members (workspace_id, user_id, role)
   values (
     '7d380700-0f5a-4f3d-b48a-f942013f8172',
     'YOUR_AUTH_USER_UUID',
     'owner'
   )
   on conflict (workspace_id, user_id)
   do update set role = excluded.role;
   ```

   The configured invite callback URL must be `https://YOUR_APP_DOMAIN/auth/callback?next=/account/setup`. The callback opens a password setup screen before the user enters the workspace.
5. Add future invited users to `workspace_members` with the least-privileged role they need: `member`, `reviewer`, or `admin`.
6. Configure the three environment variables in the local `.env.local` file or in your hosting provider. Check `/api/health`; it returns `{"status":"ok"}` when the database is reachable.

The migration creates one workspace and uses row-level security for member reads. Workspace writes and review decisions go through server-only functions. Before entering real employee, financial, customer, or contract data, confirm data residency, retention, access policies, backups, incident response, and applicable legal requirements for your organization.

### Deploy to Vercel

Create a Vercel project connected to this repository with `web` as the root directory. Set the three Supabase environment variables in the Vercel project settings, add the production callback URL to Supabase Auth, and deploy. Verify the production landing page, `/api/health`, invitation flow, role boundaries, case submission, review, and audit history before inviting staff. A production deployment is not ready until the Supabase project is provisioned and those end-to-end checks pass.

Run the web quality checks from `web/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Contest notes

The provided rules call for an end-to-end Maestro Automate project, coding-agent collaboration, multiple actors, testing, and a narrated demo video. This repository provides runnable local workflow prototypes, not a deployed UiPath Maestro project. The default engine is deterministic; the optional local model adds AI-assisted analysis but does not connect to UiPath Maestro or external business systems. Before a contest submission, import or recreate these flows in Maestro, record and link the required narrated video, and complete the official submission form. The source regulation PDF is intentionally not redistributed in this public repository.
