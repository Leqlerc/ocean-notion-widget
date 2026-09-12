import json
import os
from datetime import date, datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

TOKEN = os.environ.get("NOTION_TOKEN", "").strip()
NOTION_VERSION = "2026-03-11"
BASE = "https://api.notion.com/v1"
TZ = ZoneInfo("America/Indiana/Indianapolis")
TASKS = "cbb2eff8-e4cf-497f-919b-1d8bfccb9153"
EVENTS = "edda9dd0-e4bd-4c48-a80d-361484f07ff9"
DAILY = "d534e9b3-624e-4ac3-bbdb-45f765039efc"
SEM_START = date(2026, 8, 24)
SEM_END = date(2026, 12, 19)
BOOL_FIELDS = {"Meditate", "Journal", "Sleep early", "Pray", "Chinese", "Stretch", "Swim", "Rehab", "Cardio"}
SELECT_FIELDS = {
    "Productivity": {"Yellow", "Green", "Purple"},
    "Workout Quality": {"Not great", "Productive", "Great"},
    "Workout Type": {"Push", "Pull", "Legs", "Other"},
}


def api(method, path, payload=None):
    if not TOKEN:
        raise RuntimeError("NOTION_TOKEN is not configured in Vercel")
    body = None if payload is None else json.dumps(payload).encode()
    req = Request(BASE + path, data=body, method=method, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    })
    try:
        with urlopen(req, timeout=20) as response:
            return json.load(response)
    except HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise RuntimeError(f"Notion API {exc.code}: {detail}") from exc


def query_all(ds_id):
    rows, cursor = [], None
    while True:
        payload = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        data = api("POST", f"/data_sources/{ds_id}/query", payload)
        rows.extend(data.get("results", []))
        if not data.get("has_more"):
            return rows
        cursor = data.get("next_cursor")


def prop(page, name):
    return page.get("properties", {}).get(name, {})


def title_text(page, name):
    items = prop(page, name).get("title") or prop(page, name).get("rich_text") or []
    return "".join(x.get("plain_text", "") for x in items)


def select_name(page, name):
    p = prop(page, name)
    return (p.get("select") or p.get("status") or {}).get("name")


def checked(page, name):
    return bool(prop(page, name).get("checkbox"))


def date_value(page, name):
    return (prop(page, name).get("date") or {}).get("start")


def number_value(page, name):
    p = prop(page, name)
    if p.get("number") is not None:
        return p.get("number") or 0
    rollup = p.get("rollup") or {}
    if rollup.get("type") == "number":
        return rollup.get("number") or 0
    formula = p.get("formula") or {}
    if formula.get("type") == "number":
        return formula.get("number") or 0
    return 0


def local_day(value):
    if not value:
        return None
    if len(value) == 10:
        return date.fromisoformat(value)
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TZ)
    return dt.astimezone(TZ).date()


def relation_count(page, name):
    return len(prop(page, name).get("relation") or [])


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def academics_payload():
    assignments = {}
    for p in query_all(TASKS):
        if select_name(p, "Category") != "School":
            continue
        d = local_day(date_value(p, "Deadline"))
        if not d or not (SEM_START <= d <= SEM_END):
            continue
        k = d.isoformat()
        assignments.setdefault(k, []).append({
            "name": title_text(p, "Task") or "Untitled task",
            "type": select_name(p, "Type") or "Task",
            "course": select_name(p, "Course") or "",
        })

    events = {}
    for p in query_all(EVENTS):
        d = local_day(date_value(p, "Date"))
        if not d or not (SEM_START <= d <= SEM_END):
            continue
        k = d.isoformat()
        events.setdefault(k, []).append({
            "name": title_text(p, "Event") or "Untitled event",
            "type": select_name(p, "Event Type") or "Other",
            "course": select_name(p, "Course") or "",
            "at": date_value(p, "Date") or k,
        })

    return {"updated_at": now_iso(), "assignments": assignments, "events": events}


def daily_rows():
    out = {}
    for p in query_all(DAILY):
        d = local_day(date_value(p, "Date"))
        if not d:
            continue
        k = d.isoformat()
        out[k] = {
            "id": p.get("id"),
            "habits": {name: checked(p, name) for name in ["Meditate", "Journal", "Sleep early", "Pray", "Chinese"]},
            "productivity": select_name(p, "Productivity") or "",
            "athletics": {name: checked(p, name) for name in ["Stretch", "Swim", "Rehab", "Cardio"]},
            "workout": {
                "done": relation_count(p, "Training sets") > 0,
                "type": select_name(p, "Workout Type") or "",
                "quality": select_name(p, "Workout Quality") or "",
                "set_count": relation_count(p, "Training sets"),
                "working_sets": number_value(p, "Working sets"),
                "volume": number_value(p, "Training volume"),
            },
        }
    return out


def daily_payload():
    return {"updated_at": now_iso(), "days": daily_rows()}


def find_daily_page(day_key):
    return daily_rows().get(day_key)


def upsert_daily(day_key, changes):
    d = date.fromisoformat(day_key)
    if d.year < 2020 or d.year > 2100:
        raise ValueError("date out of range")
    clean = {}
    for name, value in changes.items():
        if name in BOOL_FIELDS:
            clean[name] = {"checkbox": bool(value)}
        elif name in SELECT_FIELDS:
            if value in (None, ""):
                clean[name] = {"select": None}
            elif value in SELECT_FIELDS[name]:
                clean[name] = {"select": {"name": value}}
            else:
                raise ValueError(f"invalid value for {name}")
        else:
            raise ValueError(f"field not writable: {name}")
    clean["Log"] = {"checkbox": True}

    existing = find_daily_page(day_key)
    if existing:
        api("PATCH", f"/pages/{existing['id']}", {"properties": clean})
    else:
        props = {
            "Day": {"title": [{"text": {"content": day_key}}]},
            "Date": {"date": {"start": day_key}},
            **clean,
        }
        api("POST", "/pages", {"parent": {"type": "data_source_id", "data_source_id": DAILY}, "properties": props})
    return daily_payload()


class handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        try:
            scope = parse_qs(urlparse(self.path).query).get("scope", ["daily"])[0]
            if scope == "academics":
                self.send_json(200, academics_payload())
            elif scope == "daily":
                self.send_json(200, daily_payload())
            else:
                self.send_json(400, {"error": "unknown scope"})
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            day_key = body.get("date", "")
            changes = body.get("changes") or {}
            date.fromisoformat(day_key)
            if not isinstance(changes, dict) or not changes:
                raise ValueError("changes must be a non-empty object")
            self.send_json(200, upsert_daily(day_key, changes))
        except Exception as exc:
            self.send_json(400, {"error": str(exc)})
