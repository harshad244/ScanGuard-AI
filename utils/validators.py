import re
from urllib.parse import urlparse

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def validate_email(email: str) -> bool:
    return bool(email and EMAIL_RE.match(email.strip()))


def validate_password(password: str) -> tuple[bool, str]:
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters."
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        return False, "Password must contain at least one letter and one number."
    return True, ""


def validate_url(url: str) -> tuple[bool, str]:
    if not url or not url.strip():
        return False, "URL cannot be empty."
    raw = url.strip()
    if len(raw) > 2048:
        return False, "URL is too long."
    parsed = urlparse(raw if "://" in raw else "http://" + raw)
    if not parsed.hostname:
        return False, "Invalid URL. Please enter a valid URL."
    if " " in raw:
        return False, "Invalid URL. Please enter a valid URL."
    return True, raw if "://" in raw else "http://" + raw


def validate_message(text: str) -> tuple[bool, str]:
    if not text or not text.strip():
        return False, "Message cannot be empty."
    if len(text.strip()) < 10:
        return False, "Message is too short to analyze meaningfully."
    if len(text) > 10000:
        return False, "Message exceeds maximum length (10000 characters)."
    return True, text.strip()
