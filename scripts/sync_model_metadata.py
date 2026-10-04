"""Update ml_models table from models/training_metadata.json after training."""
import json
import os
from datetime import datetime
from dotenv import load_dotenv
import mysql.connector

load_dotenv()
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
meta_path = os.path.join(BASE, "models", "training_metadata.json")
if not os.path.isfile(meta_path):
    print("No training_metadata.json found. Run train_models.py first.")
    raise SystemExit(1)

with open(meta_path, encoding="utf-8") as f:
    meta = json.load(f)

conn = mysql.connector.connect(
    host=os.getenv("DB_HOST", "localhost"),
    port=int(os.getenv("DB_PORT", "3306")),
    database=os.getenv("DB_NAME", "scam_detection"),
    user=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", ""),
)
cur = conn.cursor()
mapping = {
    "url_random_forest": "url_random_forest",
    "message_logistic_regression": "message_logistic_regression",
}
for key, model_name in mapping.items():
    if key not in meta:
        continue
    acc = meta[key].get("accuracy")
    trained = meta[key].get("trained_date") or datetime.utcnow().isoformat()
    cur.execute(
        """
        UPDATE ml_models SET accuracy = %s, trained_date = %s, status = 'active'
        WHERE model_name = %s
        """,
        (acc, trained, model_name),
    )
conn.commit()
cur.close()
conn.close()
print("ML model metadata synced to database.")
