# NOcean Work State

Updated: 2026-09-19. Authoritative continuation checkpoint.

## Current objective
Audit and incrementally evolve NOcean into related modules. First preserve existing providers, establish persistence/authentication boundaries, and implement deliberate Today/Tomorrow task planning with a dedicated Tasks page.

## Completed
- Prior work: working Home/Training pages, Notion tasks/projects/sets, direct Google + Notion calendar merge, Purdue dining menus, local appearance and SVG icons.
- Latest main inspected; user-uploaded assets and layout changes retained. One uncommitted CSS comment from previous Work saved in git stash before fast-forward.

- Added `Planning Mode` select to existing Tasks database; reused Do date. No task data backfill. See migrations/001_notion_task_planning.md.
- Added shared nocean-data.js transport and nocean-planning.js policy. Tasks page uses same /api/tasks records as Home. Date-only deadlines retain 23:59 local behavior.
- Today honors explicit plans; old incomplete plans roll over; Tomorrow is distinct; Upcoming covers days 2–14; Later includes explicit Backlog and longer/undated tasks.

## In progress
- Live create, Tomorrow persistence after reload, matching Home queue, Backlog/Today moves, and completion verified using one disposable QA record.
- Live checks found local-date labeling inconsistency and stale Undo from preceding writes; fixes are in this checkpoint and need deployed recheck.
- Remaining live verification: fixed Undo, edit persistence, archive cleanup and mobile layout.

## Next actions
1. Verify Tasks create/edit/plan Today -> Tomorrow -> Backlog, refresh persistence, deadline invariance, completion/undo and archive with disposable records.
2. Verify Home applies the identical TaskPlanning policy and existing calendar/training remain functional.
3. Finish normalized persistence design/migrations for new systems; SQL provisioning needs Vercel authorization.
4. Goals workspaces and Routines are next coherent units; do not claim they exist yet.

## Architectural decisions
- Current runtime: static HTML/vanilla JS + Python stdlib serverless APIs, deployed GitHub main -> Vercel.
- Existing authoritative data: Notion Tasks, Projects, Daily Training, Exercises and Sets. Keep stable IDs and relations; no bulk migration without validation/reconciliation.
- Existing appearance remains local and separate from application records.
- No growing user data or credentials in source control. New SQL schemas must be normalized, indexed, and migrated explicitly.
- Current API checks request origin but has no user authentication. Resolve this boundary before adding sensitive integration credentials or exposing new database-backed APIs.

## External setup required
- Vercel connector denied project team scope yiqwill-3102 (403). Reauthorize that scope before SQL provisioning/environment changes. No SQL URL, Vercel token or CLI authentication exists in this workspace. Existing GitHub -> Vercel deploy remains usable. No browser workaround attempted.
- Microsoft Graph requires a registered application and user/tenant authorization; not connected by this run.
- Purdue Brightspace access method not yet verified; no direct sync claim.

## Problems / blockers
- Work may end without notice; update this file and push each coherent checkpoint.
- Prior visual pass had no final documentation checkpoint. Its three implementation commits are deployed; browser checks performed for message/art/icon persistence and mobile macro alignment.

## Verification status
- Implemented and tested before this run: 36 Python tests and frontend/UI/filter/deadline/appearance/icon contracts; prior production visual checks.
- Implemented and unit tested this run: Tasks planning policy, Notion field validation/mapping, shared transport, standalone Tasks UI. Browser verification pending.
- Implemented but not fully tested: date-label/Undo fixes and mobile behavior.
- Known scaling limitation: Tasks displays 25 records at a time but /api/tasks still loads all Notion tasks. Server pagination needs a separate project progress aggregate so Home totals remain accurate.
- Designed only: new normalized persistence and module expansion.
- Blocked/unverified: Microsoft and Brightspace authorization, new SQL service provisioning.
