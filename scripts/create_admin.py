"""
Create an admin user in MySQL.

Usage (from project root, with .env configured):
  python scripts/create_admin.py --email admin@example.com --name "System Admin" --password "Admin@123"
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
from werkzeug.security import generate_password_hash
import mysql.connector

load_dotenv()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="Administrator")
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "scam_detection"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
    )
    cur = conn.cursor()
    email = args.email.strip().lower()
    pwd_hash = generate_password_hash(args.password)
    cur.execute("SELECT user_id FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    if row:
        cur.execute(
            "UPDATE users SET name = %s, password_hash = %s, role = 'admin', is_active = 1 WHERE email = %s",
            (args.name, pwd_hash, email),
        )
        print(f"Updated existing user {email} to admin.")
    else:
        cur.execute(
            "INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, 'admin')",
            (args.name, email, pwd_hash),
        )
        print(f"Created admin user {email}.")
    conn.commit()
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
