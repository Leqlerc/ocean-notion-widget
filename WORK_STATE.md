# NOcean Work State

## Current release — 2026-09-23

Corrective product sprint on `main`, based on `d423a21`. Commit/push follow this update. Production deployment is not verified; no Vercel/integration/backend investigation was performed in this sprint.

## Current product behavior

- Home Tasks has more of the existing grid width. Titles use their own full-width row; badges/actions sit below. Optional capture fields collapse under Details to prevent vertical compression. Desktop Tasks/Deadlines/Habitat remain aligned; mobile stacks normally.
- Home and Tasks expose Today, Tomorrow, Backlog, and Maintenance (Tasks retains All). Backlog also includes the former Upcoming items, so removing that tab hides no work. Maintenance's canonical editor lives inside its task category; there is no separate Home card. Due occurrences still appear in Today without copied records and completion advances the existing interval/weekly schedule.
- Active deadline titles/links are neutral white, with no yellow row highlight. Submitted items remain muted. Chronological ordering, class/exam filters, announcement separation, submission confirmation, and historical hiding remain unchanged.
- Weather has its normal border. Today/Tomorrow task views use the existing calendar 0–5 workload scale and shared color definitions, counting unique work/pending coursework plus due maintenance. Backlog/Maintenance have normal borders. User accents remain independent of workload colors.
- Athletics has no Maintenance card/tile. Habits follows the training/recovery grid. Nutrition and Sleep each show inputs followed directly by a consistency heatmap.
- One contribution-map renderer powers all three 26-week maps. Workout cells expand across the card width (1278px in the desktop fixture), retaining the September 24, 2026 workout cutoff. Nutrition: empty / any positive field / calories + protein logged. Sleep: active when hours are logged. These show logging completeness, not dietary or sleep scores. Future history is not rendered.
- Accent selector has exactly eight labeled families (Red, Orange, Yellow, Green, Blue, Purple, Pink, Chrome), six shades from light to dark each. Meaningful old keys remain; retired colors map to compatible shades. Every previous saved accent resolves safely.

## Persistence / preserved boundaries

- Maintenance, nutrition, sleep, and reflections remain device-local using existing keys. No records deleted, migrations, or backfills.
- Tasks/Projects/training/habits providers, Brightspace ingestion, calendar integrations, Reflections CRUD/navigation, and authentication were not changed. Shared Machine code guards legacy-only controls; the legacy route remains compatible.
- Earlier shipped dining protein picks/occupancy borders, source filtering/deduplication, and theme/card customization remain intact. Habitat still uses its previously documented temporary star artwork.

## Checks actually run

- Eight targeted Node suites passed: corrective sprint, product sprint, Home sprint, Athletics page, daily-use loop, dashboard appearance, frontend, UI. They cover recurrence/Today no-duplicates, view transitions, workload count changes, deadline filters, nutrition/sleep signals, workout cutoff, eight ordered color families, all legacy accent keys, persistence and existing task flows.
- Changed JavaScript syntax checks and final `git diff --check` passed. No backend changes; Python suites were not rerun.
- Browser fixtures: `tests/layout.html` at 1440/1536/390px; Home Tasks width 563px, title area 491px, all three Home bottom edges at 872px. Verified neutral computed deadline color and transparent pending border, no Weather condition outline, Maintenance tab placement, three Athletics heatmaps, nutrition/sleep save updates, 48 buttons/eight family labels, and no JS errors or mobile document overflow. Home/maintenance/Athletics/palette screenshots visually reviewed. Fixtures and dependencies remain in ignored `.test-deps/`.

## Next action / limitations

- Verify this commit's normal GitHub → Vercel production release when deployment verification is requested. No implementation blocker remains in this corrective scope.
- Earlier deferred provider/discovery/duplicate-cleanup work remains out of scope. Local upkeep/recovery/reflection data does not sync across devices.
