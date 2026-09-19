# 001 — Task planning mode (applied 2026-09-19)

Existing Tasks data source: use NOTION_TASKS_DATA_SOURCE_ID (default in lib/notion.py).
Existing `Do date` DATE is reused as `scheduledFor`; `Deadline` remains `due`.
Add `Planning Mode` SELECT with Automatic, Planned, Backlog. Migration is additive;
no task records were rewritten. Existing null values normalize to Automatic.

Apply idempotently: fetch the schema first; if the exact select exists, validate
its options and stop. Otherwise add only the missing property/options. Never
replace the entire schema or overwrite existing records. MCP schema addition was
confirmed by its returned schema in this run.

Rollback code first to the prior provider; leave the unused select property in
Notion to preserve user planning choices. Do not drop planning data as rollback.
