import os
import sys
import sqlite3
# Adjust path to include current directory
sys.path.append(os.getcwd())

try:
    from db import get_db
except ImportError:
    # Try relative import if running from parent
    sys.path.append(os.path.join(os.getcwd(), 'backend'))
    from backend.db import get_db

def test_connection():
    print("--- Testing SQLite Fallback ---")
    # Ensure no DATABASE_URL
    original_url = os.environ.get("DATABASE_URL")
    if original_url:
        del os.environ["DATABASE_URL"]
    
    try:
        with get_db() as conn:
            print(f"Is Postgres: {conn.is_postgres}")
            c = conn.cursor()
            c.execute("SELECT 1")
            row = c.fetchone()
            print(f"Select Result: {list(row) if row else 'None'}")
            
            # Test text replacement logic (dry run)
            sql = "SELECT * FROM users WHERE id = ?"
            configured_sql = sql.replace('?', '%s')
            print(f"Query transformation check: '{sql}' -> '{configured_sql}'")
            
    except Exception as e:
        print(f"SQLite Test Failed: {e}")
        import traceback
        traceback.print_exc()

    print("\n--- Testing Postgres Config (Dry Run) ---")
    # We can't actually connect without a URL, but we can check if the object *tries* to be postgres
    os.environ["DATABASE_URL"] = "postgresql://user:pass@localhost/dbname"
    
    try:
        db = get_db()
        print(f"Is Postgres: {db.is_postgres}")
        print("Initialized DB object successfully (connection happens on __enter__)")
    except Exception as e:
        print(f"Postgres Init Failed: {e}")

    # Restore
    if original_url:
        os.environ["DATABASE_URL"] = original_url
    else:
        if "DATABASE_URL" in os.environ:
             del os.environ["DATABASE_URL"]

if __name__ == "__main__":
    test_connection()
