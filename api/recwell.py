import json
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.request import Request, urlopen

GOBOARD_KEY = "aedeaf92-036d-4848-980b-7eb5526ea40c"
GOBOARD_URL = (
    "https://goboardapi.azurewebsites.net/api/FacilityCount/"
    "GetCountsByAccount?AccountAPIKey=" + GOBOARD_KEY
)
RECWELL_URL = "https://www.purdue.edu/recwell/"


def fetch_counts():
    req = Request(GOBOARD_URL, headers={"User-Agent": "NOcean/1.0"})
    with urlopen(req, timeout=12) as response:
        return json.load(response)


def normalize(row):
    count = int(row.get("LastCount") or 0)
    capacity = int(row.get("TotalCapacity") or 0)
    percent = round(count / capacity * 100) if capacity > 0 else None
    return {
        "name": (row.get("LocationName") or "").strip(),
        "facility": (row.get("FacilityName") or "").strip(),
        "count": count,
        "capacity": capacity,
        "percent": percent,
        "closed": bool(row.get("IsClosed")),
        "updated": row.get("LastUpdatedDateAndTime") or "",
    }


def text(row):
    return (row["name"] + " " + row["facility"]).lower()


def aggregate(rows):
    if not rows:
        return None
    count = sum(r["count"] for r in rows)
    capacity = sum(r["capacity"] for r in rows)
    percent = round(count / capacity * 100) if capacity > 0 else None
    # A grouped space is considered closed only when every matching counter is closed.
    closed = all(r["closed"] for r in rows)
    updated = max((r["updated"] for r in rows), default="")
    return {
        "count": count,
        "capacity": capacity,
        "percent": percent,
        "closed": closed,
        "updated": updated,
        "spaces": [r["name"] for r in rows],
    }


def pick_spaces(rows):
    # CoRec: user only wants the bottom/lower-floor fitness area, not whole-building load.
    fitness = [r for r in rows if "fitness" in text(r)]
    lower = [
        r for r in fitness
        if any(k in text(r) for k in ("lower", "1st", "first", "level 1", "floor 1", "main"))
    ]
    if not lower and fitness:
        # Keep this conservative: use one fitness counter rather than summing every CoRec floor.
        lower = [sorted(fitness, key=lambda r: r["name"])[0]]

    aquatic = [
        r for r in rows
        if any(k in text(r) for k in ("aquatic", "holloway", "competition pool", "dive well"))
        and "rec pool" not in text(r)
    ]
    if not aquatic:
        aquatic = [r for r in rows if "pool" in text(r) and "rec pool" not in text(r)]

    trec = [r for r in rows if any(k in text(r) for k in ("trec", "turf recreation"))]

    return {
        "corec_lower": aggregate(lower),
        "trec": aggregate(trec),
        "aquatic": aggregate(aquatic),
    }


class handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        try:
            raw = fetch_counts()
            rows = [normalize(r) for r in (raw or [])]
            self.send_json(200, {
                "updated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "source": "Purdue RecWell public Connect2 / GoBoard facility counters",
                "hours_url": RECWELL_URL,
                "spaces": pick_spaces(rows),
                "rows": rows,
            })
        except Exception as exc:
            self.send_json(502, {"error": str(exc), "hours_url": RECWELL_URL})
