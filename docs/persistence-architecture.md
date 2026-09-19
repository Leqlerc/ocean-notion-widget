# Persistence architecture — September 2026 checkpoint

Status: proposed target model, not a deployed SQL schema. The only migration applied in this run is `migrations/001_notion_task_planning.md`. Existing Notion records remain authoritative.

## Runtime and boundaries

Keep static module pages and Python serverless APIs. Share browser transport and pure policy; do not duplicate records between Home and detailed pages. Notion already supplies durable related Tasks, Projects, Training Days, Exercises and Sets. It can support the current task-planning increment without an immediate bulk migration.

Provision managed PostgreSQL before adding the new multi-entity systems. Do not use local SQLite or deployment files on Vercel for persistence. Obtain authorized Vercel team access first; the current connector returned 403 for yiqwill-3102. Then provision through an approved provider, add a pooled server-only DATABASE_URL, pin the Python driver, and verify connectivity in Preview. No database credentials currently exist in this workspace.

The application currently checks browser request origin but has no authenticated owner boundary. Before exposing new personal records, implement a server-verified session for the single approved owner, secure HttpOnly/SameSite cookies, CSRF protection for mutations, and authorization on every record lookup. Browser-supplied owner IDs are not authorization. Do not publish OAuth callback/token-management APIs until this is in place. Keep refresh tokens in a server-side encrypted secret store, outside event and integration responses.

## Proposed related entities

Use UUID internal keys, explicit foreign keys, created/updated timestamps, and owner_id throughout. Composite foreign keys should prevent cross-owner relations. Provider IDs stay separate from internal keys. Avoid generic giant JSON documents as substitutes for entities.

| Entity | Relationships and key fields |
| --- | --- |
| User | Approved identity subject, IANA timezone |
| Goal / Project | Owner, outcome, description, start/target dates, status |
| ProjectObjective | Project, title, ordering, completion |
| ProjectPhase | Project, title, date bounds, ordering |
| ProjectMilestone | Project, optional phase, target date, completion |
| ProjectMetric / MetricSample | Project, unit, derivation type; dated measurements or derived queries |
| Task | Optional project/milestone, due instant or explicit date-only value, planned local date, planning mode, status |
| TaskHistory | Task, mutation/completion instant, actor, changed fields; retain completion/reopen history |
| Integration | Owner, provider, external account ID, authorization/status metadata; secret reference only |
| ExternalTaskLink | Task, integration, source container and item IDs, source URL, source revision |
| Calendar | Owner, integration or internal origin, external calendar ID, main/errands role, display preference |
| CalendarEvent | Calendar, provider ID, recurring instance identity, timed start/end or all-day date bounds, source revision |
| Routine | Owner, fixed/completion-relative mode, interval unit/count, anchor, preferred window/timezone, task and calendar behavior |
| RoutineWeekday | Routine, weekday for anchored weekly schedules |
| RoutineOccurrence | Routine, scheduled local date/instant, completion instant, optional generated task/event |
| WorkoutTemplate / TemplateExercise | Owner, ordered exercise references, target sets/reps |
| Workout / WorkoutExercise / Set | Owner, session start/end, ordered exercise references, load/reps/RPE/RIR/notes |
| Exercise | Stable exercise identity and unit conventions |
| GoalWorkout | Goal and workout relation for contributions; derive summaries from sets, not manually copied totals |
| Food / FoodServing | Provider food ID and serving unit/quantity; centrally referenced source items |
| NutritionLog | Owner, logged instant/local day, food/serving reference, quantity, immutable logged calorie/protein/carbohydrate/fat snapshot |
| NutritionTarget | Owner, effective local date, targets; keep changes historical |
| DailyNutritionSummary | Derived view over logs, not a second editable data source |
| SyncState | Integration and resource, cursor, last success/attempt, bounded failure status |

Useful indexes: Task(owner,status,planned_date), Task(owner,due_at), Task(project,status), TaskHistory(task,occurred_at), Workout(owner,started_at), WorkoutExercise(exercise,workout), NutritionLog(owner,local_day), CalendarEvent(calendar,start_at), RoutineOccurrence(routine,scheduled_date). Add unique external-link keys on integration/container/provider ID, and unique routine occurrence keys before enabling generation.

## Time and idempotency rules

- Task planning is a local date independent of its deadline. Preserve existing offsets; date-without-time entry defaults to 23:59 on the user's selected local date. UI formatting must use the same timezone for date and time.
- Store event instants as timestamptz and all-day bounds as date values. All-day end remains exclusive. Retain provider timezone/recurrence identifiers where needed.
- Fixed routines stay anchored; completion-relative routines advance from actual completion. Define missed-occurrence policy explicitly before enabling scheduling. Monthly recurrence must define short-month behavior.
- Generate an occurrence, task, and optional internal Errands event in one transaction. A unique occurrence constraint makes retries safe. Lock or compare revisions for simultaneous completion/reopen operations.
- Errands calendar presence is opt-in; default main calendar excludes it. Task-only routines create no event.
- Sync updates existing external IDs; never title-match as identity. Preserve manual task planning when upstream changes a deadline. Completion sync policy must be explicit rather than inferred.
- Persist a sync cursor only after all corresponding changes commit. Failures retain last-success freshness and show an error; do not report fallback data as fresh direct sync.

## Migration and performance sequence

1. Restore Vercel authorization and authenticated owner boundary. Provision Preview SQL and a migration ledger.
2. Write the smallest schema for Goals/Project objectives/phases/milestones and link existing stable Notion project/task IDs. Apply and test the migration alongside its APIs; do not migrate all entities before a usable unit needs them.
3. Dry-run imports with counts and relationship validation, then reconcile IDs and date/offset values. Keep Notion authoritative until parity is verified; avoid unrestricted dual writes.
4. Add paged history APIs and independent project task aggregates. Current /api/tasks fetches all Notion records; the Tasks page's 25-row display limit is only client pagination. Filtering completed records now would make Home project totals incorrect.
5. Migrate the smallest complete unit, record rollback and reconciliation, then enable it. No mass deletion of old records as part of rollout.

## Integration boundaries

Google/Notion calendar providers already work and are preserved. Outlook must reuse their normalized event contract. The official Graph calendarView endpoint expands recurring instances in a date window and requires following @odata.nextLink. Retain calendar and event IDs; implement a separate explicit create/update path only with user-authorized write scope and duplicate-safe transaction IDs. App registration, tenant authorization and secure offline token handling remain external setup; this run did not connect Microsoft.

Purdue Brightspace student API authorization is unverified. Do not claim institution support or scrape login credentials. Confirm institution-approved D2L OAuth/client access or an explicitly offered calendar feed first. Use stable source IDs and staged idempotent upserts, preserve exact due times and source links, and test updates/cancellations before enabling automatic task creation. An ICS feed, if offered, may lack assignment completion/status and must not be presented as full coursework sync.

Sources consulted for future integration work: [Graph calendarView](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0), [Graph permissions](https://learn.microsoft.com/en-us/graph/permissions-reference), [D2L OAuth documentation](https://docs.valence.desire2learn.com/basic/oauth2.html). These document platform capabilities, not Purdue-specific authorization.
