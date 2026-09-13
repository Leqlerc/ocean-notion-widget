import json
import re
from concurrent.futures import ThreadPoolExecutor
from lib.rec_hours import load_hours
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from http.server import BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

GOBOARD_KEY = "aedeaf92-036d-4848-980b-7eb5526ea40c"
GOBOARD_URL = (
    "https://goboardapi.azurewebsites.net/api/FacilityCount/"
    "GetCountsByAccount?AccountAPIKey=" + GOBOARD_KEY
)
RECWELL_URL = "https://www.purdue.edu/recwell/"
LOCAL_TZ = ZoneInfo("America/Indiana/Indianapolis")
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
TIME_RANGE = re.compile(
    r"\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)?\s*"
    r"(?:-|–|—|to)\s*"
    r"(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b",
    re.I,
)


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None and self.row is not None:
            self.row.append(clean_text(" ".join(self.cell)))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if any(self.row):
                self.rows.append(self.row)
            self.row = None
            self.cell = None


def clean_text(value):
    return re.sub(r"\s+", " ", unescape(value or "")).strip()


def fetch_url(url):
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; NOcean/1.0; +https://ocean-notion-widget.vercel.app)",
            "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        },
    )
    with urlopen(req, timeout=12) as response:
        return response.read().decode("utf-8", errors="replace")


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


def is_aquatic_label(value):
    v = (value or "").lower()
    return any(k in v for k in ("aquatic center", "morgan j. burke", "morgan j burke", "competition pool"))


def normalize_hours(value):
    value = clean_text(value)
    if not value:
        return None
    if re.search(r"\bclosed\b", value, re.I):
        return "Closed"
    matches = TIME_RANGE.findall(value)
    if matches:
        return " · ".join(clean_text(x) for x in matches[:3])
    return None


def hours_from_tables(html, weekday):
    parser = TableParser()
    try:
        parser.feed(html)
    except Exception:
        return None

    rows = parser.rows
    for i, row in enumerate(rows):
        if not any(is_aquatic_label(cell) for cell in row):
            continue

        # Common layout: header row = Facility, Monday, Tuesday, ...
        for j in range(max(0, i - 5), i):
            header = rows[j]
            for idx, cell in enumerate(header):
                if cell.lower() == weekday.lower() and idx < len(row):
                    parsed = normalize_hours(row[idx])
                    if parsed:
                        return parsed

        # Alternate layout: cells contain labels such as "Sunday 10 AM - 6 PM".
        for cell in row:
            if weekday.lower() in cell.lower():
                parsed = normalize_hours(cell)
                if parsed:
                    return parsed

        # A daily card rendered as a table may only include today's hours.
        for cell in row[1:]:
            parsed = normalize_hours(cell)
            if parsed:
                return parsed
    return None


def hours_from_text(html, weekday):
    # Remove style/script noise for visible-text fallback, but keep a second raw pass below
    # because some CMS components embed their hour strings inside JSON/script attributes.
    visible = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", html, flags=re.I | re.S)
    visible = clean_text(re.sub(r"<[^>]+>", " ", visible))

    # Prefer the official Facilities and Hours section to avoid matching the generic aquatics blurb.
    lower = visible.lower()
    section_pos = lower.find("facilities and hours")
    scoped = visible[section_pos:section_pos + 12000] if section_pos >= 0 else visible

    for source in (scoped, visible, clean_text(html)):
        low = source.lower()
        starts = [m.start() for m in re.finditer(r"aquatic center|morgan j\.? burke|competition pool", low)]
        for pos in starts:
            window = source[max(0, pos - 250):pos + 1800]
            # Best case: today's weekday is explicitly present near the facility.
            day_match = re.search(
                rf"\b{re.escape(weekday)}\b.{{0,180}}?(closed|{TIME_RANGE.pattern})",
                window,
                flags=re.I | re.S,
            )
            if day_match:
                parsed = normalize_hours(day_match.group(0))
                if parsed:
                    return parsed
            # Daily card: first nearby hours range after the Aquatic Center label.
            after = window[window.lower().find("aquatic") + 7:]
            parsed = normalize_hours(after[:500])
            if parsed:
                return parsed
    return None


def fetch_aquatic_hours():
    now_local = datetime.now(LOCAL_TZ)
    weekday = DAY_NAMES[now_local.weekday()]
    result = {
        "date": now_local.date().isoformat(),
        "weekday": weekday,
        "hours": None,
        "source": RECWELL_URL,
        "source_label": "Purdue RecWell website",
    }
    try:
        html = fetch_url(RECWELL_URL)
        result["hours"] = hours_from_tables(html, weekday) or hours_from_text(html, weekday)
        result["fetched"] = True
    except Exception as exc:
        result["fetched"] = False
        result["error"] = str(exc)
    return result


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
        # Hours and occupancy are independent; one unavailable source must not hide the other.
        with ThreadPoolExecutor(max_workers=3) as pool:
            counts = pool.submit(fetch_counts)
            aquatic = pool.submit(load_hours, 'aquatic')
            corec = pool.submit(load_hours, 'corec')
            try:
                rows = [normalize(r) for r in (counts.result() or [])]
                spaces = pick_spaces(rows)
            except Exception:
                rows, spaces = [], {'corec_lower': None, 'aquatic': None, 'trec': None}
            aquatic_hours, corec_hours = aquatic.result(), corec.result()
        if spaces.get('aquatic') is not None:
            spaces['aquatic']['hours'] = aquatic_hours.get('hours')
            spaces['aquatic']['hours_date'] = aquatic_hours.get('date')
            spaces['aquatic']['hours_source'] = aquatic_hours.get('source')
        self.send_json(200, {
            'updated_at': datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
            'source': 'Purdue RecWell public facility counters and EMS schedule',
            'hours_url': RECWELL_URL,
            'aquatic_hours': aquatic_hours,
            'corec_hours': corec_hours,
            'spaces': spaces,
            'rows': rows,
        })
