# NOcean Work State

Updated 2026-09-22. This is the current authoritative checkpoint.

## Customization + Brightspace activation — Production checkpoint

- The protected pre-sketch production branch is still `backup/pre-sketch-ui-production-2026-09-21` at `ef321263fc7d7d0c689e6999ace9a63f48af3cdf`. Do not delete, overwrite, or force-update it.
- Reviewed refinement branch: `feature/customization-brightspace` at `aa16625ec21fc49b21af7c5167d6f304ec75aa3d`.
- Final reviewed Preview: `dpl_74SibJ9xrw17K5Cb4J46wLeLgCzZ`, READY at `https://ocean-notion-widget-openb9v2a-yiqwill-3102.vercel.app`.
- Production implementation promotion: merge commit `94104ff9b651918ecb4d965b2e04d5dcbc66f458`, with the exact reviewed Preview tree. READY deployment: `dpl_2wFBipqAgToYpBQuiXgG21CX5oGP`. Stable URL: `https://ocean-notion-widget.vercel.app`.
- Home / Projects / Athletics / Settings architecture, Campus placement, full-width Calendar placement, Task semantics, and Outlook/Google behavior were preserved.

### Shipped customization

- The large Home Calendar now applies exact trusted-workload levels: 0 neutral, 1 teal, 2 yellow, 3 orange, 4 red, and 5+ dark red. The count includes active Tasks plus trusted coursework/deadlines and excludes ordinary calendar events. Events still appear in the agenda and get a neutral dot when a date has no workload.
- Calendar day buttons expose workload and event counts through `aria-label`, `title`, and `data-workload-count`. Today uses an inset accent ring/underline and selection uses an outer white outline, so both remain distinct from heat color.
- Settings → Appearance now has synchronized range and numeric inputs for Top biome height, clamped to 80–500 px. The default/current compact height is 176 px. It changes the actual visible header/biome height live and persists in the existing lightweight preference store.
- Settings → Appearance now has synchronized range and numeric inputs for Card opacity, clamped to 20%–100% with 100% as the upgrade-safe default. It changes card surface alpha only; content remains fully opaque. Image-backed cards combine this setting with the readability overlay.
- Settings → Appearance now owns Home heading (80-character limit) and Home subtitle (180-character limit), with live Home updates, persistence, and Reset to default. NOcean branding and navigation labels are unchanged.
- Trusted future coursework whose feed record lacks a matchable course label now appears in the existing Academic Radar as an `Other coursework` safety-net card. Permanent configured class cards remain unchanged. This prevents valid Brightspace items from disappearing without inventing a course label or changing the provider/feed architecture.

### Production Brightspace sync

- The existing Purdue Brightspace private calendar feed was already connected. The stored feed and credentials were not changed, exposed, or copied.
- A real Production `Sync coursework now` run completed in four bounded batches against the existing connection.
- Aggregate reconciliation: 176 discovered; 30 newly created; 2 existing items adopted/updated; 37 pre-existing items unchanged; 107 skipped because they were past; 0 archived skips; 0 parser/feed skips; 0 remaining; no reconciliation warnings.
- Brightspace Tasks increased from 81 to 111. All 81 pre-existing Brightspace records were compared before and after: there were zero changes to completion status, project, difficulty, planning mode, scheduled date, or focus. Completed Brightspace count remained 36. No newly created item was past-due.
- The private feed omitted course labels on the newly created records (29 from the MFET Brightspace space and 1 from the CS space). The Academic Radar safety net now surfaces these records honestly as `Other coursework`; the Calendar workload heatmap counts them as trusted deadlines.
- Owner access was supplied through the protected browser authentication flow for this run. No further manual authorization is required at this checkpoint.

### Validation

- All CommonJS UI/contract suites pass, including exact 0/1/2/3/4/5+ heat thresholds, selected/today semantics, appearance persistence, card-image compatibility, four-destination architecture, Projects interactions, Tasks, planning, deadlines, and rollback behavior.
- 26 focused Python integration/project/task tests pass with isolated temporary test dependencies. No repository dependency files were changed.
- Live Preview data exercised every heat level: 18 neutral dates, 5 teal, 1 yellow, 1 orange, 2 red, and 3 dark red. Seven event-only dates remained neutral. Today and selected state coexisted on the same dark-red date.
- Live Settings checks confirmed Top biome height 80–500, Card opacity 20–100, synchronized numeric controls, Home copy fields/reset, and current defaults 176 px / 100%. Earlier live checks on the same reviewed feature tree confirmed 500/20 clamping, reload/navigation persistence, immediate Home copy updates, and readable image-backed cards at both low and high opacity.
- Final Preview showed the five permanent class cards plus `Other coursework` with 70 currently unmatched future trusted items. Home, Projects, Athletics, and Settings all loaded. Browser logs contained no application errors.
- Final Production smoke passed at the stable URL with the `Other coursework` safety net, 30 calendar day buttons, and Settings navigation present.

## Refined sketch UI — Production checkpoint

- The previous Production/main version is permanently preserved on `backup/pre-sketch-ui-production-2026-09-21` at `ef321263fc7d7d0c689e6999ace9a63f48af3cdf`. Do not delete or overwrite this branch.
- Reviewed feature implementation: `feature/sketch-ui` commit `54a05e211865692060c561fb091569954566b3b0`.
- Verified Preview: `dpl_7RP8TytgzEoGP9B52Bx8ERhguwmp`, READY at `https://ocean-notion-widget-ohkgki2r7-yiqwill-3102.vercel.app`.
- Production promotion merge: `393f34098c65a97a3cb228b9b57fb10663b72d26`. It has the prior main and the reviewed feature commit as parents, and its tree exactly matches the reviewed Preview tree.
- First READY Production deployment of the refined UI: `dpl_3FC8RVK85ijQ8QpoTA1i6JgUZnDW`. Stable URL: `https://ocean-notion-widget.vercel.app`.
- Home keeps the sketch information architecture, but Campus now occupies the former compact Calendar area and Calendar / Temporal Context is a substantially larger full-width bottom section.
- Settings → Appearance now includes a persistent Compact/Expanded top-biome choice. Compact remains the default.
- Settings → Appearance also configures Tasks, Deadlines, Events, Campus, and Calendar card backgrounds independently from the existing biome allowlist. None/default preserves the original card exactly; selected art uses a readable dark overlay and can be removed again.
- All appearance preferences remain device-local in the existing lightweight settings namespace. No task, project, provider, database, OAuth, environment, or integration behavior changed.
- Focused validation passed: JavaScript syntax, diff checks, new appearance/persistence contracts, four-destination contracts, planning/deadline/project-model regressions, and 10 focused Python task/project-plan tests.
- Authenticated visual Preview checks passed for default cards, Expanded header art, image-backed card readability, persistence across navigation, reset-to-default behavior, Campus placement, and the larger Calendar.
- Production smoke passed for Home, Projects, Athletics, and Settings with no application console errors. Existing Tasks, Brightspace deadlines, Google/Notion events, weather, RecWell, dining, Projects, Machine, and Connections data remained visible.

## Base sketch-led UI restructuring

- Started from remote `preview/product-reset-current` (`cfbf323`), not the temporarily restored production branch. The known-good pre-reset production state remains untouched.
- Working branch: `feature/sketch-ui`.
- Primary navigation is now exactly **Home / Projects / Athletics / Settings**.
- Home now follows the hand-drawn layout:
  - Tasks is the dominant left panel and still uses the existing Task API/persistence.
  - Deadlines shows only Brightspace-linked or explicitly verified coursework and retains the independent `Not submitted / Submitted / Verified` ledger.
  - Events still uses the existing merged calendar source and moved-event duplicate handling.
  - A compact month calendar exposes tracked tasks, trusted coursework, and events for a selected date without becoming the main product surface.
  - Existing weather, RecWell, and dining signals remain available in a lower-priority campus strip instead of being deleted.
- Projects now uses a horizontally scrolling project selector and one selected-project control panel containing status, task progress, immediate next actions, project organization/objectives/notes, and milestones. Existing Projects, task links, Notion goal blocks, edit/create flows, and APIs are reused.
- Athletics is intentionally a polished placeholder. The already-working Machine/training/nutrition/sleep/habits/maintenance/reflection interface is preserved unchanged at `/machine.html` and linked from the Athletics shell; no records or APIs were removed.
- Settings and Connections remain at `/integrations.html`, including appearance, classes, maintenance configuration, Outlook, and Brightspace controls.
- No migrations, database tables, environment values, provider logic, API routes, sync behavior, or production deployment were changed.

## Focused verification for this restructuring

- JavaScript syntax and `git diff --check` pass.
- Updated sketch UI contract tests pass for the exact four-destination navigation, Home hierarchy, Projects control panel, Athletics placeholder, preserved Machine route, and Settings ownership.
- Home DOM coverage passes with fixtures proving ordinary work remains in Tasks, trusted coursework remains in Deadlines, Events use calendar data, and selecting a calendar date exposes all relevant records without conflating them.
- Projects and goal-plan DOM interaction suites pass for selector/detail rendering, create/edit, failure rollback, stale-read protection, next actions, objectives, milestone dates, completion, refresh, and uncertain-create handling.
- Existing Task interaction, planning, deadlines, project-model, and shared UI contract tests pass.
- A remote browser cannot reach the local-only server in this runtime, so no deployed visual smoke was performed. This is not a deployment failure; deployment was intentionally skipped.

## Inherited product reset preview

- Primary navigation is exactly **Home / Projects / Machine / Settings**. The full Tasks workspace remains available as a secondary link from Home, not a primary destination.
- Home is rebuilt around the daily control question:
  - Academic Radar permanently renders the configured current classes and shows only current/future course obligations. Brightspace-linked items are labeled. Past coursework is excluded.
  - Each coursework item has a separate `Not submitted / Submitted / Verified` ledger keyed by stable source ID when available. Completing a Task never mutates this state.
  - Today is now a deliberate work plan: only focused, doing, explicitly planned-today, planned-tomorrow, or backlog work appears in its corresponding view. An automatic deadline alone no longer makes an item part of Today's plan.
  - Campus intelligence shows today and tomorrow high/low/conditions, decision-oriented rain windows and forecast changes, plus live RecWell hours/occupancy.
  - Dining is reduced to one optional compact signal. Upcoming events are a compact list; the large month calendar is removed from Home.
  - Projects are removed from Home.
- Athletics is converted into Machine:
  - Existing Notion-backed workout/set logging, workout completion, support work, and recent performance are preserved.
  - Added daily Nutrition and Sleep logging, Notion-backed daily Habits, recurring Maintenance/Errands, and Reflection/Hotwash capture.
  - Added six summary signals so the page reads as a system overview before the detailed logs.
- Projects keeps its existing model, goals, milestones, notes, task linking, and APIs. Only the application shell and visual treatment changed.
- Settings now owns integrations, current class cards, biome/appearance controls, recurring maintenance definitions, and Home preferences.
- Visual system is consolidated for the four destinations in `nocean-system.css`: one submerged instrument-panel hierarchy, restrained translucent surfaces, shared spacing/type, and biome art used as page atmosphere. Home no longer loads the prior stack of overlapping hierarchy/polish/preset CSS layers.

## Persistence and preserved systems

- Notion Tasks, Projects, project goal blocks, training sets/days, direct Google calendar, cached Outlook support, and Brightspace reconciliation remain unchanged and authoritative.
- The latest Brightspace conservative match/adoption behavior from `29989fe` is preserved: upcoming-only sync, stable source markers, no blind duplicate creation, and no mutation of user planning/completion/project/difficulty fields.
- Lightweight new preferences, coursework verification, Nutrition, Sleep, Maintenance, and Reflections persist in namespaced browser storage on this device. They do not migrate or delete Notion data. Cross-device persistence is not implemented in this reset.
- Outlook and Brightspace credential setup remains external and intentionally untouched. Existing private credentials are never exposed to the browser or repository.

## Focused verification

- JavaScript syntax checks pass for every changed script; Python compile passes; `git diff --check` passes.
- New product-reset contracts pass: exact four-destination nav, Home hierarchy, no Projects/full calendar on Home, Machine flows, Settings ownership, verification persistence, maintenance completion, and reflection capture.
- Existing focused UI, planning, deadline/DST, appearance, filter, frontend, project-model tests pass.
- 32 relevant Python provider/training/task/project-plan tests pass. The optional Brightspace parser tests were not rerun locally because `icalendar` is not installed in this checkout; that code path was not modified in this reset and Vercel installs it from `requirements.txt`.
- Vercel Preview `dpl_5bbj8ddCe3eoNaCQzbz3qNDLJ7jb` built the exact GitHub checkpoint `0df1953d6d88881884acd19bff1c93d30d41248e` and reached `READY` at `https://ocean-notion-widget-git-feature-product-reset-yiqwill-3102.vercel.app`.
- The connector's protected-URL fetch returned the Vercel SSO redirect rather than retaining its temporary cookie, so it could not complete an authenticated live-response smoke. Do not mistake that access-tool limitation for a build failure; the deployment itself is READY. Local route/entrypoint checks confirm all four pages and referenced scripts exist.

## Remains

- Open the READY Preview once in an authenticated browser for the visual smoke of Home, Projects, Machine, and Settings. No broad regression pass is needed.
- Use the new Home and Machine flows with real data. Do not expand Projects or add advanced Machine analytics until usage reveals the real gaps.
- If cross-device persistence for the new lightweight records becomes important, move those namespaces behind the existing owner-scoped SQL foundation after database credentials are available.

## Next highest-value action

Open the READY Preview for one visual pass, then use the new Home and Machine flows with real data. The next product sprint should start from observed daily usage, not another speculative model expansion.
