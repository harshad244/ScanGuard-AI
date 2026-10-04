from datetime import datetime, timedelta
from flask import Blueprint, render_template, request, jsonify, current_app, url_for
from utils.auth_helpers import login_required, current_user_id
from utils.validators import validate_url, validate_message
from services.scan_service import save_scan, get_scan_by_id

scanner_bp = Blueprint("scanner", __name__)


def _check_rate_limit(user_id: int) -> bool:
    limit = current_app.config.get("SCAN_RATE_LIMIT", 0)
    if limit <= 0:
        return True
    from database.db import execute_query

    since = datetime.utcnow() - timedelta(hours=1)
    row = execute_query(
        "SELECT COUNT(*) AS cnt FROM scans WHERE user_id = %s AND scan_date >= %s",
        (user_id, since),
        fetchone=True,
    )
    return (row["cnt"] if row else 0) < limit


def _get_detectors():
    return current_app.extensions["url_detector"], current_app.extensions["message_detector"]


@scanner_bp.route("/scan/url", methods=["GET"])
@login_required
def url_scanner_page():
    return render_template("url_scanner.html")


@scanner_bp.route("/scan/message", methods=["GET"])
@login_required
def message_scanner_page():
    return render_template("message_scanner.html")


@scanner_bp.route("/result/<int:scan_id>", methods=["GET"])
@login_required
def result_page(scan_id):
    from database.db import execute_query
    import json

    scan = get_scan_by_id(scan_id, user_id=current_user_id())
    if not scan:
        return render_template("404.html"), 404
    reasons = [r.strip() for r in (scan.get("reason") or "").split("|") if r.strip()]
    indicators = []
    if scan["input_type"] == "url":
        row = execute_query(
            "SELECT suspicious_features FROM url_analysis WHERE scan_id = %s",
            (scan_id,),
            fetchone=True,
        )
        if row and row.get("suspicious_features"):
            try:
                payload = json.loads(row["suspicious_features"])
                indicators = payload.get("indicators") or []
            except (TypeError, json.JSONDecodeError):
                pass
    else:
        row = execute_query(
            "SELECT suspicious_features FROM message_analysis WHERE scan_id = %s",
            (scan_id,),
            fetchone=True,
        )
        if row and row.get("suspicious_features"):
            try:
                payload = json.loads(row["suspicious_features"])
                indicators = payload.get("indicators") or []
            except (TypeError, json.JSONDecodeError):
                pass
    return render_template("result.html", scan=scan, reasons=reasons, indicators=indicators)


@scanner_bp.route("/api/scan/url", methods=["POST"])
@login_required
def api_scan_url():
    data = request.get_json(silent=True) or request.form
    url_input = data.get("url") or ""
    ok, result = validate_url(url_input)
    if not ok:
        return jsonify({"error": result}), 400

    uid = current_user_id()
    if not _check_rate_limit(uid):
        return jsonify({"error": "Scan limit reached. Please try again later."}), 429

    url_detector, _ = _get_detectors()
    analysis = url_detector.analyze(result)
    scan_id = save_scan(uid, analysis)
    return jsonify(
        {
            "scan_id": scan_id,
            "analysis": {
                k: analysis[k]
                for k in (
                    "input_type",
                    "result",
                    "risk_score",
                    "risk_level",
                    "reasons",
                    "indicators",
                    "recommendation",
                    "ml_fallback",
                )
            },
            "redirect": url_for("scanner.result_page", scan_id=scan_id),
        }
    )


@scanner_bp.route("/api/scan/message", methods=["POST"])
@login_required
def api_scan_message():
    data = request.get_json(silent=True) or request.form
    text = data.get("message") or ""
    msg_type = (data.get("message_type") or "general").strip()[:50]
    ok, result = validate_message(text)
    if not ok:
        return jsonify({"error": result}), 400

    uid = current_user_id()
    if not _check_rate_limit(uid):
        return jsonify({"error": "Scan limit reached. Please try again later."}), 429

    _, message_detector = _get_detectors()
    analysis = message_detector.analyze(result, msg_type)
    scan_id = save_scan(uid, analysis)
    return jsonify(
        {
            "scan_id": scan_id,
            "analysis": {
                k: analysis[k]
                for k in (
                    "input_type",
                    "result",
                    "risk_score",
                    "risk_level",
                    "reasons",
                    "indicators",
                    "recommendation",
                    "ml_fallback",
                )
            },
            "redirect": url_for("scanner.result_page", scan_id=scan_id),
        }
    )
