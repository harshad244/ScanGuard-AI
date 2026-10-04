import os
from flask import Flask, render_template, session
from flask_wtf.csrf import CSRFProtect

from config import Config
from database.db import close_connection
from ml.url_detector import URLDetector
from ml.message_detector import MessageDetector
from routes.auth import auth_bp
from routes.scanner import scanner_bp
from routes.dashboard import dashboard_bp
from routes.admin import admin_bp


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    if not app.config.get("SECRET_KEY"):
        raise RuntimeError("SECRET_KEY must be configured before starting in production.")

    CSRFProtect(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(scanner_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(admin_bp)

    app.teardown_appcontext(close_connection)

    url_detector = URLDetector()
    message_detector = MessageDetector()

    with app.app_context():
        try:
            url_detector.load()
            message_detector.load()
        except FileNotFoundError as e:
            if app.config.get("REQUIRE_ML_MODELS"):
                raise
            app.logger.warning(str(e))
    app.extensions["url_detector"] = url_detector
    app.extensions["message_detector"] = message_detector
    app.extensions["ml_loaded"] = True

    @app.context_processor
    def inject_globals():
        return {
            "current_user_name": session.get("name"),
            "is_authenticated": "user_id" in session,
            "is_admin": session.get("role") == "admin",
        }

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.errorhandler(404)
    def not_found(e):
        return render_template("404.html"), 404

    @app.errorhandler(500)
    def server_error(e):
        if app.config.get("DEBUG"):
            raise e
        return render_template("500.html"), 500

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=app.config.get("DEBUG"))
