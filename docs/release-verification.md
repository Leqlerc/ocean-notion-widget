# PR #1 release verification

Update: the user explicitly waived the remaining mobile gate during the implementation sprint. PR #1 merged as ad9c92f and production READY deployment dpl_68PUfW4WMzgYj15Cj4N5YhYwg4wn passed a minimal Projects/Tasks HTTP smoke check. The records below describe earlier verification, not a current release block.

Checked 2026-09-20 against application commit `061dac454af99fd81de16c2debe604c00b132efc`, READY deployment `dpl_BNor3AihPX9WXqtyqgZSqVridgKd`.

Project: `prj_OLAnEKEEsQ3UDm35NAYOBGChtCEV`, team `team_dU7W9Acdpgi8v6eLzDGS0TP1` / `yiqwill-3102`. Connector authorization and protected Preview access work. No authentication protection was disabled.

Preview: https://ocean-notion-widget-git-feature-goals-foundation-yiqwill-3102.vercel.app

## Live desktop results

| Flow | Result |
| --- | --- |
| Projects create and reload | Saved project name and target persisted |
| Target and lifecycle edits | Oct 5 changed to Oct 6; Completed status persisted on returning to Projects |
| Search and status filter | Exact QA project returned in Completed |
| Independent lifecycle | Completed project correctly showed 0 of 1 tasks complete, with one open task |
| Related work and next actions | QA task appeared with Backlog and unchanged deadline |
| Scoped capture and editor link | Project preselected; task link opened the correct editor |
| Today | New QA task appeared immediately in Today after server save |
| Tomorrow | Row move persisted on reload; deadline unchanged |
| Backlog | Explicit deferral persisted through edits and reload |
| Upcoming | Nine existing tasks displayed in days 2–14; explicitly deferred QA task excluded |
| Editing | Name and Hard difficulty saved and survived navigation/reload |
| Completion | Task disappeared from open list, appeared checked in Show done |
| Undo | Completion Undo restored open task; reload confirmed persisted state |
| Deadline preservation | Sep 24, 2026 at 16:45 local stayed unchanged through planning, edits, completion and Undo |
| Task archive | Archive succeeded; reload showed zero tasks for the QA project |
| Project archive | Archived lifecycle and Oct 6 target persisted on reload |
| Desktop layout | Projects detail and Tasks screenshots visually reviewed at 1363 × 936 |

Only newly created QA records were changed. Task `3e177f3e-dfc6-8116-aa5e-c0d1f6943a45` is recoverable from Notion Trash. Project `3e177f3e-dfc6-81ed-a8a3-e34bfd9468c6` remains in Archived. No existing user records were edited or deleted.

The browser checkbox `check()` helper timed out after the completion action removed its target; visible Show done state confirmed the save. A subsequent completion using click plus immediate Undo passed. This was an automation timing issue, not a reported app failure.

## Remaining release gate: mobile

Mobile is **not verified** in this run. The available browser API has no viewport-resize capability; DevTools shortcuts had no effect. Navigation to a narrow iframe test document using a data URL was rejected by browser security policy, which permits only HTTP/HTTPS. No alternate control surface or workaround was used.

On a phone or supported responsive browser at approximately 390px wide:

1. Open the Preview Projects list, a project detail and its Edit project dialog. Check wrapping, scrolling, target-date input and reachable Save/Cancel controls. Cancel edits to existing projects.
2. Follow a project task link to Tasks. Check navigation wrapping, Capture fields, queue controls, filters, task rows and editor Save/Cancel/Archive controls. Do not archive an existing task.
3. If testing saves on mobile, create clearly marked disposable records and archive only those afterward. Confirm no horizontal clipping and that the keyboard does not make actions unreachable.
4. Record device/viewport, deployed commit and result here. Fix any regression before merge.

Once this gate passes, recheck PR HEAD/build and use the user's existing authorization to merge PR #1. Verify the production deployment corresponds to the merged code; repeat a disposable Projects/Tasks save/reload/cleanup smoke test. Production has not been deployed or verified for this release yet.

SQL/owner authentication remains the next implementation priority, following `database-preview-runbook.md`. Do not restart completed Tasks work.
