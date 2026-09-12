#!/usr/bin/env python3
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

TOKEN = os.environ.get("NOTION_TOKEN", "").strip()
DATA_SOURCE_ID = "cbb2eff8-e4cf-497f-919b-1d8bfccb9153"
NOTION_VERSION = "2026-03-11"
TZ = ZoneInfo("America/Indiana/Indianapolis")
OUT = Path("task-progress.json")
BASE = "https://api.notion.com/v1"

if not TOKEN:
    print("NOTION_TOKEN is not configured; leaving seeded feed unchanged")
    raise SystemExit(0)


def api(method, path, payload=None):
    body = None if payload is None else json.dumps(payload).encode()
    req = Request(
        BASE + path,
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(req, timeout=30) as r:
            return json.load(r)
    except HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"Notion API {e.code}: {detail}") from e


def query_all():
    rows, cursor = [], None
    while True:
        payload = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        data = api("POST", f"/data_sources/{DATA_SOURCE_ID}/query", payload)
        rows.extend(data.get("results", []))
        if not data.get("has_more"):
            return rows
        cursor = data.get("next_cursor")


def prop(page, name):
    return page.get("properties", {}).get(name, {})


def select_name(page, name):
    return (prop(page, name).get("select") or {}).get("name")


def checked(page, name):
    return bool(prop(page, name).get("checkbox"))


def formula_value(page, name):
    f = prop(page, name).get("formula") or {}
    t = f.get("type")
    if t:
        return f.get(t)
    for key in ("string", "boolean", "number", "date"):
        if key in f:
            return f[key]
    return None


def date_value(page, name):
    d = prop(page, name).get("date") or {}
    return d.get("start")


def local_date(value):
    if not value:
        return None
    if len(value) == 10:
        return date.fromisoformat(value)
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ)
    return dt.astimezone(TZ).date()


def edited_local_date(page):
    return local_date(page.get("last_edited_time"))


def patch_page(page_id, properties):
    api("PATCH", f"/pages/{page_id}", {"properties": properties})


def pct(done, total):
    return round((done / total * 100) if total else 0.0, 1)


def main():
    now_utc = datetime.now(timezone.utc)
    today = now_utc.astimezone(TZ).date()
    horizon_end = today + timedelta(days=7)
    pages = query_all()

    # Keep completion dates and Focus rollover healthy even between the daily ChatGPT syncs.
    # A Done task still in the current Today/Focus scope and edited today is safe to stamp
    # as completed today. This is deliberately not tied to a short edit-age window because
    # GitHub scheduled workflows can run late.
    for page in pages:
        status = select_name(page, "Status")
        focus = checked(page, "Focus")
        today_formula = str(formula_value(page, "Today") or "").lower() == "true"
        completed = local_date(date_value(page, "Date Completed"))
        changes = {}

        if (
            status == "Done"
            and completed is None
            and edited_local_date(page) == today
            and (today_formula or focus)
        ):
            changes["Date Completed"] = {"date": {"start": today.isoformat()}}
            completed = today
            page.setdefault("properties", {})["Date Completed"] = {
                "type": "date",
                "date": {"start": today.isoformat(), "end": None, "time_zone": None},
            }

        if status == "Done" and focus and completed and completed < today:
            changes["Focus"] = {"checkbox": False}
            page.setdefault("properties", {})["Focus"] = {"type": "checkbox", "checkbox": False}

        if changes:
            patch_page(page["id"], changes)

    today_done = 0
    today_unfinished = 0
    week_done = 0
    week_unfinished = 0
    all_done = 0

    for page in pages:
        status = select_name(page, "Status")
        category = select_name(page, "Category")
        focus = checked(page, "Focus")
        today_formula = str(formula_value(page, "Today") or "").lower() == "true"
        urgency = str(formula_value(page, "Urgency") or "").upper()
        completed = local_date(date_value(page, "Date Completed"))
        deadline = local_date(date_value(page, "Deadline"))

        if status == "Done":
            all_done += 1

        if category == "School":
            if status == "Done" and completed == today:
                today_done += 1
            elif status != "Done" and (today_formula or focus):
                today_unfinished += 1

        if status != "Done" and urgency in {"OVERDUE", "TODAY", "NEXT 7 DAYS"}:
            week_unfinished += 1
        elif status == "Done" and deadline and today <= deadline <= horizon_end:
            week_done += 1

    today_total = today_done + today_unfinished
    week_total = week_done + week_unfinished
    all_total = len(pages)

    output = {
        "updated_at": now_utc.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "today": {"done": today_done, "total": today_total, "pct": pct(today_done, today_total)},
        "week": {"done": week_done, "total": week_total, "pct": pct(week_done, week_total)},
        "all": {"done": all_done, "total": all_total, "pct": pct(all_done, all_total)},
    }
    OUT.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(output))


if __name__ == "__main__":
    main()
