import os
import joblib
from flask import current_app

from ml.preprocessing import pattern_indicators, clean_text
from ml.risk_engine import (
    compute_risk_score,
    finalize_result,
    build_reasons,
    ml_class_to_label,
    RECOMMENDATION,
)


class MessageDetector:
    def __init__(self):
        self.model = None
        self.vectorizer = None
        self.model_loaded = False
        self.fallback_mode = False

    def load(self):
        path = current_app.config["MESSAGE_MODEL_PATH"]
        if os.path.isfile(path):
            bundle = joblib.load(path)
            self.model = bundle["model"]
            self.vectorizer = bundle["vectorizer"]
            self.model_loaded = True
            self.fallback_mode = False
        else:
            self.model_loaded = False
            self.fallback_mode = True
            if current_app.config.get("REQUIRE_ML_MODELS"):
                raise FileNotFoundError(
                    f"Message model not found at {path}. Run: python models/train_models.py"
                )

    def _fallback_predict(self, text: str, indicators: list) -> tuple[int, dict | None]:
        score = len(indicators) * 3
        lower = text.lower()
        if any(w in lower for w in ["otp", "password", "pin", "aadhaar", "ssn"]):
            score += 15
        if "http" in lower or "bit.ly" in lower:
            score += 10
        if score >= 20:
            return 2, None
        if score >= 8:
            return 1, None
        return 0, None

    def analyze(self, message: str, message_type: str = "general") -> dict:
        indicators = pattern_indicators(message)
        cleaned = clean_text(message)

        ml_proba = None
        if self.model_loaded and self.model is not None and self.vectorizer is not None:
            X = self.vectorizer.transform([cleaned])
            pred = int(self.model.predict(X)[0])
            if hasattr(self.model, "predict_proba"):
                probs = self.model.predict_proba(X)[0]
                classes = list(self.model.classes_)
                ml_proba = {int(c): float(p) for c, p in zip(classes, probs)}
            ml_class = pred
            ml_used = True
        else:
            ml_class, ml_proba = self._fallback_predict(message, indicators)
            ml_used = False

        risk_score = compute_risk_score(ml_proba, ml_class, len(indicators), len(cleaned) // 200)
        result_label = finalize_result(ml_class, risk_score)
        ml_label = ml_class_to_label(ml_class)
        reasons = build_reasons(ml_label, indicators, ml_used)

        from ml.risk_engine import risk_level_from_score

        return {
            "input_type": "message",
            "input_value": message,
            "message_type": message_type,
            "result": result_label,
            "risk_score": risk_score,
            "risk_level": risk_level_from_score(risk_score),
            "reasons": reasons,
            "indicators": indicators,
            "recommendation": RECOMMENDATION,
            "ml_fallback": self.fallback_mode and not self.model_loaded,
        }
