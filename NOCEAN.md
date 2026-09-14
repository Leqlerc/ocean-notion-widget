# NOcean

Vanilla HTML/CSS/JS with Python Vercel functions. Production remains the repository's existing GitHub → Vercel integration. No frontend build step or framework.

## Provider boundaries

- `api/tasks.py` → `lib/tasks.py`: normalized TaskStore, backed by Tasks master. GET lists tasks and editing options; POST creates; PATCH updates a task; DELETE moves it to recoverable Notion Trash. Notion transport and server IDs live in `lib/notion.py`. The single `Project` rich-text property groups tasks into projects. Completion stamps Date Completed; reopening clears it.
- `api/events.py` → `lib/calendar.py`: events only. Existing Notion events are the fallback, visibly labeled as a potentially delayed sync. The original `api/calendar-data.py` and old widgets remain available.
- `api/dining.py` → `lib/dining.py`: official Purdue HFS v2 location/date menus and item nutrition. `rank_macro_picks` is the single ranking function. It prioritizes rotating menu items, then protein-to-fat efficiency, protein, and sodium per published serving. Missing macros remain null. Nutrition is cached in warm instances for a day; menus for five minutes. Cold starts can take roughly 45 seconds; subsequent cached calls are much faster. Menu times are evaluated in Indianapolis time; closed courts show their next published meal (today or tomorrow).
- `api/recwell.py` retains the existing occupancy source and response fields. `lib/rec_hours.py` reads the official EMS schedule used by the RecWell website. B&G occupancy uses the B&G counter; its hours are labeled as CoRec facility hours. No aquatic occupancy is invented when no counter exists.
- Open-Meteo is called directly by WeatherProvider in `nocean.js`.

The browser's TaskStore, CalendarProvider, DiningProvider, RecProvider, and WeatherProvider consume application data. Providers load independently. Task writes have optimistic rollback and suppress racing refreshes. Google/Notion credentials never enter client code. This is the requested single-user MVP without account authentication; write routes restrict browser cross-origin requests and task IDs to the configured task store.

## Configuration

The existing `NOTION_TOKEN` continues to be required. Optional server overrides are `NOTION_TASKS_DATA_SOURCE_ID` and `NOTION_EVENTS_DATA_SOURCE_ID`. Existing deployments use the current server-side defaults. Tasks master now has `Project` as rich text; no views or dashboards were changed.

For direct Google Calendar, configure **all three** Vercel environment variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`, from one Google OAuth connection with the `https://www.googleapis.com/auth/calendar.readonly` scope. Optional `GOOGLE_CALENDAR_IDS` is a comma-separated list; default is `primary`. Redeploy after configuration. The refresh token must be durable for ongoing access (Google consent apps left in external Testing may issue expiring refresh tokens). No OAuth UI is implemented. Until this is configured, the existing synced events remain functional. Google failures do not silently switch to an older source labeled as direct.

Calendar checks run on load, focus, return to a visible tab, and every 45 seconds while visible. Tasks refresh every 90 seconds and after edits; campus data every five minutes. No automations are modified. Done-today counts use the current campus date and reset on day rollover.

## Checks

```
node --check nocean.js
node tests/test_frontend.cjs
python -m unittest discover -s tests -v
python -m compileall -q api lib
```

Tests use mocked provider calls and do not change live tasks. Backend checks cover completion/reopen semantics, timed-deadline preservation, project text, validation, cross-store write rejection, and dining ranking. Frontend checks cover project next-action priority, Today/done filters, exclusive all-day event ends, escaping, and optimistic rollback.

Desktop uses two columns for tasks, campus, dining, and projects, followed by a full-width events/calendar card. Page scrolling is intentional (roughly 1.5–2 laptop screens); the calendar and source footer occupy separate natural-flow rows. CSS variables at the top of `nocean.css` control surfaces and typography.

Live verification: Vercel build succeeded; all provider endpoints returned real data. Browser quick-add, project grouping, and basic editing were verified. `tests/layout.html` embeds the dashboard at the two acceptance dimensions for repeatable viewport checks.

## Athletics and shared appearance

`athletics.html` / `athletics.js` → `api/athletics.py` → `lib/athletics.py` use the existing Daily log, Set log, and Exercises through the shared Notion transport. GET loads the selected week, selected-day sets, active exercises and four weeks of recent workouts. PATCH changes only workout type/quality or Rehab/Stretch/Cardio/Swim (and the existing Log flag). POST creates a completed set with Day and Exercise relations, reps, external load, warm-up, optional RIR; DELETE archives a mistaken set. Existing formulas and rollups remain authoritative. Source URL supplies retry deduplication. Writes validate store ownership and fields; no schema, views, icons or automations changed.

Workout Quality marks completion; reopening clears it. The weekly default is Monday Push / Pull / Legs / Rest / Push / Pull / Legs; stored workout types take precedence. Rest is a planned recovery day, not a new Notion select option. Exercises come from the current exercise catalog, with rotation items first; no assigned routine is invented. Bodyweight/assisted sets can log reps without external-load volume. Optional source overrides: `NOTION_DAILY_DATA_SOURCE_ID`, `NOTION_SETS_DATA_SOURCE_ID`, `NOTION_EXERCISES_DATA_SOURCE_ID`. Facilities fail independently from training; unavailable set/exercise data disables logging while daily support/completion remain usable.

`nocean-shared.js` shares transport, date helpers, and facility rendering. `nocean-ui.js` shares navigation, guarded shortcuts and the `nocean.decorated` localStorage preference. `nocean-decorated.css` is the only decorative layer; both modes use identical DOM and provider logic. Home shortcuts: N or / quick-add, 1/2/3 Today/Upcoming/All; both pages use R refresh, ? help, Escape close. Typing, dialogs and system modifiers suppress page shortcuts.

`calendar-semantics.js` classifies events once for both the list and calendar. Priority: exam, assessment, presentation, personal, break, class. Each date exposes event names via title/ARIA. `DirectGoogleCalendarProvider` refreshes/caches an access token, paginates recurring occurrences across configured calendars, and ignores cancelled events. `/api/events` exposes `direct`, `source`, and missing configuration variable names without secrets. The full snapshot makes edits/removals appear on the next 45-second refresh. With credentials configured, Google is used directly and Notion is never queried by this provider.

Additional checks: `node tests/test_ui.cjs`, `node --check athletics.js`. Mocked tests cover calendar provider selection/pagination, semantic priority, keyboard guards/theme persistence, and scoped training writes, retries and failures. Production browser checks use `tests/layout.html` for 1440×900 and 1536×864.
