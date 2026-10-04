import re
import string

try:
    import nltk
    from nltk.corpus import stopwords
    from nltk.tokenize import word_tokenize

    _NLTK_READY = False

    def ensure_nltk():
        global _NLTK_READY
        if _NLTK_READY:
            return
        for resource in ("punkt", "punkt_tab", "stopwords"):
            try:
                nltk.data.find(
                    f"tokenizers/{resource}" if "punkt" in resource else f"corpora/{resource}"
                )
            except LookupError:
                nltk.download(resource, quiet=True)
        _NLTK_READY = True

except ImportError:
    nltk = None

    def ensure_nltk():
        pass


def clean_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"http[s]?://\S+|www\.\S+", " urltoken ", text)
    text = re.sub(r"\d+", " numtoken ", text)
    text = re.sub(r"[^a-z\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize_text(text: str, remove_stopwords: bool = True) -> list[str]:
    ensure_nltk()
    cleaned = clean_text(text)
    if nltk:
        tokens = word_tokenize(cleaned)
        if remove_stopwords:
            try:
                stops = set(stopwords.words("english"))
                tokens = [t for t in tokens if t not in stops and len(t) > 1]
            except LookupError:
                nltk.download("stopwords", quiet=True)
                stops = set(stopwords.words("english"))
                tokens = [t for t in tokens if t not in stops and len(t) > 1]
        return tokens
    # Fallback without NLTK
    return [t for t in cleaned.split() if len(t) > 1]


SCAM_PATTERNS = [
    (r"\b(otp|one time password|pin|upi pin)\b", "Requests OTP/PIN"),
    (r"\b(suspend|locked|blocked|expire)\b.*\b(account|card)\b", "Account suspension threat"),
    (r"\b(lottery|prize|winner|won)\b", "Prize/lottery language"),
    (r"\b(urgent|immediately|within \d+ (hour|minute|min))\b", "Urgency pressure"),
    (r"\b(verify|confirm|update).{0,30}(bank|payment|billing)\b", "Payment verification pressure"),
    (r"\b(processing fee|registration fee|customs fee)\b", "Fee payment request"),
    (r"\b(click here|bit\.ly|tinyurl)\b", "Suspicious link prompt"),
    (r"\b(share|send).{0,20}(password|aadhaar|ssn|bank)\b", "Sensitive data request"),
    (r"\b(fake job|job offer).{0,30}(fee|deposit)\b", "Fake job fee pattern"),
    (r"\b(impersonat|pretend|official support)\b", "Impersonation wording"),
]


def pattern_indicators(text: str) -> list[str]:
    lower = text.lower()
    found = []
    for pattern, label in SCAM_PATTERNS:
        if re.search(pattern, lower, re.I):
            found.append(label)
    return found
