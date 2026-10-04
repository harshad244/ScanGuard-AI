import os
import joblib
from flask import current_app

from ml.url_features import (
    extract_url_features,
    features_to_vector,
    explain_url_indicators,
)
from ml.risk_engine import (
    compute_risk_score,
    finalize_result,
    build_reasons,
    ml_class_to_label,
    RECOMMENDATION,
)


class URLDetector:
    def __init__(self):
        self.model = None
        self.feature_order = None
        self.model_loaded = False
        self.fallback_mode = False

    def load(self):
        path = current_app.config["URL_MODEL_PATH"]
        if os.path.isfile(path):
            bundle = joblib.load(path)
            self.model = bundle["model"]
            self.feature_order = bundle.get("feature_order")
            self.model_loaded = True
            self.fallback_mode = False
        else:
            self.model_loaded = False
            self.fallback_mode = True
            if current_app.config.get("REQUIRE_ML_MODELS"):
                raise FileNotFoundError(
                    f"URL model not found at {path}. Run: python models/train_models.py"
                )

    def _fallback_predict(self, features: dict) -> tuple[int, dict | None]:
        score = 0
        score += features.get("suspicious_keyword_count", 0) * 2
        score += features.get("num_subdomains", 0)
        score += 10 if features.get("ip_used") else 0
        score += 10 if features.get("has_at_symbol") else 0
        score += 8 if features.get("url_shortener") else 0
        score += 15 if features.get("typosquat_indicator") else 0
        score += 5 if not features.get("https_used") else 0
        if score >= 25:
            return 2, None
        if score >= 12:
            return 1, None
        return 0, None

    def analyze(self, url: str) -> dict:
        features = extract_url_features(url)
        indicators = explain_url_indicators(features)
        vector, order = features_to_vector(features, self.feature_order)
        if not self.feature_order:
            self.feature_order = order

        ml_proba = None
        if self.model_loaded and self.model is not None:
            pred = int(self.model.predict([vector])[0])
            if hasattr(self.model, "predict_proba"):
                probs = self.model.predict_proba([vector])[0]
                classes = list(self.model.classes_)
                ml_proba = {int(c): float(p) for c, p in zip(classes, probs)}
            ml_class = pred
            ml_used = True
        else:
            ml_class, ml_proba = self._fallback_predict(features)
            ml_used = False

        extra = len(indicators) * 2
        risk_score = compute_risk_score(ml_proba, ml_class, len(indicators), extra)
        result_label = finalize_result(ml_class, risk_score)
        ml_label = ml_class_to_label(ml_class)
        reasons = build_reasons(ml_label, indicators, ml_used)

        from ml.risk_engine import risk_level_from_score

        return {
            "input_type": "url",
            "input_value": url,
            "result": result_label,
            "risk_score": risk_score,
            "risk_level": risk_level_from_score(risk_score),
            "reasons": reasons,
            "indicators": indicators,
            "recommendation": RECOMMENDATION,
            "features": features,
            "ml_fallback": self.fallback_mode and not self.model_loaded,
        }
