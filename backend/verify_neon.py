import os
import sys
import psycopg2

def verify_neon():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not set")
        return

    print(f"Testing connection to: {db_url.split('@')[1]}") # Print only host part for security
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        print(f"✅ Success! Connected to: {version}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    verify_neon()
