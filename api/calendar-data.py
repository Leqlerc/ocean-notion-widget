import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.error import HTTPError
from urllib.request import Request, urlopen

TOKEN = os.environ.get("NOTION_TOKEN", "").strip()
NOTION_VERSION = "2026-03-11"
BASE = "https://api.notion.com/v1"
TASKS = "cbb2eff8-e4cf-497f-919b-1d8bfccb9153"
EVENTS = "edda9dd0-e4bd-4c48-a80d-361484f07ff9"


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


def text_value(page, name):
    p = prop(page, name)
    items = p.get("title") or p.get("rich_text") or []
    return "".join(item.get("plain_text", "") for item in items)


def select_value(page, name):
    p = prop(page, name)
    return (p.get("select") or p.get("status") or {}).get("name") or ""


def date_obj(page, name):
    return prop(page, name).get("date") or {}


def url_value(page, name):
    return prop(page, name).get("url") or ""


def build():
    assignments = []
    for p in query_all(TASKS):
        d = date_obj(p, "Deadline")
        if not d.get("start"):
            continue
        assignments.append({
            "name": text_value(p, "Task") or "Untitled task",
            "at": d.get("start"),
            "end": d.get("end"),
            "course": select_value(p, "Course"),
            "type": select_value(p, "Type") or "Task",
            "category": select_value(p, "Category"),
            "notion_url": p.get("url", ""),
        })

    events = []
    for p in query_all(EVENTS):
        d = date_obj(p, "Date")
        if not d.get("start"):
            continue
        events.append({
            "name": text_value(p, "Event") or "Untitled event",
            "at": d.get("start"),
            "end": d.get("end"),
            "course": select_value(p, "Course"),
            "type": select_value(p, "Event Type") or "Other",
            "category": select_value(p, "Category"),
            "info": text_value(p, "Important Info"),
            "source_calendar": text_value(p, "Source calendar"),
            "source": url_value(p, "Source"),
            "notion_url": p.get("url", ""),
        })

    return {
        "updated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "assignments": assignments,
        "events": events,
    }


class handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()

    def do_GET(self):
        try:
            self.send_json(200, build())
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})
