import os
import logging
import time
import uuid
from functools import wraps
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("smartexpense-backend")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

if not SUPABASE_URL or not SUPABASE_ANON_KEY or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing Supabase backend environment variables.")

auth_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
db_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
AUTH_EMAIL_DOMAIN = "users.smartexpense.local"

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [FRONTEND_URL, "http://localhost:5173"]}}, supports_credentials=False)

# Request tracking middleware
@app.before_request
def track_request_start():
    g.request_id = uuid.uuid4().hex[:8]
    g.start_time = time.time()
    logger.info(f"REQUEST_START id={g.request_id} method={request.method} path={request.path}")

@app.after_request
def track_request_end(response):
    elapsed = (time.time() - g.start_time) * 1000 if hasattr(g, 'start_time') else 0
    user_id = getattr(request, 'user_id', None)
    logger.info(f"REQUEST_END id={g.request_id} status={response.status_code} elapsed_ms={elapsed:.1f} user_id={user_id}")
    return response

USER_SCOPED_TABLES = {
    "categories",
    "expenses",
    "income",
    "investments",
    "subscriptions",
}


def _extract_bearer_token():
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.replace("Bearer ", "", 1).strip()
    return None


def _get_user_from_token(token):
    if not token:
        return None
    try:
        result = auth_client.auth.get_user(token)
        return result.user
    except Exception:
        return None


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _extract_bearer_token()
        if not token:
            logger.warning(f"AUTH_FAILED id={g.request_id} reason=no_token path={request.path}")
            return jsonify({"error": "Unauthorized"}), 401
        
        user = _get_user_from_token(token)
        if user is None:
            logger.warning(f"AUTH_FAILED id={g.request_id} reason=invalid_token path={request.path}")
            return jsonify({"error": "Unauthorized"}), 401
        
        logger.debug(f"AUTH_SUCCESS id={g.request_id} user_id={user.id} path={request.path}")
        request.user = user
        request.token = token
        request.user_id = user.id
        return fn(*args, **kwargs)

    return wrapper


def _append_user_scope_filters(table, user_id, filters):
    scoped_filters = list(filters or [])

    if table in USER_SCOPED_TABLES:
        scoped_filters.append({"op": "eq", "column": "user_id", "value": user_id})
    elif table == "profiles":
        scoped_filters.append({"op": "eq", "column": "id", "value": user_id})

    return scoped_filters


def _scope_insert_payload(table, user_id, payload):
    if table not in USER_SCOPED_TABLES:
        return payload

    if isinstance(payload, list):
        scoped = []
        for row in payload:
            row_data = dict(row)
            row_data["user_id"] = user_id
            scoped.append(row_data)
        return scoped

    row_data = dict(payload or {})
    row_data["user_id"] = user_id
    return row_data


def _scope_update_payload(table, payload):
    if table in USER_SCOPED_TABLES:
        row_data = dict(payload or {})
        row_data.pop("user_id", None)
        return row_data
    return payload


def _normalize_session_response(session_obj):
    if not session_obj:
        return {"session": None}

    return {
        "session": {
            "access_token": session_obj.access_token,
            "refresh_token": getattr(session_obj, "refresh_token", None),
            "expires_at": getattr(session_obj, "expires_at", None),
            "user": {
                "id": session_obj.user.id,
                "email": session_obj.user.email,
                "user_metadata": getattr(session_obj.user, "user_metadata", {}) or {},
            },
        }
    }


def _identifier_to_auth_email(identifier):
    raw = (identifier or "").strip().lower()
    if not raw:
        return None
    if "@" in raw:
        return raw
    return f"{raw}@{AUTH_EMAIL_DOMAIN}"


@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.post("/auth/signup")
def auth_signup():
    body = request.get_json(silent=True) or {}
    username_or_email = body.get("username") or body.get("email")
    email = _identifier_to_auth_email(username_or_email)
    password = body.get("password")
    full_name = body.get("full_name")

    logger.info(f"SIGNUP_ATTEMPT id={g.request_id} identifier={username_or_email} mapped_email={email}")

    if not email or not password:
        logger.warning(f"SIGNUP_INVALID id={g.request_id} reason=missing_credentials")
        return jsonify({"error": "username and password are required"}), 400

    try:
        result = auth_client.auth.sign_up(
            {
                "email": email,
                "password": password,
                "options": {"data": {"full_name": full_name or username_or_email or ""}},
            }
        )
        logger.info(f"SIGNUP_SUCCESS id={g.request_id} user_id={result.user.id if result.user else 'unknown'}")
        return jsonify(_normalize_session_response(result.session))
    except Exception as exc:
        logger.error(f"SIGNUP_ERROR id={g.request_id} error={str(exc)}")
        return jsonify({"error": str(exc)}), 400


@app.post("/auth/login")
def auth_login():
    body = request.get_json(silent=True) or {}
    username_or_email = body.get("username") or body.get("email")
    email = _identifier_to_auth_email(username_or_email)
    password = body.get("password")

    logger.info(f"LOGIN_ATTEMPT id={g.request_id} identifier={username_or_email} mapped_email={email}")

    if not email or not password:
        logger.warning(f"LOGIN_INVALID id={g.request_id} reason=missing_credentials")
        return jsonify({"error": "username and password are required"}), 400

    try:
        result = auth_client.auth.sign_in_with_password({"email": email, "password": password})
        logger.info(f"LOGIN_SUCCESS id={g.request_id} user_id={result.user.id if result.user else 'unknown'}")
        return jsonify(_normalize_session_response(result.session))
    except Exception as exc:
        logger.warning(f"LOGIN_FAILED id={g.request_id} error={str(exc)}")
        return jsonify({"error": str(exc)}), 400


@app.post("/auth/logout")
def auth_logout():
    logger.info(f"LOGOUT id={g.request_id}")
    return jsonify({"ok": True})


@app.get("/auth/session")
@require_auth
def auth_session():
    token = request.token
    user = request.user
    
    logger.info(f"SESSION_FETCH id={g.request_id} user_id={user.id}")

    profile = (
        db_client.table("profiles")
        .select("*")
        .eq("id", user.id)
        .limit(1)
        .execute()
    )
    
    profile_data = (profile.data or [None])[0]
    logger.debug(f"SESSION_PROFILE_FETCHED id={g.request_id} user_id={user.id} found={profile_data is not None}")

    return jsonify(
        {
            "session": {
                "access_token": token,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "user_metadata": getattr(user, "user_metadata", {}) or {},
                },
            },
            "profile": profile_data,
        }
    )


@app.post("/db/query")
@require_auth
def db_query():
    body = request.get_json(silent=True) or {}
    table = body.get("table")
    select_clause = body.get("select") or "*"
    filters = body.get("filters") or []
    order = body.get("order")
    limit = body.get("limit")
    single = bool(body.get("single"))

    logger.info(f"QUERY_START id={g.request_id} user_id={request.user.id} table={table} single={single} limit={limit}")

    if not table:
        logger.warning(f"QUERY_INVALID id={g.request_id} reason=missing_table")
        return jsonify({"error": "table is required"}), 400

    try:
        filters = _append_user_scope_filters(table, request.user.id, filters)
        query = db_client.table(table).select(select_clause)
        
        logger.debug(f"QUERY_FILTERS id={g.request_id} table={table} filter_count={len(filters)}")

        for f in filters:
            op = f.get("op")
            col = f.get("column")
            val = f.get("value")
            if not op or not col:
                continue
            if op == "eq":
                query = query.eq(col, val)
            elif op == "neq":
                query = query.neq(col, val)
            elif op == "gt":
                query = query.gt(col, val)
            elif op == "gte":
                query = query.gte(col, val)
            elif op == "lt":
                query = query.lt(col, val)
            elif op == "lte":
                query = query.lte(col, val)
            elif op == "in":
                query = query.in_(col, val)

        if order and order.get("column"):
            query = query.order(order.get("column"), desc=not bool(order.get("ascending", True)))

        if isinstance(limit, int):
            query = query.limit(limit)

        result = query.execute()
        data = result.data or []

        if single:
            data = data[0] if data else None

        row_count = 1 if (single and data) else (len(data) if isinstance(data, list) else 0)
        logger.info(f"QUERY_SUCCESS id={g.request_id} user_id={request.user.id} table={table} rows={row_count}")
        
        return jsonify({"data": data, "error": None})
    except Exception as exc:
        logger.error(f"QUERY_ERROR id={g.request_id} user_id={request.user.id} table={table} error={str(exc)}")
        return jsonify({"data": None, "error": str(exc)}), 400


@app.post("/db/mutate")
@require_auth
def db_mutate():
    body = request.get_json(silent=True) or {}
    table = body.get("table")
    action = body.get("action")
    payload = body.get("payload")
    filters = body.get("filters") or []

    logger.info(f"MUTATE_START id={g.request_id} user_id={request.user.id} table={table} action={action}")

    if not table or action not in {"insert", "update", "delete"}:
        logger.warning(f"MUTATE_INVALID id={g.request_id} reason=invalid_params table={table} action={action}")
        return jsonify({"error": "table and valid action are required"}), 400

    try:
        filters = _append_user_scope_filters(table, request.user.id, filters)

        if action == "insert":
            scoped_payload = _scope_insert_payload(table, request.user.id, payload)
            result = db_client.table(table).insert(scoped_payload).execute()
            rows_affected = len(result.data) if result.data else 0
            logger.info(f"MUTATE_INSERT id={g.request_id} user_id={request.user.id} table={table} rows_inserted={rows_affected}")
            return jsonify({"data": result.data, "error": None})

        if action == "update":
            query = db_client.table(table).update(_scope_update_payload(table, payload))
            for f in filters:
                if f.get("op") == "eq":
                    query = query.eq(f.get("column"), f.get("value"))
                elif f.get("op") == "neq":
                    query = query.neq(f.get("column"), f.get("value"))
            result = query.execute()
            rows_affected = len(result.data) if result.data else 0
            logger.info(f"MUTATE_UPDATE id={g.request_id} user_id={request.user.id} table={table} rows_updated={rows_affected}")
            return jsonify({"data": result.data, "error": None})

        # DELETE action
        query = db_client.table(table).delete()
        for f in filters:
            if f.get("op") == "eq":
                query = query.eq(f.get("column"), f.get("value"))
            elif f.get("op") == "neq":
                query = query.neq(f.get("column"), f.get("value"))
        result = query.execute()
        rows_affected = len(result.data) if result.data else 0
        logger.info(f"MUTATE_DELETE id={g.request_id} user_id={request.user.id} table={table} rows_deleted={rows_affected}")
        return jsonify({"data": result.data, "error": None})
    except Exception as exc:
        logger.error(f"MUTATE_ERROR id={g.request_id} user_id={request.user.id} table={table} action={action} error={str(exc)}")
        return jsonify({"data": None, "error": str(exc)}), 400


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
