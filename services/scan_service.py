import json
from database.db import execute_query, get_connection, json_dumps


def save_scan(user_id: int, analysis: dict) -> int:
    reasons = analysis.get("reasons") or []
    reason_text = " | ".join(reasons[:10])
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO scans (user_id, input_type, input_value, result, risk_score, risk_level, reason)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                analysis["input_type"],
                analysis["input_value"][:4000],
                analysis["result"],
                analysis["risk_score"],
                analysis["risk_level"],
                reason_text,
            ),
        )
        scan_id = cursor.lastrowid

        if analysis["input_type"] == "url":
            feats = analysis.get("features") or {}
            cursor.execute(
                """
                INSERT INTO url_analysis (scan_id, url, domain, url_length, https_used, suspicious_features)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    scan_id,
                    analysis["input_value"][:2048],
                    feats.get("domain"),
                    feats.get("url_length", 0),
                    feats.get("https_used", 0),
                    json_dumps(
                        {
                            "indicators": analysis.get("indicators"),
                            "features": {k: v for k, v in feats.items() if k != "domain"},
                        }
                    ),
                ),
            )
        else:
            cursor.execute(
                """
                INSERT INTO message_analysis (scan_id, message_text, message_type, suspicious_features)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    scan_id,
                    analysis["input_value"][:8000],
                    analysis.get("message_type", "general"),
                    json_dumps({"indicators": analysis.get("indicators")}),
                ),
            )
        conn.commit()
        return scan_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()


def get_scan_by_id(scan_id: int, user_id: int | None = None, admin: bool = False):
    if admin:
        row = execute_query(
            "SELECT * FROM scans WHERE scan_id = %s",
            (scan_id,),
            fetchone=True,
        )
    else:
        row = execute_query(
            "SELECT * FROM scans WHERE scan_id = %s AND user_id = %s",
            (scan_id, user_id),
            fetchone=True,
        )
    return row
