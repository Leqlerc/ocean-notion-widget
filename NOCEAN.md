# NOcean MVP

Vanilla HTML/CSS/JS with Python Vercel functions. Production remains the repository's existing GitHub → Vercel integration. No frontend build step or framework.

## Provider boundaries

- `api/tasks.py` → `lib/tasks.py`: normalized TaskStore, backed by Tasks master. GET lists tasks and editing options; POST creates; PATCH updates a task. Notion transport and server IDs live in `lib/notion.py`. The single `Project` rich-text property groups tasks into projects. Completion stamps Date Completed; reopening clears it.
- `api/events.py` → `lib/calendar.py`: events only. Existing Notion events are the fallback, visibly labeled as a potentially delayed sync. The original `api/calendar-data.py` and old widgets remain available.
- `api/dining.py` → `lib/dining.py`: official Purdue HFS v2 location/date menus and item nutrition. `rank_macro_picks` is the single ranking function. It ranks protein in 5g bands, then fat, then sodium, per published serving. Missing macros remain null. Nutrition is cached in warm instances for a day; menus for five minutes. Cold starts can take roughly 45 seconds; subsequent cached calls are much faster. Menu times are evaluated in Indianapolis time; closed courts show their next published meal (today or tomorrow).
- `api/recwell.py` retains the existing occupancy source and response fields. `lib/rec_hours.py` reads the official EMS schedule used by the RecWell website. CoRec occupancy is the existing fitness-area counter, not an estimate for the whole building. No aquatic occupancy is invented when no counter exists.
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

Desktop uses a bounded viewport grid with internally scrolling lists; below 1100px the page scrolls normally. CSS variables at the top of `nocean.css` control surfaces and typography.
