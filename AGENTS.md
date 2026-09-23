# Repository Guidelines

## Start Here

Before meaningful implementation work, read `WORK_STATE.md`, inspect the current branch and recent commits, and examine the relevant code and tests. Repository code is authoritative for implementation truth. `WORK_STATE.md` is the authoritative handoff for current intent, unresolved work, and decisions; if it conflicts with code, investigate the implementation and reconcile the document.

Check whether requested behavior already exists before adding it. Preserve the Home / Projects / Athletics / Settings architecture and existing integration/data boundaries unless the task explicitly changes them. Prefer targeted deltas over rewrites, follow nearby patterns, and do not replace a working system merely because another design looks cleaner.

## Project Structure

This is a framework-free dashboard deployed through GitHub to Vercel. Root `*.html`, `*.js`, and `*.css` files implement the browser UI; shared behavior uses `nocean-*` modules. Python serverless handlers in `api/` should remain thin and delegate domain/provider logic to `lib/`. Database changes belong in `migrations/`, operator utilities in `scripts/`, durable architecture/runbooks in `docs/`, maintained artwork in `assets/backgrounds/`, and tests in `tests/`.

## Commands and Verification

There is no frontend build step or package manager. Common checks are:

```sh
node --check nocean.js
node tests/test_frontend.cjs
python -m unittest discover -s tests -v
python -m compileall -q api lib
```

Run focused tests for the changed area (for example, `node tests/test_deadlines.cjs`) plus relevant syntax checks. Some DOM and SQL suites require external `DOM_MODULE` or `PGLITE_MODULE` dependencies documented in `NOCEAN.md` and `docs/`. Verify behavior before claiming it is fixed, implemented, tested, deployed, or complete. Inspect the final diff and run `git diff --check` before committing.

## Style and Testing

Follow nearby formatting; do not reformat unrelated files. JavaScript uses strict mode, `const`/`let`, camelCase, and existing `NOcean*` namespaces. Python uses four-space indentation, snake_case, and thin HTTP handlers. Use kebab-case for web assets and `test_<feature>.py`, `.cjs`, or `.mjs` for tests. Escape user-controlled HTML and preserve accessibility labels.

Add regression coverage at the relevant layer. Node tests use built-in assertions with VM/DOM stubs; Python tests use `unittest` and mocked providers. For layout changes, inspect `tests/layout.html` at desktop and approximately 390 px mobile widths.

## Data, Security, and Deployment

Never expose or commit credentials; keep `.env`, tokens, `.vercel/`, and caches out of Git. Do not mutate live external integration data merely to test. Do not make destructive production, schema, or data changes unless the task requires them; prefer backward-compatible migrations and explicitly surface destructive steps before execution. Preserve partial-failure behavior and keep credentials server-side. See `NOCEAN.md`, `docs/integration-setup.md`, and the database runbook before touching providers or persistence.

Production follows the existing GitHub-to-Vercel integration. A successful local or Preview check is not proof of production deployment. Record the exact commit/deployment verified when release work is requested.

## Commits, Pull Requests, and Handoff

Use short imperative commit subjects and focused commits. Pull requests should describe user-visible impact, linked issues, checks run, configuration/migration effects, and screenshots for visual work. Document desktop/mobile verification where relevant.

At the end of every meaningful implementation session, update `WORK_STATE.md`. Keep it a concise present-state snapshot, not a diary: remove stale, completed, duplicated, or superseded material. Do not copy durable guidance from this file or detailed architecture from `NOCEAN.md`/`docs/`. If work stops partially complete, record the exact partial state, blocker, and safe continuation point. Git history remains the historical record.
