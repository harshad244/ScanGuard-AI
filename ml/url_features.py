import re
from urllib.parse import urlparse

SUSPICIOUS_KEYWORDS = [
    "login", "verify", "secure", "update", "bank", "account", "password",
    "otp", "confirm", "wallet", "prize", "winner", "free", "urgent",
    "suspend", "locked", "click", "gift", "lottery", "refund",
]

SHORTENERS = ["bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd"]

IP_PATTERN = re.compile(
    r"^(?:\d{1,3}\.){3}\d{1,3}$"
)


def _count_special_chars(s: str) -> int:
    return sum(1 for c in s if not c.isalnum() and c not in "-._~/:")


def extract_url_features(url: str) -> dict:
    """Extract URL features for ML and rule-based indicators."""
    raw = url.strip()
    parsed = urlparse(raw if "://" in raw else "http://" + raw)
    host = (parsed.hostname or "").lower()
    path = parsed.path or ""
    full_lower = raw.lower()

    dots = host.count(".")
    hyphens = host.count("-") + path.count("-")
    subdomains = max(0, dots - 1) if host else 0

    https_used = 1 if parsed.scheme == "https" else 0
    has_at = 1 if "@" in raw else 0

    ip_used = 1 if host and IP_PATTERN.match(host) else 0

    keyword_hits = sum(1 for kw in SUSPICIOUS_KEYWORDS if kw in full_lower)
    shortener = 1 if any(s in host for s in SHORTENERS) else 0

    path_len = len(path)
    url_len = len(raw)
    domain_len = len(host)

    digit_ratio = sum(c.isdigit() for c in host) / max(len(host), 1)

    typosquat = 1 if any(
        t in host for t in ["go0gle", "faceb00k", "paypa1", "micros0ft", "amaz0n"]
    ) else 0

    features = {
        "url_length": url_len,
        "domain_length": domain_len,
        "num_dots": dots,
        "num_hyphens": hyphens,
        "num_special_chars": _count_special_chars(raw),
        "https_used": https_used,
        "ip_used": ip_used,
        "num_subdomains": subdomains,
        "suspicious_keyword_count": keyword_hits,
        "has_at_symbol": has_at,
        "url_shortener": shortener,
        "path_length": path_len,
        "digit_ratio_in_domain": round(digit_ratio, 4),
        "typosquat_indicator": typosquat,
    }
    features["domain"] = host
    return features


def features_to_vector(features: dict, feature_order: list | None = None):
    """Convert feature dict to list in stable order for sklearn."""
    order = feature_order or [
        "url_length", "domain_length", "num_dots", "num_hyphens",
        "num_special_chars", "https_used", "ip_used", "num_subdomains",
        "suspicious_keyword_count", "has_at_symbol", "url_shortener",
        "path_length", "digit_ratio_in_domain", "typosquat_indicator",
    ]
    return [features[k] for k in order], order


def explain_url_indicators(features: dict) -> list[str]:
    indicators = []
    if features.get("ip_used"):
        indicators.append("URL uses IP address instead of domain name")
    if features.get("has_at_symbol"):
        indicators.append("Contains '@' symbol (often used in URL obfuscation)")
    if features.get("url_shortener"):
        indicators.append("URL shortening service detected")
    if features.get("num_subdomains", 0) > 3:
        indicators.append("Unusual number of subdomains")
    if features.get("suspicious_keyword_count", 0) >= 2:
        indicators.append("Multiple suspicious keywords in URL")
    if not features.get("https_used"):
        indicators.append("HTTPS not used")
    if features.get("typosquat_indicator"):
        indicators.append("Possible typosquatting domain pattern")
    if features.get("path_length", 0) > 80:
        indicators.append("Excessively long URL path")
    if features.get("num_hyphens", 0) > 5:
        indicators.append("Unusual number of hyphens")
    return indicators
