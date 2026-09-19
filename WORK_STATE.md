# NOcean Work State

Updated: 2026-09-19. Authoritative continuation checkpoint.

## Current objective
Run 2: preserve completed Tasks; establish a tested PostgreSQL migration/import foundation for Goals, then extend Projects using the existing authoritative records where safe. No production SQL or authentication claim until provisioned and verified.

## Completed
- Prior work: working Home/Training pages, Notion tasks/projects/sets, direct Google + Notion calendar merge, Purdue dining menus, local appearance and SVG icons.
- Latest main inspected; user-uploaded assets and layout changes retained. One uncommitted CSS comment from previous Work saved in git stash before fast-forward.

- Added `Planning Mode` select to existing Tasks database; reused Do date. No task data backfill. See migrations/001_notion_task_planning.md.
- Added shared nocean-data.js transport and nocean-planning.js policy. Tasks page uses same /api/tasks records as Home. Date-only deadlines retain 23:59 local behavior.
- Today honors explicit plans; old incomplete plans roll over; Tomorrow is distinct; Upcoming covers days 2–14; Later includes explicit Backlog and longer/undated tasks.

## In progress
- Run 2 foundation checkpoint: current main is e32e696; worktree clean before changes; remote WORK_STATE matches local. Production Projects and Tasks endpoints respond.
- Vercel access rechecked: 403 for team_dU7W9Acdpgi8v6eLzDGS0TP1 / yiqwill-3102. Do not repeat this blocked connector call.
- Next implement migration ledger, owner-scoped Goals schema, and safe dry-run Notion project import. Keep inactive until Preview database and owner authentication are verified.

## Next actions
1. Review this checkpoint and docs/persistence-architecture.md; Tasks functional and mobile checks are complete.
2. Restore Vercel team authorization, then implement authenticated owner boundary and provision Preview SQL. See docs/persistence-architecture.md for entity relationships, migration sequence, idempotency and integration boundaries.
3. Build Goals workspaces as the next complete unit with applied/verified related schema. Routines follows; neither is implemented in this checkpoint.
4. Replace all-task initial loads with server pagination plus separate project progress aggregates; keep existing totals correct.

## Architectural decisions
- Current runtime: static HTML/vanilla JS + Python stdlib serverless APIs, deployed GitHub main -> Vercel.
- Existing authoritative data: Notion Tasks, Projects, Daily Training, Exercises and Sets. Keep stable IDs and relations; no bulk migration without validation/reconciliation.
- Existing appearance remains local and separate from application records.
- No growing user data or credentials in source control. New SQL schemas must be normalized, indexed, and migrated explicitly.
- Current API checks request origin but has no user authentication. Resolve this boundary before adding sensitive integration credentials or exposing new database-backed APIs.

## External setup required
- Vercel connector denied project team scope yiqwill-3102 (403). Reauthorize that scope before SQL provisioning/environment changes. No SQL URL, Vercel token or CLI authentication exists in this workspace. Existing GitHub -> Vercel deploy remains usable. Exact user action: reconnect/reauthorize the Vercel connector with access to team yiqwill-3102 (team_dU7W9Acdpgi8v6eLzDGS0TP1). Then connect a managed PostgreSQL database to this project’s Preview environment with a server-only DATABASE_URL. Production cutover requires separate reconciliation and an authenticated owner boundary. No browser workaround attempted.
- Microsoft Graph requires a registered application and user/tenant authorization; not connected by this run.
- Purdue Brightspace access method not yet verified; no direct sync claim.

## Problems / blockers
- Work may end without notice; update this file and push each coherent checkpoint.
- Prior visual pass had no final documentation checkpoint. Its three implementation commits are deployed; browser checks performed for message/art/icon persistence and mobile macro alignment.

## Verification status
- Implemented and tested before this run: 36 Python tests and frontend/UI/filter/deadline/appearance/icon contracts; prior production visual checks.
- Implemented and tested this run: 40 Python tests; planning, deadline, frontend and UI JS contracts. Production Tasks create, Today/Tomorrow/Backlog moves, reload persistence, matching Home Tomorrow, edit difficulty without moving deadline, completion/reopen/Undo, and archive passed. Disposable QA record archived and absent after refresh. Local deadline label and stale Undo fixes deployed in 58ce3d6 (Vercel success).
- Production verified in 8230a2c (Vercel success): shared navigation, 390px capture/queue/long-name layout, and existing Direct Google Calendar + Notion source indicator.
- Implemented but not fully tested: no additional unfinished feature implementation. Error rollback is covered by existing frontend contracts; no intentional live backend outage was induced.
- Pre-existing test failure: tests/test_appearance.cjs expects exactly 12 assets, but latest user main 178a9b8 already contains 17. Appearance implementation was unchanged by this run; assertion needs revising in a future appearance checkpoint. Planning/deadline/filter/icon/frontend/UI tests pass.
- Known scaling limitation: Tasks displays 25 records at a time but /api/tasks still loads all Notion tasks. Server pagination needs a separate project progress aggregate so Home totals remain accurate.
- Designed only: docs/persistence-architecture.md target related entities, migration plan, owner/auth boundary, routine idempotency, Graph/Brightspace integration boundaries. No SQL schema or new external provider deployed.
- Blocked/unverified: Microsoft and Brightspace authorization, new SQL service provisioning.

## Run 2 — foundation checkpoint
- Vercel team access remains 403; exact reconnect scope is above. Production Projects/Tasks respond and /api/events still reports direct=true with no missing configuration.
- Implemented inactive PostgreSQL Goals schema, owner-scoped relations/RLS, transactional checksum migration ledger, insert-only Preview importer and operator runbook (`docs/database-preview-runbook.md`). No runtime provider switch, no source-record mutation, no new public API.
- Read-only production snapshot validated: 8 projects, 125 tasks, 21 resolved links. Private snapshot kept outside the repository; no data export committed. Task-side relations recover capped project relation lists.
- Embedded PostgreSQL schema tests pass: foreign keys, dates, unique task links, transaction rollback, RLS read/write isolation and metric persistence/time after reopen. Native PostgreSQL cannot start under this sandbox's process permissions; driver/migration integration tests are supplied but remain a required Preview gate.
- Automatic approval review rejected a direct push to main. Safer continuation: feature/goals-foundation branch and PR; do not retry main/merge to circumvent that rejection. No run-2 production deployment.
- Next coherent unit: dedicated Projects workspace over existing persisted projects and Tasks; do not invent temporary storage for outcome/history fields. Full Goals editing follows SQL + owner authentication.

## Run 2 — Projects workspace checkpoint
- Added projects.html with searchable lifecycle lists, direct project URLs, target-date/lifecycle editing using the existing persistent /api/projects provider, task-completion indicators, next actions and related work. Does not pretend task percentage measures goal attainment.
- Existing Task Manager supports scoped project/task links; capture inherits the selected project. No planning/deadline changes. Shared navigation now includes Projects.
- Goals outcome/overview, objectives, milestones, metric input and history are NOT enabled: their durable schema exists but requires the SQL/auth gate. Project notes remain accessible through the existing Notion project link.
- Focused project-model and existing planning/UI/frontend/deadline/filter checks pass. Browser verification of this branch remains pending.
- Foundation safely published through the GitHub connector on feature/goals-foundation (9b2ba61); draft PR #1. Shell git push lacks credentials; use the connector for this branch only.
