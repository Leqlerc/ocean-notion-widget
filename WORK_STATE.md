# NOcean Work State

- Last verified: 2026-09-22
- Verified against commit: `2e89249de39db9fca237571035d76eefa569b19c`
- Current branch: `main`

## Current Product State

NOcean is a production-deployed, framework-free HTML/CSS/JavaScript dashboard with Python Vercel functions. Primary navigation is exactly Home / Projects / Athletics / Settings.

- Home provides task planning, trusted coursework/deadlines, events and calendar workload, compact campus/dining signals, and device-local appearance preferences.
- Projects provides Notion-backed project selection, lifecycle, goals/milestones, task progress, and progressive loading.
- Athletics is intentionally a placeholder shell linking to the preserved `/machine.html` tracker for training, nutrition, sleep, habits, maintenance, and reflection.
- Settings owns appearance, dashboard preferences, class/maintenance configuration, and Outlook/Brightspace connections.
- Notion remains authoritative for Tasks, Projects, training records, and existing calendar data. Google/Notion calendar behavior is preserved. Outlook and Brightspace use the implemented integration boundary and encrypted server-side storage.

The reviewed usability refinement is on `main`. Production deployment `dpl_A1w5WWew7YbmbThDdoMwVEJHn8rC` reached READY for commit `235baf29db8774dc0dee03eeb2a8ab273dc13e48`; the current commit only records that verified promotion. The pre-sketch production state remains protected on `backup/pre-sketch-ui-production-2026-09-21` at `ef321263fc7d7d0c689e6999ace9a63f48af3cdf`.

## Active Work

None. Start new product work from observed usage and an explicit task, not from the historical plans removed from this file.

## Remaining Known Work

- Shape the Athletics dashboard before introducing new records or workflows; the existing Machine tracker remains the working system.
- The SQL Goals foundation and import tooling are additive but inactive. Hosted Preview verification, a server-verified owner identity boundary, authenticated Goals APIs, and an explicit cutover decision are still required before SQL can become authoritative.
- Nutrition, sleep, maintenance, reflections, coursework verification, and appearance preferences remain device-local; cross-device persistence is not implemented.

## Known Bugs

No confirmed current application bugs are recorded at this checkpoint.

## Important Architecture

- Keep browser modules static and API handlers thin; domain and provider behavior belongs in `lib/`.
- Preserve task planning dates independently from deadlines, existing provider normalization, partial-failure reporting, and conservative/idempotent integration reconciliation.
- Existing integration credentials and private feed URLs stay server-side. Never infer coursework completion from a calendar feed or mutate user planning/completion/project/difficulty during reconciliation.
- The SQL migrations and operator scripts do not authorize a production cutover. Notion remains authoritative until a separately verified migration and rollback plan is approved.

## Recent Decisions

- The four-destination navigation and current product boundaries are intentional.
- The Athletics shell must reuse the working Machine tracker until real usage defines a replacement.
- Calendar heat counts active Tasks plus trusted coursework, not ordinary events. Appearance accents must not change semantic workload or occupancy colors.
- Prefer progressive rendering and cached successful reads for slow Notion-backed Projects paths.

## Verification

For the promoted product tree, every CommonJS suite passed with `jsdom` supplied outside the repository. Python discovery ran 72 tests: 66 passed and six disposable-database tests skipped. JavaScript syntax checks, Python compilation, and `git diff --check` passed. The stable production routes for Home, Projects, Athletics, and Settings returned HTTP 200. These are checkpoint results, not a substitute for rerunning focused checks after future changes.
