# NOcean Work State

## Release checkpoint — 2026-09-23

Targeted Home/Athletics sprint is implemented on `main`, based on `a9b1db36cf7e6f9d7a02ae50b794924c4cf234af` (verified READY Production deployment `dpl_EP9LKnCKNwPaWNEVQXeLr8fAtXUu`). This commit is the release candidate; replace this checkpoint after GitHub → Vercel deployment verification.

## Implemented

- Settings → Home Layout independently controls Tasks, Deadlines, Events, Campus, Calendar, Weather, Training Facilities, and Dining. Dragonair Habitat is temporarily removed so Events owns the full side column. Preferences save immediately on this device; hidden cards leave layout flow and remaining columns expand.
- Deadlines defaults to one chronological due-date list across classes. A Sort control can switch to the existing class-grouped accordion view; Brightspace availability/lifecycle notices (for example “Available,” “Availability Ends,” “becomes available,” or “opens”) are excluded from Academic Radar. Submission confirmation remains separate from task completion.
- Home desktop proportions still favor Tasks over Deadlines (1.35fr vs 1.2fr). Events now fills the entire 620px side column on desktop, replacing the temporarily removed Habitat space.
- Home task rows provide direct Focus and + Today controls, including on mobile. Today planning preserves the actual due date. Right-side due badges distinguish overdue, today, tomorrow, and future dates.
- One Events card contains chronological Next (1 / 3 / 5 / 8; default 3) and three significant On the Clock entries. Routine classes never outrank earlier events or fill the significance list.
- Home excludes Notion Google mirrors and unknown-origin Notion events even during outages. Google directly loads primary, Purdue Classes and Class Deadlines using known calendar IDs; GOOGLE_CALENDAR_IDS remains an explicit override. Explicit HTTPS Purdue academic sources remain eligible from Notion (11 independent academic entries were identified in the live snapshot, including Purdue Brightspace). Provider/calendar partial failures report warnings. Legacy standalone widgets/endpoints are retained, not used by Home.
- Accent settings now use 24 swatches, organized into six hue columns from pastel to dark; include light green, ice, lavender, Eclipse black, true black, gray and white. Semantic workload/status colors remain independent; dark accents retain readable text.
- Athletics now opens the existing complete Machine tracker directly, preserving all provider behavior. Week/date selection also updates nutrition, sleep, and habits consistently. Existing `/machine.html` remains available.
- Existing conservative Brightspace identity/lifecycle filtering, historical completed-coursework hiding, and bounded owner-authenticated duplicate reconciliation are reused. No uncertain work, real overdue work, notes, or user state was archived or deleted.

## Checks actually run

- 23 Python tests passed: `tests.test_iteration`, `tests.test_coursework` (calendar defaults/pagination/deletions/partial failure, independent-source allowlist, Athletics provider guards, coursework filtering/state preservation).
- Node suites passed: Home sprint, Athletics page, daily-use loop, Home sketch UI, dashboard appearance, product reset, deadlines across five time zones, shared frontend and UI contracts.
- Changed JavaScript syntax checks and `python -m compileall -q api lib` passed. Final `git diff --check` required before commit.
- Browser: inspected Home at desktop and 390px; `tests/layout.html` measured no overflow at 1440, 1536 and 390px. Hidden Tasks/Events/Habitat gave Deadlines full width; a single Campus detail filled the Campus width. Accent change left computed workload red unchanged. Athletics loaded live read-only data with set controls enabled and no mobile overflow. Browser reported no script errors. Write interactions used disposable fixtures only.
- Production before this release: Google returned 31 events; Notion contributed stale Google copies, including Deload week. Post-release verification must confirm additional class calendars and absence of that stale event.

## Boundaries and remaining limitations

- Notion still backs Tasks, Projects, Athletics Daily logs, Training Sets, Exercises, and Daily-log habits. Eleven independently sourced academic Events are retained for now. Nutrition, sleep, maintenance, reflections, layout/appearance and submission confirmation retain existing device-local storage. No Neon cutover, schema migration, or broad provider rewrite.
- Recoverable live duplicate archiving was not executed: locally exported production credentials are redacted, so an owner-authenticated cleanup session is unavailable. Existing Settings review/reconcile remains the safe continuation path; the prior handoff reported 22 deterministic duplicate pairs, not a fresh verified archive count. Active views already suppress compatible duplicates and known generated lifecycle noise.
- Unknown-source Notion-only events are excluded rather than guessed to be independent. The current Google connection cannot list calendars. Known server-side calendar IDs avoid requiring that scope; inspect per-calendar warnings if access changes.
- Scheduled Brightspace execution timing remains unproven; this sprint does not expand LMS ingestion or alter schedules.

## Next recommended sprint

1. Richer Brightspace assignment discovery and reliability.
2. True parent-task/subtask support for multipart coursework.
3. Later migration of Tasks/Projects/Athletics away from Notion if justified.
