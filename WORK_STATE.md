# NOcean Work State

## Current branch — 2026-09-25

`codex/home-functionality-sprint` contains the functionality-first Home sprint. It is based on `main` at `91c038a` and includes the resolved rollback already staged when this sprint began. The branch is not intentionally promoted to Production.

## Implemented

- Task Manager now represents manually created work only. Brightspace-source records remain in the shared Notion store but are excluded from Home and the full Tasks page. Planning Today does not imply Focus.
- Quick-add and edit support optional Course plus persistent Critical / High / Normal / Low Priority. Legacy tasks normalize to Normal. The Notion adapter uses an existing compatible Priority select or adds the backward-compatible select property on the first priority write.
- Home supports persisted Plan / Priority / Due date sorting. Due dates are quiet metadata; compact Priority and Focus controls share the title row. Focus is exclusive, appears in a visually separate section above sorted work, and legacy multi-focus state is presented safely.
- Academic Safety Net now accepts Brightspace-source coursework only. Manual course-tagged tasks cannot enter it, pending yellow bars are removed, standalone access/availability lifecycle notices are filtered, and configured courses with no detected items show a neutral incomplete-coverage state.
- Events show minute-granularity countdowns without provider refetches. Centralized class-name cleanup removes explicit Section/Sec suffixes and Purdue CRN-section suffixes while retaining meaningful names/numbers.
- Campus Signals weather includes condition icons, current/feels-like temperature, wind, today/tomorrow highs and lows, and rain windows using Open-Meteo. Dining renders up to three existing ranked picks per displayed court and shows Wiley Sizzling Pasta Strip only when the current published meal contains that station.
- Existing Home / Projects / Athletics / Settings boundaries, Calendar provider behavior, submission verification, partial-provider failure behavior, project persistence, and server-side credentials remain intact.

## Verification

- Node syntax: `home.js`, `tasks.js`, `calendar-semantics.js`, `nocean-store.js`.
- Node DOM suites: Home sketch UI, Home sprint, daily-use loop, full Tasks interactions, and planning.
- All 20 Node `.cjs` suites passed.
- Python discovery: 86 passed, 6 database integration tests skipped because no disposable test database was configured.
- `python -m compileall -q api lib` passed.
- Browser preview: inspected desktop and 390 px. Seven compact task rows fit the live Today list; Focus and Priority remain visible at 390 px; Focus treatment, Safety Net, countdowns, weather, and three dining picks render without horizontal card overflow. No console warnings/errors were reported.
- `git diff --check` passed.

## Boundaries and main follow-up

- The current Brightspace integration is still an iCalendar feed and cannot guarantee full assignment/submission coverage.
- Highest-priority follow-up: investigate authenticated direct Brightspace/D2L assignment discovery through official APIs—enumerate current courses, retrieve Assignment/Dropbox folders and due dates, read the current user's submission state, and determine whether Purdue permits the required student/application authentication. Prefer a real API integration; evaluate browser automation only if Purdue does not offer usable authentication.
- Local credentials were unavailable, so the live Notion schema could not be inspected from this checkout. The adapter detects the schema at runtime and only accepts a compatible Select property; it performs a non-destructive Priority property addition when missing.
