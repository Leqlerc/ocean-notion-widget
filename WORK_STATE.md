# NOcean Work State

## Multi-step tasks + Projects upgrade — 2026-09-26

Branch: `codex/multistep-projects-upgrade`, created from current `main` at `c934fdc`. The verified implementation is commit `d56aa48`. This branch is Preview-only and must not be promoted to Production without review.

## Task model and persistence

- Tasks now expose `taskType: Simple | Multi-step`. Missing `Task Type` values normalize to `Simple`; the Notion adapter lazily adds a compatible Select property on the first write. Existing `Difficulty` values remain stored and supported by the server but Difficulty is removed from normal task creation/editing/filtering UI.
- A Multi-step task is one concrete deliverable with a mostly-known checklist. A Project remains a changing outcome containing tasks, objectives, checkpoints, experiments, progress history, and notes.
- Steps are NOcean-tagged native child `to_do` blocks under the task page. The marker stores a stable request UUID and optional planned date. Only tagged blocks are listed, updated, or removed; unrelated task content is untouched. `/api/task-steps` is the dedicated ownership-checked CRUD boundary with edited-time conflict checks and idempotent creates.
- Completing the last open step marks the parent Done. Reopening a step reopens a Done parent to Next. Parent rows with steps use progress (`x/y`) instead of a completion checkbox, so parent completion never silently completes remaining steps.

## Planning and calendar semantics

- Simple tasks keep Today / Tomorrow / Upcoming / Backlog planning.
- Multi-step work-plan membership comes from open step dates. Unscheduled steps are Backlog. A due-today or overdue parent is forced into Today even when no step is planned there and shows a warning.
- Home and Tasks show only the steps relevant to the active work-plan view plus an all-steps disclosure. Focus remains parent-level and surfaces the next relevant open step.
- Calendar workload uses one parent boolean per date: any number of open steps on a date counts the parent once, the deadline also counts the parent on its date, and a same-day step plus deadline remains one workload item. The agenda can list that date's step names beneath the parent.
- Brightspace records remain excluded from manual task managers and are explicitly refused as Multi-step step owners.

## Projects workspace

- The old Projects → Tasks capture link is replaced by an in-place related-task composer/editor. It preserves the selected project relation and supports Simple/Multi-step type, priority, course, deadline, Simple planning, and Multi-step step editing without leaving Projects.
- Progress Snapshot reports truthful independent signals: task completion, objective achievement, checkpoint achievement, next checkpoint, target date, current workload, and last progress log when data exists. The bar is explicitly labeled `Task completion`; project lifecycle remains independent.
- Existing `milestone` blocks remain unchanged in storage and are presented as Checkpoints with target date, achieved state, sorting, and overdue styling.
- Additive native ProjectPlan kinds store Experiments (`Trying / Adopted / Dropped`) and dated Progress Log entries with optional `On track / Uncertain / Blocked` check-in state. Stable marker metadata carries state/timestamp; existing Overview, Objectives, Milestones, Notes, and all unrelated Notion blocks remain intact.
- Workspace hierarchy is Progress Snapshot, Immediate Focus / Related Work, then Checkpoints, Objectives, Experiments, Progress Log, Overview, and Notes with disclosures to limit visual weight.

## Verification

- JavaScript syntax passed for `tasks.js`, `home.js`, `projects.js`, `project-plan.js`, and `nocean-planning.js`.
- Focused Node suites passed: planning, multi-step planning/calendar deduplication, project model, Tasks DOM interactions, Projects interactions/progressive load, and ProjectPlan UI.
- Focused Python suites passed: task planning/type, task-step ownership/validation/completion semantics, project-plan compatibility/metadata, and provider task contracts. `python -m compileall -q api lib tests/preview_server.py` passed with the bundled runtime.
- Full Python discovery ran 91 tests: 82 passed, 6 disposable-database tests skipped, and 3 unrelated current-main assertions failed in coursework/calendar legacy fixtures. Focused changed-area suites are green.
- Browser QA used the local read-only/in-memory Preview server. Desktop and 390 px verified Tasks type/step editor, Projects workspace, in-place Multi-step creation, step completion and reopening, Checkpoint creation/snapshot, Experiment status, Progress Log state, touch sizing, and no horizontal overflow. Browser console had no warnings/errors. No production promotion occurred.
- `git diff --check` passed.

## Known limitations / next highest ROI

- Home quick-add can create a Multi-step parent but intentionally redirects detailed step authoring to the full Tasks or Projects editor to keep Home dense.
- Notion task listing currently loads child blocks for each Multi-step task; if the number of Multi-step tasks becomes large, add bounded parallelism or a short-lived server cache.
- Preview used the local fixture boundary because live Notion credentials were not exercised. After review, highest-value follow-up is a real Preview deployment smoke test against the configured Notion workspace before any Production promotion.
