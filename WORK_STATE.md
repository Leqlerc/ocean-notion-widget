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

Current or desired core capabilities include task management, Google Calendar sync, Focus Mode, nutrition tracking, Monkeytype/Nitrotype statistics, sleep tracking, productivity/screen-time limiting, workout logging, academic deadlines/events, custom academic schedule imports, Gmail sync, eventual Outlook sync, and Purdue campus data.

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

## Current branch

`main` contains the reviewed Multi-step Tasks / Projects upgrade and the current targeted NOcean QOL patches. Production still follows the repository's existing GitHub → Vercel integration.

## Current behavior

- Home, Tasks, and Projects use reduced page copy. Home no longer generates motivational quotes, and obvious Refresh/Edit actions use labeled icon controls. Home has a prominent live time display above the greeting while retaining the date beneath it; the clock is sized to stay visually subordinate to the overall header and can be hidden from Settings → Home Layout.
- Simple tasks retain Today / Tomorrow / Upcoming / Backlog planning. A canonical Backlog task due today or tomorrow is also derived into that matching day view without moving or duplicating it; due-today surfaced rows display Critical in Today. The same record remains editable/completable and continues to appear in Backlog. Home keeps planning controls out of task rows; the edit modal preselects the current Today / Tomorrow / Backlog / Automatic state and highlights that selection with the active accent color, so planning changes happen one interaction deeper without list clutter.
- Home and Tasks place Sort in the same responsive row as Today / Tomorrow / Upcoming / Backlog. Home quick-add no longer assigns Projects; Project-linked tasks are normally created from the Projects workspace, while quick-add exposes Type as Simple / Complex (Complex maps to the existing Multi-step model). Difficulty remains stored and provider-compatible but is absent from normal task list/create/edit UI.
- Multi-step task disclosures sit directly beneath their parent metadata with the same compact spacing when collapsed or expanded.
- On Home, Multi-step disclosure is a filled triangle immediately after the task title, so it no longer shifts priority/focus controls. Expanding it reveals the subtask list beneath the row.
- Projects create and edit related tasks in-place through the modern task modal pattern. The selected project is always supplied as `projectId`; name, type, priority, course, due date/time, planning, and Multi-step steps use the existing task/deadline/planning APIs. Successful creates are inserted into the selected project immediately.
- Academic Safety Net defaults to Next, sorting upcoming coursework chronologically with the nearest due item first. Coursework from dates before today is hidden from the Safety Net automatically without deleting its underlying record or historical calendar data.
- Multi-step parents, native tagged child steps, project checkpoints/objectives/experiments/progress logs, calendar workload semantics, Brightspace separation, and the Home / Projects / Athletics / Settings boundaries remain unchanged. The project-item editor now gives labels and controls explicit grid spacing so Objective / Checkpoint forms do not visually collide.

## Verification

- JavaScript syntax checks pass for `nocean-planning.js`, `tasks.js`, `home.js`, and `projects.js`.
- Focused planning, Tasks DOM, Projects interaction, and Home sketch suites pass using the existing `.test-deps/node_modules` runtime.
- `git diff --check` passes.

## Planned academic-source extension

- Add a Custom Schedule import source for courses whose obligations are not represented in the Brightspace calendar feed (for example MA 261/MyLab). Accept syllabus/calendar documents, extract candidate obligations into the same normalized academic-deadline model, and require a preview/confirm step before saving. Preserve source identity so re-imports update/dedupe rather than duplicate deadlines. Brightspace remains one source, not the definition of coursework.

## Known limitations / next validation

- The Projects modal intentionally keeps page-local form markup to avoid a broader component refactor, while sharing the same task store, planning, deadline, and step APIs as Tasks.
- No live Notion records were mutated and no production deployment was performed in this QOL pass. A real Preview smoke test remains the next release validation before promotion.
