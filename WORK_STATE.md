# NOcean Work State

Updated: 2026-09-19. Authoritative continuation checkpoint.

## Current objective
Audit and incrementally evolve NOcean into related modules. First preserve existing providers, establish persistence/authentication boundaries, and implement deliberate Today/Tomorrow task planning with a dedicated Tasks page.

## Completed
- Prior work: working Home/Training pages, Notion tasks/projects/sets, direct Google + Notion calendar merge, Purdue dining menus, local appearance and SVG icons.
- Latest main inspected; user-uploaded assets and layout changes retained. One uncommitted CSS comment from previous Work saved in git stash before fast-forward.

## In progress
- Audit persistence, API authorization, deployment access, and existing task fields.
- No new feature or database migration completed in this run yet.

## Next actions
1. Inspect task/project/training providers, active HTML/JS, tests, and Vercel project configuration.
2. Choose normalized persistence for new growing datasets; do not deploy ephemeral-file storage.
3. Complete/test a coherent Tasks planning module using existing authoritative task records.
4. Add further systems only after the current unit is tested and checkpointed.

## Architectural decisions
- Current runtime: static HTML/vanilla JS + Python stdlib serverless APIs, deployed GitHub main -> Vercel.
- Existing authoritative data: Notion Tasks, Projects, Daily Training, Exercises and Sets. Keep stable IDs and relations; no bulk migration without validation/reconciliation.
- Existing appearance remains local and separate from application records.
- No growing user data or credentials in source control. New SQL schemas must be normalized, indexed, and migrated explicitly.
- Current API checks request origin but has no user authentication. Resolve this boundary before adding sensitive integration credentials or exposing new database-backed APIs.

## External setup required
- Determine whether a durable SQL connection and authenticated deployment access are already available; no credentials have been requested or invented.
- Microsoft Graph requires a registered application and user/tenant authorization; not connected by this run.
- Purdue Brightspace access method not yet verified; no direct sync claim.

## Problems / blockers
- Work may end without notice; update this file and push each coherent checkpoint.
- Prior visual pass had no final documentation checkpoint. Its three implementation commits are deployed; browser checks performed for message/art/icon persistence and mobile macro alignment.

## Verification status
- Implemented and tested before this run: 36 Python tests and frontend/UI/filter/deadline/appearance/icon contracts; prior production visual checks.
- Implemented but not fully tested: none newly in this run.
- Designed only: new normalized persistence and module expansion.
- Blocked/unverified: Microsoft and Brightspace authorization, new SQL service provisioning.
