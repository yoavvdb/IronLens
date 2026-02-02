import os
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor

class ConfiguredCursor:
    def __init__(self, cursor, is_postgres):
        self.cursor = cursor
        self.is_postgres = is_postgres

    def execute(self, sql, params=None):
        if self.is_postgres:
            # Replace ? with %s
            sql = sql.replace('?', '%s')
        
        try:
            if params is None:
                return self.cursor.execute(sql)
            return self.cursor.execute(sql, params)
        except Exception as e:
            # Re-raise to let caller handle, or log?
            raise e

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()
            
    def __getattr__(self, name):
        return getattr(self.cursor, name)

class DBConnection:
    def __init__(self):
        self.db_url = os.getenv("DATABASE_URL")
        # Only treat as Postgres if it explicitly looks like a connection string
        self.is_postgres = self.db_url and self.db_url.startswith(("postgres://", "postgresql://"))
        self.conn = None

    def __enter__(self):
        if self.is_postgres:
            self.conn = psycopg2.connect(self.db_url)
        else:
            self.conn = sqlite3.connect(os.getenv("DATABASE_FILE", "ironlens.db"))
            self.conn.row_factory = sqlite3.Row
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            if exc_type:
                self.conn.rollback()
            else:
                self.conn.commit()
            self.conn.close()

    def cursor(self):
        # Use RealDictCursor for Postgres to match sqlite3.Row's key access
        if self.is_postgres:
            c = self.conn.cursor(cursor_factory=RealDictCursor) 
        else:
            c = self.conn.cursor()
        return ConfiguredCursor(c, self.is_postgres)

def get_db():
    return DBConnection()
