# NOcean Work State

Updated: 2026-09-19. Authoritative continuation checkpoint.

## Current objective
Continue the integrated NOcean roadmap from completed Tasks. Run 2 has prepared the Goals database foundation and a dedicated Projects workspace using existing persisted records. Finish the access/Preview gates before production deployment or SQL activation. Do not rebuild Tasks or redesign Home.

## Repository and deployment state
- Production remains at Run 1 main checkpoint e32e696. Existing Tasks and Google/Notion providers remain active.
- Run 2 review branch: `feature/goals-foundation`; PR: https://github.com/Leqlerc/ocean-notion-widget/pull/1 (draft pending access-dependent verification).
- Remote foundation checkpoint 9b2ba61; Projects workspace checkpoint b061148. Later verification checkpoint contains this file. Read remote branch HEAD before continuing.
- Automatic approval review rejected pushing directly to main because it was a consequential default-branch mutation. Do not evade this by merging/updating main through another tool. User approval of this concrete PR/deployment is needed before retrying that action.
- Shell git push also lacks credentials. The connected GitHub tool successfully published the feature branch and PR. No production data or private snapshot is committed.

## Completed in Run 1 — preserve
- Dedicated Tasks: Today, Tomorrow, Upcoming (days 2–14), Backlog; shared Home policy; explicit deferral, rollover, persistence, editing, completion/Undo and archive.
- Added Notion Planning Mode; reused Do date without backfill. Deadlines remain independent, date-only input becomes 23:59 local, and local labels agree with entered time.
- Production persistence and 390px layout checks passed in prior run. Details: migrations/001_notion_task_planning.md and docs/persistence-architecture.md.
- Earlier working systems: Home, Training, Notion tasks/projects/sets, direct Google + Notion calendar merge, dining, appearance and icons.

## Completed in Run 2 — review branch, not production
1. Inspected complete prior WORK_STATE, architecture, recent history including e32e696, clean checkout and matching remote main. Read-only production checks confirmed /api/projects, /tasks.html and direct Google calendar with no missing configuration. Browser Tasks loaded successfully.
2. Inactive PostgreSQL foundation: owners/projects/objectives/phases/milestones/metrics/samples and references to existing Notion tasks. Composite foreign keys and row policies enforce owner/project relationships. No API route imports this schema or switches providers.
3. Transactional migration ledger with checksum drift protection and advisory locking; insert-only Preview importer with atomic conflict refusal and no deletion. Full task-side relations avoid Notion's capped inline project relations. Legacy names must resolve unambiguously. Tasks/planning/deadlines are not copied or modified.
4. Preview-only operator CLI and exact setup/verification/rollback runbook: docs/database-preview-runbook.md. No production import support.
5. Dedicated Projects page: searchable Active/Completed/Archived lists, stable per-project links, stored target-date/lifecycle edits through existing /api/projects, next actions, related work and task completion indicators. Project lifecycle stays independent of task completion. Existing Notion link opens notes.
6. Shared navigation includes Projects. Project links scope the existing Tasks page, preset capture's project, and optionally open the related task editor. Existing planning and deadline behavior preserved.
7. Project saves wait for server confirmation; failed saves retain inputs/old records, stale reads cannot overwrite newer saves, and creating before initial load is prevented.

## In progress
No unfinished feature code. Feature branch is checkpointed; verification blocked on access is explicitly listed below. Full Goals editing is not enabled.

## Verification status
- 44 Python tests pass; 6 native PostgreSQL integration tests skipped here. The latter cover migration transactions, checksum drift, import retries/conflicts, owner boundaries and reload persistence. They require a disposable database ending in `_test`; NEVER use the application or production database.
- Embedded PostgreSQL (PGlite 0.5.8) schema tests passed: actual DDL, cross-owner and cross-project constraints, target dates, duplicate links, transaction rollback, RLS read/write isolation, metric values and timestamp persistence after reopen. This does not prove hosted connectivity, native advisory-lock concurrency or owner authentication.
- Native PostgreSQL cannot start under this workspace's process permissions. Do not spend another run repeating attempts to create system users. Use authorized Preview infrastructure and a dedicated disposable test database.
- Read-only production import rehearsal validated 8 projects, 125 tasks and 21 task links. Snapshot stayed outside repository; regenerate for actual migration because live data changes.
- Project model and DOM interaction tests passed: identity-based relations, explicit deferral ordering, task-only progress, search/detail/create, saved-state reload, lifecycle/date update, failed-save recovery, stale-read guard, missing project, and scoped task editor/capture. These use API fixtures, not live writes.
- Existing planning, UI, frontend, deadline (five timezones) and filter tests pass. Python existing-provider tests pass. No Run 2 writes to real project/task data were made.
- Vercel reports successful Preview builds for 9b2ba61 and b061148. Browser Preview redirects to Vercel sign-in; no visual/mobile or live-save verification claimed for this branch. Existing production Tasks browser read passed.
- Prior unrelated known failure: tests/test_appearance.cjs asserts 12 assets, while main already has 17. Unchanged; do not confuse with Run 2 regressions.

## External setup and blockers
- Vercel connector still returns 403 for `yiqwill-3102`, team `team_dU7W9Acdpgi8v6eLzDGS0TP1`. Exact user action: reconnect/reauthorize the Vercel connector with access to that team. No authorized database URL/CLI credentials are available.
- Then connect managed PostgreSQL to the existing project's Preview environment, with a separate server-only connection string. Operator CLI deliberately uses NOCEAN_PREVIEW_DATABASE_URL and NOCEAN_DB_ENV=preview; never put values in chat/source/logs. Full procedure is in the runbook.
- Preview UI is deployment-protected. Sign-in is required to inspect it; do not disable protection. Branch preview from Vercel's PR comment: https://ocean-notion-widget-git-feature-goals-foundation-yiqwill-3102.vercel.app
- Current production has origin checks, not authenticated owner sessions. Implement and verify server-owned sessions, CSRF checks, record authorization and a separate non-owner runtime SQL role BEFORE enabling new personal-data or token-management APIs. RLS alone is not authentication.
- Direct main push/deployment approval is separate from connector authorization. PR #1 is the reviewable result; production remains unchanged until approval and remaining verification.
- Microsoft Graph registration/consent and Purdue Brightspace access remain unverified; no connection claim.

## Exact next actions
1. Read this file and inspect remote feature/goals-foundation HEAD/PR #1. Preserve feature work; do not restart from main e32e696.
2. Restore Vercel team authorization; authenticate to protected Preview for desktop/mobile Projects and scoped Tasks verification. Confirm Preview uses intended data before any disposable-record live tests; archive only test records afterward.
3. Resolve user approval for merging/deploying the reviewable Projects increment after verification. Do not claim this branch is on production.
4. Implement authenticated owner boundary, provision dedicated Preview PostgreSQL and disposable `_test` database, run native integration tests and the migration/import rehearsal. Verify counts/relations/dates and hosted persistence. Notion remains authoritative until an explicit reconciled cutover.
5. Add full Goals workspace editing against SQL: outcome/overview/start dates, objectives, phases, milestones, manual metric samples and activity. Do not put growing history into temporary localStorage or giant Notion text blobs. Training-derived metrics require a real adapter.
6. Follow original order: recurring routines + idempotent generation and separate Errands calendar, Training, Nutrition with historical food snapshots, shared calendar providers, Outlook, Brightspace, cross-module analytics. No placeholder integrations.

## Architectural decisions and known limits
- Static HTML/vanilla JS + Python serverless APIs; keep shared transport/planning policy and stable IDs.
- Existing Notion Projects/Tasks/Training remain authoritative. New Projects page adds no temporary persistence and requires no Notion schema migration.
- Task completion is explicitly labeled, not treated as overall goal attainment; lifecycle can be completed/archived independently.
- Appearance remains separate/local. No Home, dining, training, calendar or cosmetic redesign in Run 2.
- /api/tasks still fetches all records; client pagination is not server pagination. Future pagination must preserve project totals via independent aggregates.
- No production SQL, Goals history API, routine scheduler, training expansion, nutrition logger, Outlook or Brightspace integration was activated in this run.
