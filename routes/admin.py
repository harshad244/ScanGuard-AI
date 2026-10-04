from flask import Blueprint, render_template, request, jsonify
from database.db import execute_query
from utils.auth_helpers import admin_required, get_user_by_id

admin_bp = Blueprint("admin", __name__)


def _global_scan_stats():
    row = execute_query(
        """
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN result = 'SAFE' THEN 1 ELSE 0 END) AS safe_cnt,
          SUM(CASE WHEN result = 'SUSPICIOUS' THEN 1 ELSE 0 END) AS suspicious_cnt,
          SUM(CASE WHEN result = 'SCAM' THEN 1 ELSE 0 END) AS scam_cnt
        FROM scans
        """,
        fetchone=True,
    )
    users = execute_query("SELECT COUNT(*) AS cnt FROM users", fetchone=True)
    return {
        "total_users": int(users["cnt"] or 0),
        "total_scans": int(row["total"] or 0),
        "safe": int(row["safe_cnt"] or 0),
        "suspicious": int(row["suspicious_cnt"] or 0),
        "scam": int(row["scam_cnt"] or 0),
    }


@admin_bp.route("/admin", methods=["GET"])
@admin_required
def admin_dashboard_page():
    stats = _global_scan_stats()
    recent = execute_query(
        """
        SELECT s.scan_id, s.input_type, s.result, s.risk_score, s.scan_date, u.name, u.email
        FROM scans s JOIN users u ON s.user_id = u.user_id
        ORDER BY s.scan_date DESC LIMIT 10
        """,
        fetchall=True,
    )
    models = execute_query("SELECT * FROM ml_models ORDER BY model_id", fetchall=True)
    return render_template("admin_dashboard.html", stats=stats, recent=recent or [], models=models or [])


@admin_bp.route("/admin/users", methods=["GET"])
@admin_required
def users_page():
    return render_template("users.html")


@admin_bp.route("/admin/reports", methods=["GET"])
@admin_required
def reports_page():
    return render_template("reports.html")


@admin_bp.route("/admin/scans", methods=["GET"])
@admin_required
def scans_page():
    return render_template("admin_scans.html")


@admin_bp.route("/admin/models", methods=["GET"])
@admin_required
def models_page():
    models = execute_query("SELECT * FROM ml_models ORDER BY model_id", fetchall=True)
    return render_template("admin_models.html", models=models or [])


@admin_bp.route("/api/admin/users", methods=["GET"])
@admin_required
def api_admin_users():
    q = (request.args.get("q") or "").strip()
    if q:
        rows = execute_query(
            """
            SELECT user_id, name, email, role, is_active, created_at, last_login
            FROM users WHERE name LIKE %s OR email LIKE %s ORDER BY created_at DESC
            """,
            (f"%{q}%", f"%{q}%"),
            fetchall=True,
        )
    else:
        rows = execute_query(
            """
            SELECT user_id, name, email, role, is_active, created_at, last_login
            FROM users ORDER BY created_at DESC LIMIT 500
            """,
            fetchall=True,
        )
    return jsonify({"users": rows or []})


@admin_bp.route("/api/admin/users/<int:user_id>/toggle", methods=["POST"])
@admin_required
def api_toggle_user(user_id):
    user = get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404
    if user["role"] == "admin":
        return jsonify({"error": "Cannot disable admin accounts via this action."}), 400
    new_val = 0 if user.get("is_active", 1) else 1
    execute_query(
        "UPDATE users SET is_active = %s WHERE user_id = %s",
        (new_val, user_id),
        commit=True,
    )
    return jsonify({"message": "User status updated.", "is_active": new_val})


@admin_bp.route("/api/admin/reports", methods=["GET"])
@admin_required
def api_admin_reports():
    stats = _global_scan_stats()
    by_result = execute_query(
        "SELECT result, COUNT(*) AS cnt FROM scans GROUP BY result",
        fetchall=True,
    )
    by_type = execute_query(
        "SELECT input_type, COUNT(*) AS cnt FROM scans GROUP BY input_type",
        fetchall=True,
    )
    daily = execute_query(
        """
        SELECT DATE(scan_date) AS day, COUNT(*) AS cnt
        FROM scans WHERE scan_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE(scan_date) ORDER BY day
        """,
        fetchall=True,
    )
    monthly = execute_query(
        """
        SELECT DATE_FORMAT(scan_date, '%%Y-%%m') AS month, COUNT(*) AS cnt
        FROM scans GROUP BY DATE_FORMAT(scan_date, '%%Y-%%m') ORDER BY month
        """,
        fetchall=True,
    )
    return jsonify(
        {
            "stats": stats,
            "by_result": by_result or [],
            "by_type": by_type or [],
            "daily": daily or [],
            "monthly": monthly or [],
        }
    )


@admin_bp.route("/api/admin/scans", methods=["GET"])
@admin_required
def api_admin_scans():
    rows = execute_query(
        """
        SELECT s.scan_id, s.input_type, LEFT(s.input_value, 100) AS input_preview,
               s.result, s.risk_score, s.scan_date, u.email
        FROM scans s JOIN users u ON s.user_id = u.user_id
        ORDER BY s.scan_date DESC LIMIT 300
        """,
        fetchall=True,
    )
    return jsonify({"scans": rows or []})
