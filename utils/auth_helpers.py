from functools import wraps
from flask import session, redirect, url_for, flash, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from database.db import execute_query


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    return check_password_hash(password_hash, password)


def login_user(user: dict):
    session.clear()
    session["user_id"] = user["user_id"]
    session["name"] = user["name"]
    session["email"] = user["email"]
    session["role"] = user["role"]
    session.permanent = True


def logout_user():
    session.clear()


def current_user_id():
    return session.get("user_id")


def is_logged_in():
    return "user_id" in session


def is_admin():
    return session.get("role") == "admin"


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not is_logged_in():
            if request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required."}), 401
            flash("Please log in to continue.", "warning")
            return redirect(url_for("auth.login_page"))
        return view(*args, **kwargs)

    return wrapped


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not is_logged_in():
            if request.path.startswith("/api/"):
                return jsonify({"error": "Authentication required."}), 401
            return redirect(url_for("auth.login_page"))
        if not is_admin():
            if request.path.startswith("/api/"):
                return jsonify({"error": "Admin access required."}), 403
            flash("You do not have permission to access that area.", "danger")
            return redirect(url_for("dashboard.user_dashboard_page"))
        return view(*args, **kwargs)

    return wrapped


def get_user_by_email(email: str):
    return execute_query(
        "SELECT * FROM users WHERE email = %s",
        (email.strip().lower(),),
        fetchone=True,
    )


def get_user_by_id(user_id: int):
    return execute_query(
        "SELECT user_id, name, email, role, is_active, created_at, last_login FROM users WHERE user_id = %s",
        (user_id,),
        fetchone=True,
    )
