# Repository Guidelines

## Start Here

Before meaningful implementation work, read `WORK_STATE.md`, inspect the current branch and recent commits, and examine only the code/tests relevant to the requested change. Repository code is authoritative for implementation truth. `WORK_STATE.md` is the authoritative handoff for current intent, unresolved work, and decisions; if it conflicts with code, investigate the implementation and reconcile the document.

Check whether requested behavior already exists before adding it. Preserve the Home / Projects / Athletics / Settings architecture and existing integration/data boundaries unless the task explicitly changes them. Prefer targeted deltas over rewrites, follow nearby patterns, and do not replace a working system merely because another design looks cleaner.

## Execution Priorities and Efficiency

Optimize for shipping the requested user-facing delta, not for exhaustive investigation.

Use this order:
1. Inspect `WORK_STATE.md`, the current diff/branch, and the smallest set of relevant files.
2. Implement the requested change immediately once the path is clear.
3. Run focused tests and syntax checks for the changed area.
4. Inspect the final diff, update `WORK_STATE.md`, commit, and push when the task requests shipping.
5. Report the commit SHA, checks run, and any genuine blocker or deferred non-critical validation.

Do not spend significant time or context on broad repository archaeology, optional infrastructure analysis, unrelated cleanup, speculative refactors, or production/browser investigation unless it blocks the requested change.

Treat roughly 20% remaining session/context/credit budget as mandatory SHIP MODE. At that point, stop non-critical investigation and finish the minimum critical verification, update `WORK_STATE.md`, commit/push the completed work, and report any unresolved item precisely. Do not burn the final budget chasing optional validation.

If a non-critical check requires disproportionate effort, document it as pending rather than allowing it to consume the sprint.

## Autonomy and Approvals

For routine work in this repository, proceed without asking the user for confirmation. The user expects high autonomy and low-interruption execution.

You may proceed directly with:
- reading and editing repository files;
- running normal project commands, tests, scripts, and syntax checks;
- installing ordinary project dependencies when needed for the requested task;
- git add/commit/push for requested implementation work;
- Vercel inspection/deployment/redeployment when release work is part of the task;
- running existing application sync/refresh workflows when they are explicitly part of the requested task;
- validating integrations against real application data when that validation is necessary to the requested task and uses the application's normal supported workflow.

Do not stop merely because an operation touches production or real application data if the requested task explicitly requires that normal operation. Prefer reversible, normal application behavior and verify scope before executing.

Ask for explicit confirmation only before actions that are destructive, difficult to reverse, financially consequential, security-sensitive, or materially outside the requested scope. Examples include deleting production data, dropping tables/databases, destructive migrations, rotating or exposing credentials, force-pushing shared history, deleting repositories/projects, changing billing/paid services, or making unrelated production changes.

Do not create approval loops for routine engineering actions. If a safe action is clearly within the requested scope, execute it.

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

Run focused tests for the changed area (for example, `node tests/test_deadlines.cjs`) plus relevant syntax checks. Some DOM and SQL suites require external `DOM_MODULE` or `PGLITE_MODULE` dependencies documented in `NOCEAN.md` and `docs/`.

Use the smallest verification set that gives strong confidence in the changed area. Expand testing only when failures, risk, or cross-cutting changes justify it. Verify behavior before claiming it is fixed, implemented, tested, deployed, or complete. Inspect the final diff and run `git diff --check` before committing.

## Style and Testing

Follow nearby formatting; do not reformat unrelated files. JavaScript uses strict mode, `const`/`let`, camelCase, and existing `NOcean*` namespaces. Python uses four-space indentation, snake_case, and thin HTTP handlers. Use kebab-case for web assets and `test_<feature>.py`, `.cjs`, or `.mjs` for tests. Escape user-controlled HTML and preserve accessibility labels.

Add regression coverage at the relevant layer when the change is behaviorally meaningful or fixes a bug likely to recur. Do not add low-value tests merely to increase coverage. For layout changes, inspect `tests/layout.html` at desktop and approximately 390 px mobile widths when practical and relevant.

## Data, Security, and Deployment

Never expose or commit credentials; keep `.env`, tokens, `.vercel/`, and caches out of Git.

Normal application operations against live data are allowed when they are explicitly part of the requested task, including refresh/sync verification. Do not mutate live external data solely for speculative testing, and do not perform destructive production/schema/data changes unless the task requires them. Prefer backward-compatible migrations and surface genuinely destructive steps before execution. Preserve partial-failure behavior and keep credentials server-side. See `NOCEAN.md`, `docs/integration-setup.md`, and the database runbook before making provider or persistence changes when those references are relevant.

Production follows the existing GitHub-to-Vercel integration. A successful local or Preview check is not proof of production deployment. When release work is requested, verify the exact deployed commit if practical; if deployment verification becomes a non-critical rabbit hole after implementation is complete, record it as pending and ship the code rather than exhausting the session.

## Commits, Pull Requests, and Handoff

Use short imperative commit subjects and focused commits. Pull requests should describe user-visible impact, linked issues, checks run, configuration/migration effects, and screenshots for visual work when useful.

At the end of every meaningful implementation session, update `WORK_STATE.md`. Keep it a concise present-state snapshot, not a diary: remove stale, completed, duplicated, or superseded material. Do not copy durable guidance from this file or detailed architecture from `NOCEAN.md`/`docs/`. If work stops partially complete, record the exact partial state, blocker, and safe continuation point. Git history remains the historical record.
