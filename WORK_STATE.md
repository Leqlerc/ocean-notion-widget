# NOcean Work State

Updated 2026-09-20. Resume this checkpoint; do not re-audit completed Tasks/Projects.

## Current objective and user priorities
The latest explicit sprint instruction supersedes the earlier roadmap/mobile gate:
**Projects shipped → minimum durable SQL → Outlook → Brightspace → Goals/Projects expansion → Routines/Errands → Training → Nutrition → analytics.**
Build usable functionality; test changed paths only. Spend at most a few minutes on an external blocker, record exact setup and move on. No mobile retest of unchanged Tasks required.

## Shipped and verified
- PR #1 merged as `ad9c92fc9820baa889812a515e4c6251560bf693`. Production deployment `dpl_68PUfW4WMzgYj15Cj4N5YhYwg4wn` READY, correct SHA/main.
- Minimal production smoke: `/projects.html` 200 with workspace; `/api/projects` 200 (9 records); `/api/tasks` 200 (134 records). Existing API records preserved.
- Vercel access WORKS for team `team_dU7W9Acdpgi8v6eLzDGS0TP1` / `yiqwill-3102`, project `prj_OLAnEKEEsQ3UDm35NAYOBGChtCEV`. No further connector reconnect needed.
- Prior live Preview tests passed Projects create/reload/search/target/lifecycle, linked capture/editor, Tasks Today/Tomorrow/Upcoming/Backlog, persistence/edit/completion/Undo/archive/deadline preservation. QA project `3e177f3e-dfc6-81ed-a8a3-e34bfd9468c6` Archived; QA task `3e177f3e-dfc6-8116-aa5e-c0d1f6943a45` in Notion Trash. Do not repeat exhaustive QA. Details in `docs/release-verification.md`; its old mobile gate is waived by the user's newer instruction.

## Current implementation checkpoint — provider integrations
Branch `feature/provider-integrations`, based on merged main. Check latest remote HEAD/PR before continuing.
- Additive SQL `002_integrations.sql`: provider accounts, encrypted secrets, stable external/local item mappings, sync status/timestamps, idempotent operation records and one-use OAuth state. Reuses `001_goals.sql`, migration ledger and forced owner RLS.
- Runtime `lib/integrations/store.py`: TLS, rejects superuser/BYPASSRLS, owner-local transactions and cross-instance advisory locks. No migration credentials in runtime.
- `scripts/setup_integrations.py`: apply existing migrations, register single owner, grant integration-only runtime access, verify committed encrypted read/write across separate connections, clean probe. Not run against hosted SQL: credentials unavailable.
- New Connections UI `/integrations.html`: unlock/lock owner session, connect/sync Outlook, create/edit events, connect private Purdue feed, sync coursework in bounded batches. Strong random owner key; signed Secure/HttpOnly cookie + CSRF/origin checks. Provider tokens/feed URL encrypted in SQL, never browser storage.
- Outlook implementation: official Graph OAuth code+PKCE, expiring single-use SQL state, verified `/me` account, refresh tokens, default calendar view with recurrence instances, immutable IDs, atomic snapshot replacement after all pages, preserve last snapshot on failure. Create uses durable request fingerprint plus Graph transactionId; update uses stored ID/ETag. Meeting attendees/recurring series are not edited here. Home includes cached Outlook only with owner session.
- Brightspace implementation: official user calendar subscription feed, allowed Purdue HTTPS host/no redirects, parse stable UID/recurrence IDs, 23:59 campus date-only deadline, sequence dedup, skip recurring class entries. Imports/updates current Notion Tasks without touching planning/completion/project/difficulty. Durable operation reservation and source marker prevent blind duplicate creation after uncertain writes; retries adopt the marker or stop for reconciliation; SQL mapping preserves archive choice. Feed omission/cancellation never deletes Tasks. Submission/grade status unavailable from feeds.
- Scheduled daily sync routes (Brightspace 11:15 UTC, Outlook 11:30 UTC), protected by CRON_SECRET. Manual sync available; initial large coursework import may need repeated bounded batches.
- Google calendar fix: stable Google source-link identity suppresses stale Notion mirrors after a move/rename; live Google time/title wins. Unrelated Outlook/Google events are not collapsed just because titles/times match. Does not repair unlinked mirrors or deletion tombstones.
- Existing Tasks UI/model unchanged; shared navigation adds Connections.

## Exact external setup required — no repeated retries
Full concise procedure: `docs/integration-setup.md`.
1. **SQL**: Vercel connector lacks storage/env management tools. Storage dashboard requires a separate signed-in browser session; no database URL/CLI credentials in operator environment. Inspect existing storage, then connect isolated managed PostgreSQL Preview + separate migration/runtime roles. Securely configure NOCEAN_DATABASE_URL, NOCEAN_OWNER_ID, NOCEAN_OWNER_SECRET (random 32+ bytes), NOCEAN_TOKEN_KEY (Fernet), NOCEAN_PUBLIC_ORIGIN. Operator-only NOCEAN_MIGRATION_DATABASE_URL and NOCEAN_DB_ENV. Run setup command against Preview, then real read/write tests; production uses isolated DB. Never paste secrets in chat.
2. **Microsoft**: no app registration/client credentials or consent available. Register a Web app with delegated User.Read/Calendars.ReadWrite, exact `<origin>/api/outlook-callback`; set MICROSOFT_CLIENT_ID/SECRET/TENANT_ID server-side. Connect from UI; if Purdue requires administrator consent, request approval from Purdue IT. Tenant policy is unverified, not asserted blocked.
3. **Brightspace**: no authenticated feed or institution-approved OAuth client available. Use Calendar → Settings → Enable Calendar Feeds → Subscribe, copy private Purdue feed URL into Connections. If unavailable, ask Purdue support to enable feeds or approve OAuth API access. No credential scraping. Student API access is unverified, not conclusively prohibited.
4. **Scheduler**: set random 32+ byte CRON_SECRET in production. Credentials/config changes need redeployment.

## Verification in this sprint
- 15 focused Python integration tests pass: sessions/CSRF/tampering/expiry, encryption, Graph pagination/moves/cancellations, failed-page retention, retry transaction ID, field validation, feed date/identity/dedup/rejection, existing-task field preservation/archive, moved Google mirror.
- 5 existing calendar-provider tests pass because calendar merge changed. Python compile and JS syntax checks pass. No full Tasks/Projects regression repeated.
- Embedded PostgreSQL checks passed both migrations, stable-ID uniqueness/move updates, owner RLS read/write isolation, rollback and committed persistence after reopen. Changed UI DOM tests passed owner unlock/secret clearing, failure-preserved inputs/idempotency IDs, conflicting retry refusal and coursework sync results.
- Live Outlook consent/read/write, Purdue feed syncing and hosted SQL persistence are NOT verified or activated. New routes fail closed without setup; Notion stays authoritative. No real provider credentials were created or user events/tasks imported by the new code.

## Exact next action
Finish focused schema/UI checks, publish integration branch/PR, verify READY Preview plus safe unconfigured endpoints, then deploy the usable Connections/setup UI and Google move fix. Record resulting deployment SHA. Do not claim external providers connected before credentials and real tests succeed.
After setup: run minimum SQL probe → Outlook connect/read/create/move/retry happy path → Brightspace small batch/rerun/changed deadline → expand Goals or routines only after these boundaries are resolved. Do not expand Training/Nutrition schema now.

## Preserve
Notion Tasks/Projects/Training and direct Google + Notion calendar remain authoritative. Tasks queues/planning/deadlines are working; selected date without time stays 23:59 local. Existing inactive Goals SQL and insert-only importer remain available. No user data backfill/deletion. Prior unrelated appearance test expects 12 assets but main contains 17; not part of this sprint.

- Publishing correction: initial PR #2 Preview hit Vercel Hobby’s 12-function limit. Consolidated the cron handler into the existing integrations endpoint; total functions now 12. No plan upgrade required.
