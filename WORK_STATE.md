# NOcean Work State

## Release checkpoint — 2026-09-25

The current release candidate is `integration/home-functionality-current-main`, rebuilt directly on top of `main` at `f4c74e8` rather than merging the stale Codex branch wholesale. A backup of the pre-promotion main exists at `backup/pre-home-functionality-merge-2026-09-25`.

## Implemented

- Task Manager is manual-work only on Home and the full Tasks page; Brightspace imports remain stored but do not populate task views. Today planning no longer implies Focus.
- Quick-add/edit support Course and persistent Critical / High / Normal / Low Priority. Home supports persisted Plan / Priority / Due date sorting. Focus is exclusive and appears in a separate highlighted section above normal tasks.
- Academic Safety Net contains Brightspace-source coursework only. Manual course-tagged tasks cannot enter it. Standalone Brightspace availability/open lifecycle notices are excluded, pending yellow bars are removed, and empty configured courses can show that no coursework was detected while noting feed coverage is incomplete.
- Current-main deadline behavior is preserved: deadlines default to one chronological list and can switch to class grouping. Current-main Home layout is preserved, including the expanded Events column and no Dragonair Habitat.
- Events retain current ordering/significance behavior and add minute-level countdowns plus conservative class section-label cleanup.
- Weather adds condition icons, feels-like temperature, wind, highs/lows and rain windows using the existing Open-Meteo provider.
- Dining renders up to three existing ranked protein picks per displayed court and surfaces Wiley Sizzling Pasta Strip only when the current published meal contains that station.
- Existing newer main work, including Cove Tree/background repairs and current Home proportions/layout, is preserved.

## Verification

- The original functionality sprint passed all 20 Node CJS suites and 86 Python tests (6 disposable-database integration tests skipped), plus JS syntax, Python compile, desktop and 390 px browser checks.
- The resolved integration branch is a strict descendant of current main and changes only 12 intended files: Home/task UI and logic, task persistence/planning, coursework filtering, event semantics, weather config, and dining station data.
- Vercel Preview for resolved commit `72b40df` built READY and the Home route returned HTTP 200 with the expected current-main layout plus new task controls/assets.
- Direct local re-run of the test suite was not possible from this chat runtime because outbound Git clone/DNS is unavailable; no claim is made that the reconstructed branch reran the complete local suite here.

## Main follow-up

The Brightspace integration is still an iCalendar feed and cannot guarantee complete assignment/submission coverage. Highest-priority follow-up: investigate authenticated direct Brightspace/D2L APIs for current courses, Assignment/Dropbox folders, due dates, and the current user's submission state. Prefer an official API integration; evaluate browser automation only if Purdue does not expose usable authentication.
