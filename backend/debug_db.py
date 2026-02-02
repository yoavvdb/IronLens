import sqlite3
import json

DB_NAME = "ironlens.db"

def check_db():
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        print("--- Users ---")
        c.execute("SELECT * FROM users")
        users = c.fetchall()
        for u in users:
            print(dict(u))
            
        print("\n--- Programming ---")
        c.execute("SELECT * FROM programming")
        prog = c.fetchall()
        for p in prog:
            print(dict(p))
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
