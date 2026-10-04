import json
import mysql.connector
from mysql.connector import Error
from flask import current_app, g


def get_db_config():
    return {
        "host": current_app.config["DB_HOST"],
        "port": current_app.config["DB_PORT"],
        "database": current_app.config["DB_NAME"],
        "user": current_app.config["DB_USER"],
        "password": current_app.config["DB_PASSWORD"],
        "autocommit": False,
    }


def get_connection():
    if "db_conn" not in g:
        g.db_conn = mysql.connector.connect(**get_db_config())
    return g.db_conn


def close_connection(e=None):
    conn = g.pop("db_conn", None)
    if conn is not None and conn.is_connected():
        conn.close()


def execute_query(query, params=None, fetchone=False, fetchall=False, commit=False):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(query, params or ())
        if commit:
            conn.commit()
            return cursor.lastrowid
        if fetchone:
            return cursor.fetchone()
        if fetchall:
            return cursor.fetchall()
        return None
    except Error:
        conn.rollback()
        raise
    finally:
        cursor.close()


def json_dumps(data):
    return json.dumps(data) if data is not None else None
