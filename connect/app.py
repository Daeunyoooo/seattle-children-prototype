import base64
import json
import mimetypes
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

import duckdb
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse


ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "dist"
SOURCE_DATA_DIR = ROOT_DIR / "src" / "data"
APP_DATA_DIR = Path(os.environ.get("SCH_APP_DATA_DIR", ROOT_DIR / ".connect-data")).resolve()
STAKEHOLDER_DATA_DIR = APP_DATA_DIR / "stakeholders"
LOG_DATA_DIR = APP_DATA_DIR / "log-data"
DB_PATH = APP_DATA_DIR / "participant_sessions.duckdb"

ROLES = ["youth", "caregiver", "clinician"]
SESSION_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{2,80}$")
DATA_URL_RE = re.compile(r"^data:([^;]+);base64,(.+)$")

app = FastAPI(title="Seattle Children Prototype")
db_lock = threading.Lock()


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def clean_session_id(value):
    session_id = str(value or "").strip()
    if not SESSION_ID_RE.match(session_id):
        raise HTTPException(status_code=400, detail="Invalid or missing participant sessionId")
    return session_id


def safe_session_id(value):
    session_id = str(value or "").strip()
    return session_id if SESSION_ID_RE.match(session_id) else ""


def json_response(payload, status_code=200):
    return JSONResponse(payload, status_code=status_code)


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc):
    detail = exc.detail if isinstance(exc.detail, str) else "Server error"
    return json_response({"error": detail}, status_code=exc.status_code)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request, exc):
    return json_response({"error": str(exc) or "Server error"}, status_code=500)


def read_json_file(path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json_file(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def clean_values(values):
    seen = []
    for value in values if isinstance(values, list) else []:
        clean = str(value).strip()
        if clean and clean not in seen:
            seen.append(clean)
    return seen[:6]


def clean_stakeholder(role, value):
    value = value if isinstance(value, dict) else {}
    return {
        "role": role,
        "goal": str(value.get("goal") or "").strip(),
        "values": clean_values(value.get("values")),
    }


def canonical(value):
    return str(value).strip().lower()


def overlap(*groups):
    if not groups:
        return []
    value_groups = [(group or {}).get("values") or [] for group in groups]
    first, rest = value_groups[0], value_groups[1:]
    return [
        value
        for value in first
        if all(any(canonical(candidate) == canonical(value) for candidate in group) for group in rest)
    ]


def compute_shared_values(stakeholders):
    return {
        "regions": {
            "youthCaregiver": overlap(stakeholders.get("youth"), stakeholders.get("caregiver")),
            "youthClinician": overlap(stakeholders.get("youth"), stakeholders.get("clinician")),
            "caregiverClinician": overlap(stakeholders.get("caregiver"), stakeholders.get("clinician")),
            "all": overlap(stakeholders.get("youth"), stakeholders.get("caregiver"), stakeholders.get("clinician")),
        }
    }


def stakeholder_file(role):
    saved_path = STAKEHOLDER_DATA_DIR / f"{role}.json"
    return saved_path if saved_path.exists() else SOURCE_DATA_DIR / f"{role}.json"


def load_stakeholders():
    stakeholders = {
        role: read_json_file(stakeholder_file(role), {"role": role, "goal": "", "values": []})
        for role in ROLES
    }
    shared_path = STAKEHOLDER_DATA_DIR / "sharedValues.json"
    source_shared_path = SOURCE_DATA_DIR / "sharedValues.json"
    shared_values = read_json_file(
        shared_path if shared_path.exists() else source_shared_path,
        compute_shared_values(stakeholders),
    )
    return {"stakeholders": stakeholders, "sharedValues": shared_values}


def save_stakeholders(payload):
    payload = payload if isinstance(payload, dict) else {}
    stakeholders = {
        role: clean_stakeholder(role, (payload.get("stakeholders") or {}).get(role))
        for role in ROLES
    }
    shared_values = compute_shared_values(stakeholders)
    for role, stakeholder in stakeholders.items():
        write_json_file(STAKEHOLDER_DATA_DIR / f"{role}.json", stakeholder)
    write_json_file(STAKEHOLDER_DATA_DIR / "sharedValues.json", shared_values)
    return {"stakeholders": stakeholders, "sharedValues": shared_values}


def init_db():
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    with duckdb.connect(str(DB_PATH)) as conn:
        conn.execute(
            """
            create table if not exists participant_sessions (
              session_id varchar primary key,
              data_json varchar not null,
              updated_at varchar not null
            )
            """
        )
        conn.execute(
            "create index if not exists participant_sessions_updated_at_idx on participant_sessions(updated_at)"
        )


def upsert_session_row(session_id, session):
    updated_at = str(session.get("updatedAt") or session.get("savedAt") or now_iso())
    data_json = json.dumps(session, separators=(",", ":"))
    with db_lock:
        with duckdb.connect(str(DB_PATH)) as conn:
            conn.execute("begin transaction")
            conn.execute("delete from participant_sessions where session_id = ?", [session_id])
            conn.execute(
                "insert into participant_sessions(session_id, data_json, updated_at) values (?, ?, ?)",
                [session_id, data_json, updated_at],
            )
            conn.execute("commit")


def fetch_session_row(session_id):
    with db_lock:
        with duckdb.connect(str(DB_PATH)) as conn:
            row = conn.execute(
                "select data_json from participant_sessions where session_id = ?",
                [session_id],
            ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Participant session not found")
    return json.loads(row[0])


def list_session_rows():
    with db_lock:
        with duckdb.connect(str(DB_PATH)) as conn:
            rows = conn.execute(
                """
                select session_id, updated_at, data_json
                from participant_sessions
                order by updated_at desc
                """
            ).fetchall()
    sessions = []
    for session_id, updated_at, data_json in rows:
        session = json.loads(data_json)
        sessions.append(
            {
                "sessionId": session.get("sessionId") or session_id,
                "updatedAt": session.get("updatedAt") or updated_at or session.get("savedAt") or None,
                "data": session,
            }
        )
    return {"sessions": sessions}


def slugify_value_name(name, fallback="value"):
    slug = re.sub(r"[^a-z0-9]+", "-", str(name or "").lower()).strip("-")[:40]
    return slug or fallback


def data_url_to_bytes(data_url):
    match = DATA_URL_RE.match(str(data_url or ""))
    if not match:
        return None
    return base64.b64decode(match.group(2))


def write_tool_c_image(session_id, relative_path, data_url):
    payload = data_url_to_bytes(data_url)
    if payload is None:
        return False
    file_path = LOG_DATA_DIR / session_id / relative_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(payload)
    return True


def persist_tool_c_to_log_data(session_id, tool_c):
    if not tool_c:
        return tool_c

    next_tool_c = {
        **tool_c,
        "perValueDrawings": [],
        "composite": {**(tool_c.get("composite") or {}), "legendThumbs": []},
        "stakeholders": {**(tool_c.get("stakeholders") or {})},
    }

    drawings = []
    for index, drawing in enumerate(tool_c.get("perValueDrawings") or []):
        if not drawing:
            continue
        if not drawing.get("pngDataUrl"):
            if drawing.get("file"):
                drawings.append(drawing)
            continue
        file_name = (
            f"tool-c/value-{str(index + 1).zfill(2)}-"
            f"{slugify_value_name(drawing.get('valueName'), f'value-{index + 1}')}.png"
        )
        write_tool_c_image(session_id, file_name, drawing.get("pngDataUrl"))
        drawings.append(
            {
                "valueName": drawing.get("valueName") or "",
                "file": file_name,
                "pngWidth": drawing.get("pngWidth"),
                "pngHeight": drawing.get("pngHeight"),
            }
        )
    next_tool_c["perValueDrawings"] = drawings

    composite = next_tool_c["composite"]
    final_image = (tool_c.get("composite") or {}).get("finalImage")
    if final_image and final_image.get("pngDataUrl"):
        write_tool_c_image(session_id, "tool-c/composite.png", final_image.get("pngDataUrl"))
        composite["finalImage"] = {
            "file": "tool-c/composite.png",
            "pngWidth": final_image.get("pngWidth"),
            "pngHeight": final_image.get("pngHeight"),
        }
    elif final_image and final_image.get("file"):
        composite["finalImage"] = final_image
    else:
        composite["finalImage"] = None

    stakeholders = next_tool_c["stakeholders"]
    stakeholder_image = (tool_c.get("stakeholders") or {}).get("finalImage")
    if stakeholder_image and stakeholder_image.get("pngDataUrl"):
        write_tool_c_image(session_id, "tool-c/stakeholders.png", stakeholder_image.get("pngDataUrl"))
        stakeholders["finalImage"] = {
            "file": "tool-c/stakeholders.png",
            "pngWidth": stakeholder_image.get("pngWidth"),
            "pngHeight": stakeholder_image.get("pngHeight"),
        }
    elif stakeholder_image and stakeholder_image.get("file"):
        stakeholders["finalImage"] = stakeholder_image
    else:
        stakeholders["finalImage"] = None

    return next_tool_c


def persist_session_to_log_data(session, checkpoint_name=None):
    session_id = clean_session_id(session.get("sessionId") if isinstance(session, dict) else None)
    phase_two = session.get("phaseTwo") if isinstance(session.get("phaseTwo"), dict) else session.get("phaseTwo")
    lean_session = {**session, "sessionId": session_id}
    if isinstance(phase_two, dict):
        lean_session["phaseTwo"] = {
            **phase_two,
            "toolC": persist_tool_c_to_log_data(session_id, phase_two.get("toolC")),
        }

    session_dir = LOG_DATA_DIR / session_id
    write_json_file(session_dir / "session.json", lean_session)
    if checkpoint_name:
        write_json_file(session_dir / f"{checkpoint_name}-log.json", lean_session)
    return lean_session


def save_participant_session(payload):
    payload = payload if isinstance(payload, dict) else {}
    session = payload.get("session") or payload
    if not isinstance(session, dict):
        raise HTTPException(status_code=400, detail="Invalid participant session payload")
    session_id = clean_session_id(session.get("sessionId"))
    saved_at = now_iso()
    lean_session = persist_session_to_log_data(
        {**session, "sessionId": session_id, "savedAt": saved_at},
        payload.get("checkpoint"),
    )
    saved_session = {**lean_session, "savedAt": saved_at}
    upsert_session_row(session_id, saved_session)
    return {"session": saved_session}


def rebuild_log_data_from_stored_session(session_id_value):
    session_id = clean_session_id(session_id_value)
    stored = fetch_session_row(session_id)
    lean_session = persist_session_to_log_data(stored)
    saved_session = {**lean_session, "savedAt": stored.get("savedAt") or now_iso()}
    upsert_session_row(session_id, saved_session)
    return {"session": lean_session}


def safe_log_data_file(session_id_value, relative_path):
    session_id = clean_session_id(session_id_value)
    pure_path = PurePosixPath(str(relative_path or ""))
    if pure_path.is_absolute() or ".." in pure_path.parts or not pure_path.parts:
        raise HTTPException(status_code=400, detail="Invalid file path")
    file_path = (LOG_DATA_DIR / session_id / Path(*pure_path.parts)).resolve()
    session_root = (LOG_DATA_DIR / session_id).resolve()
    if session_root not in file_path.parents and file_path != session_root:
        raise HTTPException(status_code=400, detail="Invalid file path")
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Log data file not found")
    return file_path


@app.on_event("startup")
def startup():
    init_db()
    LOG_DATA_DIR.mkdir(parents=True, exist_ok=True)
    STAKEHOLDER_DATA_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/api/health")
def health():
    return {"ok": True, "service": "seattle-children-prototype", "storage": "duckdb"}


@app.get("/api/stakeholders")
def get_stakeholders():
    return load_stakeholders()


@app.post("/api/stakeholders")
async def post_stakeholders(request: Request):
    return save_stakeholders(await request.json())


@app.get("/api/participant-sessions")
def get_participant_sessions():
    return list_session_rows()


@app.post("/api/participant-sessions")
async def post_participant_session(request: Request):
    return save_participant_session(await request.json())


@app.get("/api/participant-sessions/{session_id}")
def get_participant_session(session_id: str):
    return {"session": fetch_session_row(clean_session_id(session_id))}


@app.post("/api/log-data/{session_id}/rebuild")
def post_log_data_rebuild(session_id: str):
    return rebuild_log_data_from_stored_session(session_id)


@app.get("/api/log-data/{session_id}/{relative_path:path}")
def get_log_data_file(session_id: str, relative_path: str):
    file_path = safe_log_data_file(session_id, relative_path)
    media_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    return FileResponse(file_path, media_type=media_type)


@app.get("/{full_path:path}")
def serve_react_app(full_path: str):
    if not DIST_DIR.exists():
        return json_response(
            {"error": "React build not found. Run npm run build before deploying to Posit Connect."},
            status_code=503,
        )

    requested = (DIST_DIR / full_path).resolve()
    if DIST_DIR in requested.parents and requested.exists() and requested.is_file():
        return FileResponse(requested)

    index_path = DIST_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path, media_type="text/html")
    return json_response({"error": "React index.html not found in dist."}, status_code=503)
