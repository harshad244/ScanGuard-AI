from datetime import datetime
from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from database.db import execute_query
from utils.auth_helpers import (
    hash_password,
    verify_password,
    login_user,
    logout_user,
    get_user_by_email,
    get_user_by_id,
    login_required,
    is_logged_in,
)
from utils.validators import validate_email, validate_password

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["GET"])
def register_page():
    if is_logged_in():
        return redirect(url_for("dashboard.user_dashboard_page"))
    return render_template("register.html")


@auth_bp.route("/login", methods=["GET"])
def login_page():
    if is_logged_in():
        return redirect(url_for("dashboard.user_dashboard_page"))
    return render_template("login.html")


@auth_bp.route("/logout", methods=["POST"])
def logout_page():
    logout_user()
    flash("You have been logged out.", "info")
    return redirect(url_for("index"))


@auth_bp.route("/profile", methods=["GET"])
@login_required
def profile_page():
    user = get_user_by_id(session["user_id"])
    return render_template("profile.html", user=user)


@auth_bp.route("/api/register", methods=["POST"])
def api_register():
    data = request.get_json(silent=True) or request.form
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm = data.get("confirm_password") or data.get("confirm") or ""

    if not name or len(name) < 2:
        return jsonify({"error": "Please enter a valid name."}), 400
    if not validate_email(email):
        return jsonify({"error": "Please enter a valid email address."}), 400
    ok, msg = validate_password(password)
    if not ok:
        return jsonify({"error": msg}), 400
    if password != confirm:
        return jsonify({"error": "Passwords do not match."}), 400

    if get_user_by_email(email):
        return jsonify({"error": "An account with this email already exists."}), 409

    pwd_hash = hash_password(password)
    user_id = execute_query(
        "INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, 'user')",
        (name, email, pwd_hash),
        commit=True,
    )
    user = get_user_by_id(user_id)
    login_user({**user, "password_hash": pwd_hash})
    execute_query(
        "UPDATE users SET last_login = %s WHERE user_id = %s",
        (datetime.utcnow(), user_id),
        commit=True,
    )
    return jsonify({"message": "Registration successful.", "redirect": url_for("dashboard.user_dashboard_page")}), 201


@auth_bp.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or request.form
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not validate_email(email):
        return jsonify({"error": "Invalid email or password."}), 401

    user = get_user_by_email(email)
    if not user or not verify_password(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password."}), 401
    if not user.get("is_active", 1):
        return jsonify({"error": "Your account has been disabled. Contact administrator."}), 403

    login_user(user)
    execute_query(
        "UPDATE users SET last_login = %s WHERE user_id = %s",
        (datetime.utcnow(), user["user_id"]),
        commit=True,
    )
    redirect_url = url_for("admin.admin_dashboard_page") if user["role"] == "admin" else url_for(
        "dashboard.user_dashboard_page"
    )
    return jsonify({"message": "Login successful.", "redirect": redirect_url})


@auth_bp.route("/api/logout", methods=["POST"])
def api_logout():
    logout_user()
    return jsonify({"message": "Logged out.", "redirect": url_for("index")})
