import os
import secrets
from dotenv import load_dotenv

load_dotenv()


class Config:
    FLASK_ENV = os.environ.get("FLASK_ENV", "development")
    DEBUG = FLASK_ENV == "development"
    SECRET_KEY = os.environ.get("SECRET_KEY") or (
        secrets.token_hex(32) if FLASK_ENV == "development" else None
    )

    DB_HOST = os.environ.get("DB_HOST", "localhost")
    DB_PORT = int(os.environ.get("DB_PORT", "3306"))
    DB_NAME = os.environ.get("DB_NAME", "scam_detection")
    DB_USER = os.environ.get("DB_USER", "root")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "")

    REQUIRE_ML_MODELS = os.environ.get("REQUIRE_ML_MODELS", "0") == "1"
    SCAN_RATE_LIMIT = int(os.environ.get("SCAN_RATE_LIMIT", "30"))

    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    MODEL_DIR = os.path.join(BASE_DIR, "models")
    URL_MODEL_PATH = os.path.join(MODEL_DIR, "url_model.pkl")
    MESSAGE_MODEL_PATH = os.path.join(MODEL_DIR, "message_model.pkl")
    DATA_DIR = os.path.join(BASE_DIR, "data")

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = FLASK_ENV == "production"
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = None
