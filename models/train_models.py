"""
Train URL (Random Forest) and Message (TF-IDF + Logistic Regression) models.

Usage (from project root):
  python models/train_models.py

Replace data/url_dataset.csv and data/message_dataset.csv with larger real datasets
for better accuracy. Labels: 0=safe, 1=suspicious, 2=scam/phishing.
"""
import os
import sys
import json
from datetime import datetime

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BASE_DIR)

from ml.url_features import extract_url_features, features_to_vector
from ml.preprocessing import clean_text, ensure_nltk

DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")


def train_url_model():
    csv_path = os.path.join(DATA_DIR, "url_dataset.csv")
    df = pd.read_csv(csv_path)
    X, y = [], []
    feature_order = None
    for _, row in df.iterrows():
        feats = extract_url_features(str(row["url"]))
        vec, feature_order = features_to_vector(feats, feature_order)
        X.append(vec)
        y.append(int(row["label"]))
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y if len(set(y)) > 1 else None
    )
    clf = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=8)
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred) if len(y_test) else 0.0
    print("URL Model accuracy (demo dataset):", round(acc, 4))
    print(classification_report(y_test, y_pred, zero_division=0))

    out = {
        "model": clf,
        "feature_order": feature_order,
        "trained_at": datetime.utcnow().isoformat(),
        "accuracy": acc,
    }
    joblib.dump(out, os.path.join(MODEL_DIR, "url_model.pkl"))
    return acc


def train_message_model():
    ensure_nltk()
    csv_path = os.path.join(DATA_DIR, "message_dataset.csv")
    df = pd.read_csv(csv_path)
    texts = [clean_text(str(t)) for t in df["text"]]
    y = [int(v) for v in df["label"]]
    vectorizer = TfidfVectorizer(max_features=2000, ngram_range=(1, 2))
    X = vectorizer.fit_transform(texts)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y if len(set(y)) > 1 else None
    )
    clf = LogisticRegression(max_iter=1000, random_state=42, multi_class="multinomial")
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred) if len(y_test) else 0.0
    print("Message Model accuracy (demo dataset):", round(acc, 4))
    print(classification_report(y_test, y_pred, zero_division=0))

    out = {
        "model": clf,
        "vectorizer": vectorizer,
        "trained_at": datetime.utcnow().isoformat(),
        "accuracy": acc,
    }
    joblib.dump(out, os.path.join(MODEL_DIR, "message_model.pkl"))
    return acc


def update_ml_models_table(acc_url, acc_msg):
    """Optional: write metadata JSON for manual DB update."""
    meta = {
        "url_random_forest": {"accuracy": acc_url, "trained_date": datetime.utcnow().isoformat()},
        "message_logistic_regression": {
            "accuracy": acc_msg,
            "trained_date": datetime.utcnow().isoformat(),
        },
    }
    with open(os.path.join(MODEL_DIR, "training_metadata.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print("Wrote models/training_metadata.json — update ml_models table in MySQL if desired.")


if __name__ == "__main__":
    os.makedirs(MODEL_DIR, exist_ok=True)
    a1 = train_url_model()
    a2 = train_message_model()
    update_ml_models_table(a1, a2)
    print("Training complete. Models saved to models/")
