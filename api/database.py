import os
try:
    import psycopg2
    from psycopg2 import extras
except ImportError:
    psycopg2 = None
    extras = None
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db():
    if not psycopg2:
        raise Exception("Database driver (psycopg2) failed to load. This usually means a dependency issue on the server. Try using 'psycopg2-binary' in requirements.txt.")
        
    if not DATABASE_URL:
        raise Exception("DATABASE_URL environment variable is missing. Please add it to your Vercel/Environment settings.")
        
    # Supabase/PostgreSQL requires SSL mode usually
    if "sslmode" not in DATABASE_URL:
        # Append sslmode if not present in the URL
        separator = "&" if "?" in DATABASE_URL else "?"
        conn = psycopg2.connect(f"{DATABASE_URL}{separator}sslmode=require")
    else:
        conn = psycopg2.connect(DATABASE_URL)
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS matches (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            team_a TEXT,
            team_b TEXT,
            score_data TEXT,
            result TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    conn.commit()
    conn.close()
