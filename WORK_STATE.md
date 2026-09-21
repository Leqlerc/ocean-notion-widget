# NOcean Work State

Updated 2026-09-21. This is the current authoritative checkpoint.

## Product reset shipped

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

## Remains

- Publish and smoke the current feature branch as a Vercel Preview; record its URL/status below.
- Use the new Home and Machine flows with real data. Do not expand Projects or add advanced Machine analytics until usage reveals the real gaps.
- If cross-device persistence for the new lightweight records becomes important, move those namespaces behind the existing owner-scoped SQL foundation after database credentials are available.

## Next highest-value action

Deploy this checkpoint to Preview, confirm Home, Projects, Machine, and Settings return successfully with no obvious runtime failure, then stop. The next product sprint should start from observed daily usage, not another speculative model expansion.
