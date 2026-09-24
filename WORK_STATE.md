# NOcean Work State

## Release checkpoint — 2026-09-23

Product sprint completed on `main`, based on `6f62599`. Commit/push follow this handoff update. GitHub → Vercel production verification for this release remains pending; local/browser checks are not proof of deployment.

## Implemented

- Home Deadlines is one chronological feed, with Due Date / All, Class, and Exams filters. Pending submission confirmations stay ahead of submitted items; existing historical hiding and independent submission state are preserved. Obsolete per-course limit settings were removed from the UI.
- Announcements/opening/availability notices are excluded from Home Deadlines and Events. Brightspace ingestion/read filtering now excludes standalone informational notices even without a matching due record. Stored records are not deleted. Ordinary scheduling is excluded from Deadlines; assignment/submission deadlines are excluded from Events. Routine events fill Next; exams/tests/quizzes and significant commitments fill On the Clock. Recitation/recitation-quiz pairs merge only for the same identified course and exact start instant.
- Maintenance / Upkeep has a dedicated section on Home and Tasks, with create/edit/remove, interval days, weekly weekday, and initial anchor date. Due items are projected directly into Today from the canonical local record: no copied tasks or duplicate generated occurrences. Completion advances from the actual completion date (weekly → next selected weekday). Legacy schedules receive a stable start anchor; one-time task planning is unchanged.
- Reflections is a fifth top-level destination with square tiles and title/date/type/content CRUD. Existing local reflection records remain visible; records no longer silently truncate at 100. Athletics no longer embeds the reflection editor. The legacy Machine route remains compatible.
- Athletics has a 26-week contribution heatmap, completed workouts this week/month, daily streak, and weekly consistency. Provider history supplies progress; only dates on/after September 24, 2026 count, and future dates are excluded. Existing older workouts are retained. No imported/backfilled progress records.
- Wiley/Windsor show up to three ranked protein picks from the existing pipeline. Existing occupancy thresholds/colors drive their borders, with stronger high-occupancy borders. Weather uses current WMO codes and wind speed for snow → rain/storm → wind → cloudy → clear border precedence.
- Tasks, Deadlines, and the Habitat bottom edge align on desktop using the existing grid row. Mobile retains stacked cards. All 24 original accent keys/colors remain, with 24 additional organized swatches (48 total).

## Persistence and boundaries

- Maintenance and Reflections reuse `nocean.command.settings.v1` / `nocean.machine.local.v1` on this device, matching the existing persistence boundary. No server database migration or cross-device sync was added. Save failures in the new editors are surfaced.
- Tasks, Projects, Athletics Daily logs, Training Sets, Exercises, and habits retain existing Notion providers. Google/Notion calendar source boundaries and partial-failure behavior remain intact. No live external records were mutated for tests.
- Existing theme/background/card customization and independent submission confirmation remain intact. Active pages carry refreshed script versions.

## Verification

- 24 Python tests passed: `tests.test_coursework` and `tests.test_iteration`, including the progress cutoff and stricter lifecycle exclusion.
- Nine Node suites passed: product sprint, Home sprint, Athletics page, daily-use loop, product reset/navigation, dashboard appearance, frontend, UI, and deadlines (five time zones). Coverage includes classification, conservative recitation deduplication, cross-course chronological ordering and filters, interval/weekly recurrence, Today auto-population/no duplicates, reflection CRUD/persistence, and weather precedence.
- Changed JavaScript syntax checks, Python compileall, and `git diff --check` passed.
- Local browser fixtures: `tests/layout.html` showed no overflow at 1440, 1536, and 390px (including Tasks). Desktop Tasks/Deadlines/Habitat bottoms measured exactly 872px. Home screenshots visually reviewed at desktop and mobile. Reflection create/reload worked at 390px; no script errors with complete provider fixtures. Test dependencies and screenshots are isolated in ignored `.test-deps/`.

## Remaining / next action

- Verify the pushed commit reaches READY Production through the existing GitHub → Vercel integration, then check live classification and data display read-only.
- Habitat still uses the previously documented temporary star artwork; this sprint only changed alignment.
- Earlier deferred work remains: richer Brightspace discovery, multipart coursework, optional provider migration, and owner-authenticated duplicate reconciliation. No cleanup/archive operation was performed; scheduled Brightspace timing remains unproven.
