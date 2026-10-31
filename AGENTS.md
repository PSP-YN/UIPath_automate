<!-- AGENTKIT-PROJECT-START -->
# Project agent instructions
Global rules come from the user's AgentKit. Project specifics:
- Memory: `.ai-memory/PROJECT.md` (map + commands), `TASKS.md` (rolling log), `DECISIONS.md` (durable decisions). Read PROJECT + TASKS before non-trivial work; trust source code over notes.
- After meaningful work append to TASKS.md. Keep at most 15 entries there; move older ones to `TASKS.archive.md`.
- `agentkit scan` prints a compact repo map; use it instead of exploring file by file.
- Run the commands listed in PROJECT.md. Never claim a check passed unless you ran it.
- Never put secrets in memory files, docs or commits.
<!-- AGENTKIT-PROJECT-END -->

## Product UI direction

- Read `DESIGN.md` before changing the landing page or workspace UI.
- Keep claims tied to implemented behavior. Do not invent customer proof, operational metrics, or compliance certifications.
- Preserve human approval gates. The app does not send messages, create accounts, issue payments, place orders, or change external systems.
- Keep the sample experience clearly identified as a demo, separate from authenticated company records.
