"""Combine ML output with rule-based signals into risk score and labels."""

LABEL_SAFE = "SAFE"
LABEL_SUSPICIOUS = "SUSPICIOUS"
LABEL_SCAM = "SCAM"

LEVEL_LOW = "LOW"
LEVEL_MEDIUM = "MEDIUM"
LEVEL_HIGH = "HIGH"


def risk_level_from_score(score: int) -> str:
    if score <= 30:
        return LEVEL_LOW
    if score <= 70:
        return LEVEL_MEDIUM
    return LEVEL_HIGH


def ml_class_to_label(class_id: int) -> str:
    """0=safe, 1=suspicious, 2=scam/phishing."""
    mapping = {0: LABEL_SAFE, 1: LABEL_SUSPICIOUS, 2: LABEL_SCAM}
    return mapping.get(int(class_id), LABEL_SUSPICIOUS)


def compute_risk_score(
    ml_proba: dict | None,
    ml_class: int,
    indicator_count: int,
    extra_rule_boost: int = 0,
) -> int:
    """
    Combine ML class probabilities (if available) with indicator severity.
    Not calibrated as true probability — decision support only.
    """
    base = {0: 15, 1: 55, 2: 82}.get(int(ml_class), 50)

    if ml_proba:
        # Weighted average using class indices 0,1,2
        weighted = sum(int(k) * 35 * v for k, v in ml_proba.items())
        base = int(min(100, max(0, weighted + base * 0.4)))

    boost = min(25, indicator_count * 5) + min(15, extra_rule_boost)
    score = int(min(100, max(0, base + boost)))
    return score


def finalize_result(ml_class: int, risk_score: int) -> str:
    """Align label with score bands for consistency."""
    level = risk_level_from_score(risk_score)
    label = ml_class_to_label(ml_class)
    if level == LEVEL_HIGH and label == LABEL_SAFE:
        return LABEL_SUSPICIOUS
    if level == LEVEL_LOW and label == LABEL_SCAM:
        return LABEL_SUSPICIOUS
    return label


def build_reasons(ml_label: str, indicators: list[str], ml_used: bool) -> list[str]:
    reasons = []
    if ml_used:
        reasons.append(f"Machine learning model classified input as {ml_label.lower()}")
    else:
        reasons.append("Analysis used rule-based fallback (train models for full ML pipeline)")
    for ind in indicators[:5]:
        reasons.append(ind)
    if not indicators:
        reasons.append("No strong suspicious indicators beyond model score")
    return reasons


RECOMMENDATION = (
    "Do not share passwords, OTPs, banking information or personal information "
    "with suspicious sources. Verify through official apps or known contact channels."
)
