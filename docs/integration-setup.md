# Integration activation

Projects is deployed. The new Connections page is `/integrations.html`. Providers fail closed until setup below is complete; Google and existing Notion data keep working. Do not put credentials in chat, commits or browser storage.

## PostgreSQL and owner access

1. In Vercel team `yiqwill-3102`, inspect Storage for `ocean-notion-widget`. Connect an isolated Neon PostgreSQL Preview database. The Vercel connector works but does not expose provisioning/env operations; the dashboard requires separate browser login.
2. Provision separate migration/admin and runtime roles in that database. Runtime must be `NOSUPERUSER NOBYPASSRLS`. Configure these server-only variables in Preview and the secure operator environment:
   - `NOCEAN_DATABASE_URL`: runtime TLS URL (`sslmode=require` or stronger).
   - `NOCEAN_MIGRATION_DATABASE_URL`: admin TLS URL, **operator environment only**, never Vercel runtime.
   - `NOCEAN_OWNER_ID`: one generated UUID, stable for this owner's data.
   - `NOCEAN_OWNER_SECRET`: random 32+ byte access key; use a password manager. This is a single-owner credential, not a memorable password. Rotating it invalidates owner sessions.
   - `NOCEAN_TOKEN_KEY`: `cryptography.fernet.Fernet.generate_key()` output, stored as a secret. Retain securely; changing it without re-encrypting requires reconnecting providers.
   - `NOCEAN_PUBLIC_ORIGIN`: canonical HTTPS Preview branch URL, no path/trailing slash. Open that exact origin for login/OAuth. Production uses `https://ocean-notion-widget.vercel.app`.
   - `NOCEAN_DB_ENV=preview` in the operator environment.
3. Run `python scripts/setup_integrations.py --environment preview --confirm-additive-migration`. It applies existing `001_goals.sql` and new `002_integrations.sql`, registers the owner, grants only integration tables to runtime, and verifies an encrypted value across two committed connections. No Notion data is copied or modified. Run again to check migration no-op behavior.
4. Redeploy Preview, unlock Connections with the owner key, and check the account list loads. Test provider workflows below. Use a separate production database/roles and repeat with `NOCEAN_DB_ENV=production` and `--environment production` only after Preview passes. Never point native destructive `_test` suites at either application database.
5. Set a random 32+ byte `CRON_SECRET` in Vercel production. Existing cron routes sync Brightspace daily at 11:15 UTC and Outlook at 11:30 UTC. Manual sync is available in Connections. Brightspace works in bounded batches; initial imports may need several clicks. No completion state is inferred from the feed.

## Outlook / Microsoft

Create an app registration in Microsoft Entra with delegated `User.Read` and `Calendars.ReadWrite`; OAuth also requests `offline_access`. Use an account type that permits the intended Purdue Microsoft account. Add a **Web** redirect URI for each active environment: `<NOCEAN_PUBLIC_ORIGIN>/api/outlook-callback`. Do not use SPA/implicit grant. Create a client secret and set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and `MICROSOFT_TENANT_ID` (tenant UUID or `organizations`) server-side, then redeploy.

Unlock Connections → Connect Outlook → sign in/consent with Microsoft → Sync Outlook now. The callback uses one-use expiring SQL state and PKCE; Graph verifies the account through `/me`. Refresh tokens are encrypted in SQL and never sent to browser code. If Purdue displays administrator approval required, request consent for the registration from Purdue IT; this run cannot establish the tenant's consent policy without that flow. No Microsoft registration or live consent was available in this sprint.

The integration reads the default calendar, including recurrence instances, over the same -62/+180 day window as Google. Successful sync atomically replaces the snapshot; failure preserves it. Immutable Microsoft IDs preserve moved/edited identity. Create uses a persisted request fingerprint plus Graph `transactionId` for retry safety; edits use the saved immutable ID and ETag. Meetings with attendees and recurring series must be edited in Outlook to avoid unintended notifications. Outlook events are included on Home only for an unlocked owner session. Google and Notion behavior otherwise stays intact.

Primary references: [OAuth code flow and PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), [immutable IDs](https://learn.microsoft.com/en-us/graph/outlook-immutable-id), [calendar view](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview), [create event](https://learn.microsoft.com/en-us/graph/api/user-post-events), [update event](https://learn.microsoft.com/en-us/graph/api/event-update).

## Purdue Brightspace

No Purdue OAuth registration or authenticated feed was supplied; **student API access is unverified, not conclusively prohibited**. D2L's official API requires an app registered in the institution's Brightspace deployment and appropriate user permissions. Request institution-approved OAuth access if richer assignment/submission state is needed.

The implemented immediate route uses the official calendar subscription feature: in Purdue Brightspace, open Calendar → Settings → Enable Calendar Feeds → Save → Subscribe, choose the applicable courses and copy the private calendar URL. Enter it only in Connections' private feed field. If those controls are unavailable, ask Purdue support whether calendar feeds are enabled for your account; do not scrape credentials or internal sessions.

Connect feed validates the response before storing its encrypted URL. Sync coursework imports dated feed items into existing Tasks, using stable UID/recurrence IDs and a source marker written in the same Notion create request. A durable reservation prevents blindly retrying an uncertain create: retries must find its source marker, otherwise the operator must reconcile the pending operation before clearing it. Reruns and moved deadlines update that task; SQL mappings retain the task ID. Existing Source ID or specific source URL matches can be adopted only when unambiguous. Generic calendar URLs, unmatched legacy imports, and items absent from a course feed cannot be safely reconciled by title alone; inspect the first small batch before importing the rest. Multiple source matches stop that item. Recurring class entries are skipped. Feed cancellation/omission never deletes user Tasks. Completion, planning, projects and difficulty are preserved. Date-only deadlines use 23:59 campus local time.

Reference: [D2L OAuth requirements](https://docs.valence.desire2learn.com/basic/oauth2.html). Calendar feeds expose dates and links, not assignment submission/grade status; this is not a claim of full Brightspace API integration.

## Focused verification

- `python -m unittest discover -s tests -p test_integrations.py -v`
- `PGLITE_MODULE=/tmp/nocean-integration-check/node_modules/@electric-sql/pglite/dist/index.js node tests/test_integration_schema.mjs`
- `DOM_MODULE=/tmp/nocean-integration-check/node_modules/jsdom node tests/test_integration_ui.cjs`

These cover provider fixtures, changed UI logic and embedded PostgreSQL. They do not prove live Microsoft consent, Purdue feed availability or hosted database connectivity. Do not claim activation until the setup command and real provider read/write/retry tests pass.
