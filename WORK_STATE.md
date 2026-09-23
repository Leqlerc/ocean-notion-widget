# NOcean Work State

## Current release checkpoint — 2026-09-23

Daily-use sprint implemented from GitHub `main` at `9635efc839ce51df1818d85672eb68ab9c54df74`. Candidate is entering Preview verification; Production still runs that base commit (`dpl_wkSq8WSxF1DTJCjGoAMDBSFmYHi4`, READY). Do not describe the candidate as shipped until promotion is verified.

## Implemented

- Home uses shared TaskPlanning Today / Tomorrow / Upcoming / Backlog buckets, with capture and stale-refresh guards. Planning preserves actual deadlines.
- Deadlines use explicit pending/submitted confirmation, reversible on the same device. Submission completes an open task; task completion never claims submission. Submitted items remain visible and leave the confirmation count.
- Calendar has five progressively darker reds, independent Today/selection/event indicators, and persisted Off / Solid fill / Outline only control separate from task difficulty.
- Campus captions and content rows align in three desktop columns; mobile stacks. Dining ranks official measured protein:fat efficiency, then protein; missing macros remain missing and zero-fat ranking uses a 1g floor.
- Canonical Grand Reef, Jelly Caves, and Mushroom Forest assets are replaced byte-for-byte with supplied artwork (Grand Reef 3).
- Brightspace applies deterministic org-unit mappings: 1640342 MFET 163, 1631262 CS 159, 1636988 HONR 19901, 1634573 ENGR 161, 36061 COM 114; 1134648 is Purdue requirements. Generic 6824 gets no invented class.
- Exact course/title/due-time deduplication preserves planning/completion/focus/difficulty/projects. Matching lifecycle notifications and explicit weekly availability containers are filtered. Lone potentially actionable availability records are retained conservatively.
- Settings exposes persistent incomplete-sync counts, last success, errors, cron-route completion evidence, and bounded owner-authenticated duplicate review/reconciliation. Reconciliation repoints mappings before recoverable archive and refuses tasks with notes or conflicting tracked state.

## Verification and live state

- Backend: 82 tests, 76 passed, six disposable-database tests skipped. Includes Google moved-event regression (existing implementation unchanged), coursework identity, lifecycle, partial sync and field preservation.
- Targeted DOM tests passed: daily-use task/submission loop, Home, appearance preferences, integration UI, task interactions and shared frontend contracts.
- Local desktop/mobile layout fixture measured aligned Campus captions and first/second rows, no horizontal page overflow at 390px. Visual inspection caught compressed Deadline sections; grid tracks now preserve their content height.
- Read-only Production snapshot reconciliation found 22 deterministic duplicate pairs with no tracked-state conflicts before final canonical-priority refinement. No live task archive has been performed yet.
- Production Brightspace was connected, with last recorded success September 21 at 3:16 PM local. Outlook is not connected and is non-blocking.
- Production was missing CRON_SECRET. A new random secret was added through Vercel without exposing its value; it takes effect on the next deployment. Timed scheduled execution is not yet proven. Existing schedule remains 11:15 UTC daily.

## Next action

Verify candidate Preview, push the verified tree to main, verify its READY Production deployment, then use owner-authenticated duplicate review/reconciliation and bounded sync. Record exact deployed commit and results here. Preserve the existing four-destination UI and Notion/provider boundaries; no database migration or architecture cutover is part of this sprint.

## Remaining limitations

Submission confirmation and appearance preferences remain device-local. Some availability-only feed records lack a matching real deadline and are deliberately retained. Preview has no private Brightspace configuration; use mocked write/retry tests and read-only live task checks there. Scheduled timing needs a real timed invocation after the secret-enabled deployment. Athletics remains the existing placeholder linked to the working Machine tracker; SQL Goals remains inactive.
