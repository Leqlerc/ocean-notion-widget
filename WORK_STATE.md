# Willpower Work State

## Product direction — 2026-09-26

**Product name:** Willpower. `NOcean` is now a legacy project/repository name and may remain in code until a deliberate rename/migration. The product is no longer conceptually tied to Notion.

**Target:** reach a finished, daily-driver version by **October 10, 2026**. The goal is a product that is used far more than it is modified. Avoid speculative features, redesign churn, and infrastructure work that does not directly improve daily use.

**Purpose:** Willpower is a personal control system designed to live on a second monitor and give one place to understand, manage, and improve day-to-day life. It should combine high information density with low interface clutter, surface reality rather than make decisions for the user, and preserve long-term progress/experiments without turning into another system that requires constant maintenance.

### Core product surfaces

- **Home:** calm default screen with time, a deliberate non-AI-generated quote, a Focus Mode entry point, minimal text, and a subtle Formula-1-style daily productivity indicator using three low-key sector bars (purple = exceptional, green = good, yellow = mediocre). Also expose a user-controlled lockdown/focus control when technically practical.
- **Tasks:** fast task capture and management, academic deadlines, Gmail sync, future Outlook sync, a compact view of what is next, and optionally a small week/calendar view. Tasks should be executable actions; bounded multi-part deliverables may contain subtasks without becoming full Projects.
- **Calendar:** Google Calendar remains authoritative. A dedicated Willpower calendar view is optional rather than required for 1.0 unless it adds clear value beyond Google Calendar; workload visualization and compact calendar context may instead live in Tasks/Home.
- **Projects:** specialized full-screen project workspaces selected from a top project switcher, with Short-term and Long-term categories. Core long-term examples are Typing, Gym, and Soccer. Projects support longitudinal progress, consistency/heatmap views, notes, measurements, experiments/changes, and project-specific analytics. Typing should eventually ingest Monkeytype and Nitrotype stats/races with WPM history and graphs. Short-term examples include COM 114 test-out or reaching a 225 lb bench.
- **Health:** workout logging plus health tracking. Planned domains include sleep (eventually Oura-connected), nutrition with Purdue dining data and later AI image estimates, and other useful health/training signals.
- **Analytics & Reflections:** searchable/filterable longitudinal data across tasks, focus-session duration, typing, workouts, sleep, meditation, projects, nutrition, and other tracked domains. Reflections are short daily debriefs—what worked, what did not, and what to adjust—not long journal entries. A future AI assistant should have permissioned access to this data to identify patterns and suggest improvements.
- **Campus:** a full Purdue situational-awareness page: dining hall best picks, facility occupancy (CoRec/TREC/AREC/WALC where available), operating status, relevant special events with time/place, and eventual BoilerLink/event integration. Goal: avoid checking many Purdue sites separately.
- **Settings:** configuration for appearance/themes, quotes, integrations, and page-specific options without turning Willpower into an endlessly customizable dashboard builder.

### Core integrations / capabilities

Current or desired core capabilities include task management, Google Calendar sync, Focus Mode, nutrition tracking, Monkeytype/Nitrotype statistics, sleep tracking, productivity/screen-time limiting, workout logging, academic deadlines/events, Gmail sync, eventual Outlook sync, and Purdue campus data.

### Product rules

- **High information density, low visual clutter.**
- **Icons for familiar actions; words for information.** Hover/tooltips and accessible labels must preserve discoverability.
- **Surface only what is relevant now; deeper data belongs one interaction deeper.**
- **Capture must be fast, with richer details available afterward.**
- **Show reality, trends, and status; do not over-prescribe decisions.**
- **Longitudinal tracking should make it obvious when effort is not producing results and when an experiment/change deserves review.**
- **Reuse authoritative external systems when they are already good (especially Google Calendar) instead of rebuilding them without clear ROI.**
- **Willpower should eventually enter maintenance mode. A feature is worth adding only when it removes recurring real-world friction or produces actionable insight.**
- **No filler/helper copy or AI-slop microcopy. Text must be intentional.**
- **The finished product should feel calm enough to remain open all day on a second monitor.**

### Near-term priority

Finish and stabilize the pieces already closest to daily use before expanding scope: task/deadline reliability, Focus Mode, visual/CSS cleanup, Projects progress tracking, and the nutrition foundation. Defer optional calendar replacement, deep AI, and additional integrations if they threaten the October 10 finish line.


---

## Current implementation handoff

## Multi-step tasks + Projects upgrade — 2026-09-26

Branch: `codex/multistep-projects-upgrade`, created from current `main` at `c934fdc`. Feature implementation is `d56aa48`; Vercel function-cap compatibility is `1b7b4a5`. This branch is Preview-only and must not be promoted to Production without review.

## Task model and persistence

- Tasks now expose `taskType: Simple | Multi-step`. Missing `Task Type` values normalize to `Simple`; the Notion adapter lazily adds a compatible Select property on the first write. Existing `Difficulty` values remain stored and supported by the server but Difficulty is removed from normal task creation/editing/filtering UI.
- A Multi-step task is one concrete deliverable with a mostly-known checklist. A Project remains a changing outcome containing tasks, objectives, checkpoints, experiments, progress history, and notes.
- Steps are NOcean-tagged native child `to_do` blocks under the task page. The marker stores a stable request UUID and optional planned date. Only tagged blocks are listed, updated, or removed; unrelated task content is untouched. `TaskStepStore` is the dedicated ownership-checked CRUD boundary with edited-time conflict checks and idempotent creates; its HTTP operations share `/api/tasks` to remain within the Vercel Hobby function cap.
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
- Browser QA used the local read-only/in-memory Preview server. Desktop and 390 px verified Tasks type/step editor, Projects workspace, in-place Multi-step creation, step completion and reopening, Checkpoint creation/snapshot, Experiment status, Progress Log state, touch sizing, and no horizontal overflow. Browser console had no warnings/errors.
- GitHub/Vercel Preview for `1b7b4a5` reached READY at `https://ocean-notion-widget-ffhpqhf43-yiqwill-3102.vercel.app` after keeping the deployment at the Hobby-plan limit of 12 functions. The protected Preview returned its Vercel login gate externally, so authenticated live-data UI was not re-exercised there. No Production promotion occurred.
- `git diff --check` passed.

## Known limitations / next highest ROI

- Home quick-add can create a Multi-step parent but intentionally redirects detailed step authoring to the full Tasks or Projects editor to keep Home dense.
- Notion task listing currently loads child blocks for each Multi-step task; if the number of Multi-step tasks becomes large, add bounded parallelism or a short-lived server cache.
- Preview used the local fixture boundary because live Notion credentials were not exercised. After review, highest-value follow-up is a real Preview deployment smoke test against the configured Notion workspace before any Production promotion.
