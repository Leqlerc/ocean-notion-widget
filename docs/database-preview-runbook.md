# Goals persistence foundation — inactive until Preview verification

This code does not switch production away from Notion or expose a new API. Existing Tasks, project lifecycle, training, and Google/Notion calendar data remain authoritative. Hosted SQL provisioning is still unverified. Integration owner-key sessions and an additive provider setup command now exist; see integration-setup.md. Full Goals APIs are not enabled.

## Access required

Vercel connector access to team `yiqwill-3102` (`team_dU7W9Acdpgi8v6eLzDGS0TP1`) and project `ocean-notion-widget` is verified as of 2026-09-20. No reconnect is needed. Available connector operations do not provision storage or manage environment variables; the separate storage-dashboard browser session requires login. No database connection is available in the operator environment. Connect managed PostgreSQL to **Preview**, keeping its URL server-only. Do not reuse a production database for staging. Before a production cutover, complete owner sign-in, server-verified sessions and CSRF checks; register the verified issuer/subject in `nocean.owners`. Never infer identity from a browser-supplied owner ID.

## Exact external setup still required

After the Projects release is verified, open the existing project's Storage settings under the `yiqwill-3102` team (https://vercel.com/dashboard/yiqwill-3102/stores). Inspect existing connected databases first; do not create a duplicate if one already exists.

1. Connect a dedicated **Preview-only** managed PostgreSQL database through Vercel Marketplace (Neon is the documented default). Keep production isolated. Prefer the free tier where available; review any provider billing terms before accepting them.
2. Supply its server-only TLS migration connection to the authorized operator environment as `NOCEAN_PREVIEW_DATABASE_URL`, with `NOCEAN_DB_ENV=preview`. A Vercel environment variable alone does not make the connection available to the local operator CLI. Use authenticated environment tooling/secret injection; never paste a database URL in chat or commit it.
3. Provision a separate disposable database whose name ends in `_test`; make its connection available as `NOCEAN_TEST_DATABASE_URL` for the native integration tests. These tests destroy only their test schema, so do not reuse Preview or production.
4. Provide a separate least-privileged runtime database role. Implement server-verified owner sign-in before enabling SQL-backed APIs; do not configure a fake owner or use the migration role for runtime. Provider registration/redirect URLs must match the eventual implemented sign-in flow.
5. Follow the procedure below for migration, snapshot reconciliation, retry checks and hosted persistence. Provisioning alone is not activation. No Goals production cutover has been implemented or validated by reconciliation yet.

## What is implemented

- `migrations/sql/001_goals.sql`: owners, projects, objectives, phases, milestones, metrics, dated samples, and stable Notion task references. Composite keys prevent cross-owner links and milestone/phase links across projects. Dates and task identifiers remain separate from planning/deadlines.
- `lib/sql_migrations.py`: transaction-scoped migration lock, checksum ledger, atomic application, no-op retries and refusal to run an older/inconsistent checkout.
- `lib/project_import.py`: full-snapshot validation, task-side relations (avoiding capped project inline lists), strict legacy-name reconciliation, stable project IDs, insert-only retries and transactional refusal on drift. Never deletes or overwrites existing records. Notion remains authoritative until a later explicit cutover; this is an import rehearsal, not ongoing sync.
- `scripts/preview_database.py`: dry-run by default choice; mutations require `NOCEAN_DB_ENV=preview`, `--confirm-preview` and a separate `NOCEAN_PREVIEW_DATABASE_URL`. TLS is required. Errors do not echo credentials or private records. This is an operator-only tool, not an API route.

## Preview procedure

1. Install `requirements-db-tools.txt` into the operator environment. Use a dedicated Preview database and a migration role. Do not put connection strings or exports in source control.
2. Set `NOCEAN_DB_ENV=preview` and `NOCEAN_PREVIEW_DATABASE_URL` securely. Run `python scripts/preview_database.py migrate --confirm-preview`. Run it again; expect an empty applied list.
3. Register the verified owner UUID, identity issuer/subject and IANA timezone using the operator connection. Runtime must use a distinct, non-owner `NOSUPERUSER NOBYPASSRLS` role with only the required table grants. Every request must authenticate the owner and set transaction-local `nocean.owner_id` before executing queries. Policies are defense in depth, not HTTP authentication. Migration/admin roles must never be used by runtime.
4. Export complete normalized `{projects: [...], tasks: [...]}` from the existing stores into a private temporary file. Use one coherent snapshot; stop and repeat the export if relations changed while reading. Retain task `projectIds`/legacy `project` fields. Do not store snapshots in this repository or serve them as static files.
5. Run `python scripts/preview_database.py dry-run --snapshot /private/snapshot.json`. Reconcile any missing, ambiguous or conflicting links first. Date-times in project targets are rejected rather than truncated.
6. Run `python scripts/preview_database.py import --snapshot /private/snapshot.json --owner VERIFIED_UUID --confirm-preview`. Retry the identical snapshot; expect zero new rows. Reconcile project counts, source IDs, status, target dates and every task link. No task deadlines/planning fields are imported or modified.
7. Run the native integration suite on a **disposable database whose name ends in `_test`** via `NOCEAN_TEST_DATABASE_URL`. It drops the `nocean` schema. Never point it at the Preview application database or production. Without this variable the optional pgserver runner uses a temporary database (non-root environment required).
8. Verify Preview APIs with authenticated owner/non-owner requests, persistence after deployment, and project UI before enabling any SQL route. Those routes and sign-in are not implemented yet. Keep Notion authoritative during this gate.

## Verification and rollback

Embedded PostgreSQL test: install `@electric-sql/pglite@0.5.8` in a temporary directory and run `tests/test_schema.mjs` with `PGLITE_MODULE` pointing at its `dist/index.js`. This exercises actual schema/constraints/RLS and reopen persistence, but does not prove the hosted driver, migrations under concurrent connections, or authentication.

Native test: `python -m unittest discover -s tests -p test_sql_foundation.py -v`, after installing `requirements-db-test.txt` and providing the disposable test database. Tests cover transactional migrations, checksum drift, import retries/conflicts, owner scoping and persisted data.

There is no production cutover to roll back in this increment. Failed migrations/imports roll back their transaction. For a successful Preview rehearsal, retain the database for comparison or remove only the dedicated disposable database through its provider. No destructive down-migration or automatic source-record deletion is supplied.

## Next implementation gate

Implement and verify the owner session boundary, then a Goals store/API against this schema: outcome/overview/dates, ordered objectives/phases, milestones, manual metrics and activity. Preserve the current Projects response contract for Home, keep task mutations in the current task store, and do not report task completion percentage as goal attainment. Training-derived metrics need a real adapter before enabling a non-manual metric source.
