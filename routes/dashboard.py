from flask import Blueprint, render_template, jsonify, session
from database.db import execute_query
from utils.auth_helpers import login_required, get_user_by_id

dashboard_bp = Blueprint("dashboard", __name__)


def _user_scan_stats(user_id: int):
    rows = execute_query(
        """
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN result = 'SAFE' THEN 1 ELSE 0 END) AS safe_cnt,
          SUM(CASE WHEN result = 'SUSPICIOUS' THEN 1 ELSE 0 END) AS suspicious_cnt,
          SUM(CASE WHEN result = 'SCAM' THEN 1 ELSE 0 END) AS scam_cnt
        FROM scans WHERE user_id = %s
        """,
        (user_id,),
        fetchone=True,
    )
    return {
        "total": int(rows["total"] or 0),
        "safe": int(rows["safe_cnt"] or 0),
        "suspicious": int(rows["suspicious_cnt"] or 0),
        "scam": int(rows["scam_cnt"] or 0),
    }


@dashboard_bp.route("/dashboard", methods=["GET"])
@login_required
def user_dashboard_page():
    stats = _user_scan_stats(session["user_id"])
    recent = execute_query(
        """
        SELECT scan_id, input_type, result, risk_score, risk_level, scan_date,
               LEFT(input_value, 80) AS input_preview
        FROM scans WHERE user_id = %s ORDER BY scan_date DESC LIMIT 8
        """,
        (session["user_id"],),
        fetchall=True,
    )
    return render_template("dashboard.html", stats=stats, recent=recent or [])


@dashboard_bp.route("/history", methods=["GET"])
@login_required
def history_page():
    return render_template("history.html")


@dashboard_bp.route("/api/dashboard", methods=["GET"])
@login_required
def api_dashboard():
    uid = session["user_id"]
    stats = _user_scan_stats(uid)
    distribution = execute_query(
        """
        SELECT result, COUNT(*) AS cnt FROM scans WHERE user_id = %s GROUP BY result
        """,
        (uid,),
        fetchall=True,
    )
    activity = execute_query(
        """
        SELECT DATE(scan_date) AS day, COUNT(*) AS cnt
        FROM scans WHERE user_id = %s AND scan_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        GROUP BY DATE(scan_date) ORDER BY day
        """,
        (uid,),
        fetchall=True,
    )
    recent = execute_query(
        """
        SELECT scan_id, input_type, result, risk_score, risk_level, scan_date,
               LEFT(input_value, 100) AS input_preview
        FROM scans WHERE user_id = %s ORDER BY scan_date DESC LIMIT 10
        """,
        (uid,),
        fetchall=True,
    )
    return jsonify(
        {
            "stats": stats,
            "distribution": distribution or [],
            "activity": activity or [],
            "recent": recent or [],
        }
    )


@dashboard_bp.route("/api/history", methods=["GET"])
@login_required
def api_history():
    from flask import request

    uid = session["user_id"]
    q = (request.args.get("q") or "").strip()
    result_filter = (request.args.get("result") or "").strip().upper()
    type_filter = (request.args.get("input_type") or "").strip().lower()
    sort = request.args.get("sort", "desc")

    clauses = ["user_id = %s"]
    params = [uid]
    if q:
        clauses.append("(input_value LIKE %s OR reason LIKE %s)")
        params.extend([f"%{q}%", f"%{q}%"])
    if result_filter in ("SAFE", "SUSPICIOUS", "SCAM"):
        clauses.append("result = %s")
        params.append(result_filter)
    if type_filter in ("url", "message"):
        clauses.append("input_type = %s")
        params.append(type_filter)

    order = "ASC" if sort == "asc" else "DESC"
    sql = f"""
        SELECT scan_id, input_type, LEFT(input_value, 120) AS input_preview,
               input_value, result, risk_score, risk_level, reason, scan_date
        FROM scans WHERE {' AND '.join(clauses)}
        ORDER BY scan_date {order}
        LIMIT 200
    """
    rows = execute_query(sql, tuple(params), fetchall=True)
    return jsonify({"history": rows or []})
