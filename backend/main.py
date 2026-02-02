from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Query, Body, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
import json
import sqlite3
import mediapipe as mp
import cv2
import numpy as np
from datetime import datetime, date
from uuid import uuid4
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
try:
    from .db import get_db, DBConnection
    from . import db
except ImportError:
    from db import get_db, DBConnection
    import db

load_dotenv()

app = FastAPI()

# --- Configuration ---
# Use /tmp for uploads in ephemeral cloud filesystems if needed, or mount a volume
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
THUMB_DIR = os.path.join(UPLOAD_DIR, "thumbnails")
# DATABASE_URL handled in db.py
BASE_URL = os.getenv("RENDER_EXTERNAL_URL") or os.getenv("BASE_URL", "http://127.0.0.1:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ALLOWED_USERS = os.getenv("ALLOWED_USERS", "") # Comma-separated emails

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(THUMB_DIR, exist_ok=True)

def is_allowed(email: str) -> bool:
    if not ALLOWED_USERS:
        return True # Default open if not configured
    allowed = [e.strip().lower() for e in ALLOWED_USERS.split(",") if e.strip()]
    return email.lower() in allowed


# --- Middleware ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
    "https://iron-qlk6ru8op-yoavvdbs-projects.vercel.app",
]
if FRONTEND_URL:
    origins.append(FRONTEND_URL.rstrip("/"))
# Add wildcard for preview environments if strictly necessary (be careful in prod)
# origins.append("https://*.vercel.app") 

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Static Files ---
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- Database Setup ---
def init_db():
    with get_db() as conn:
        c = conn.cursor()
        
        # Logs
        c.execute('''
            CREATE TABLE IF NOT EXISTS logs (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                title TEXT NOT NULL,
                result_score TEXT NOT NULL,
                video_filename TEXT NOT NULL,
                thumbnail_filename TEXT, 
                user_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    
        # Users
        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                avatar_url TEXT,
                access_code TEXT,
                followed_coach_id TEXT
            )
        ''')
        
        # Programming
        c.execute('''
            CREATE TABLE IF NOT EXISTS programming (
                date TEXT NOT NULL,
                coach_id TEXT NOT NULL,
                content JSON NOT NULL,
                PRIMARY KEY (date, coach_id)
            )
        ''')
        
        # Kudos
        c.execute('''
            CREATE TABLE IF NOT EXISTS kudos (
                log_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                PRIMARY KEY (log_id, user_id)
            )
        ''')
        
        # Comments
        c.execute('''
            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                log_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                text TEXT NOT NULL,
                is_coach_feedback BOOLEAN DEFAULT FALSE,
                image_filename TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    
    
        # Notifications
        c.execute('''
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL, -- Recipient
                sender_id TEXT NOT NULL,
                type TEXT NOT NULL, -- 'kudos', 'comment'
                message TEXT NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Seed Data
        c.execute("SELECT count(*) as count FROM users")
        row = c.fetchone()
        # Handle both dict (Postgres) and sqlite3.Row access
        count = row['count'] if row else 0
        
        if count == 0:
            c.execute("INSERT INTO users (id, name, email, password, role, avatar_url) VALUES (?, ?, ?, ?, ?, ?)", 
                      ("user_coach", "Coach Mike", "mike@gym.com", "password", "coach", "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike"))
            c.execute("INSERT INTO users (id, name, email, password, role, avatar_url) VALUES (?, ?, ?, ?, ?, ?)", 
                      ("user_athlete", "Demo Athlete", "demo@gym.com", "password", "athlete", "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"))
            print("Seeded default users.")

init_db()


# --- Helper Functions ---
def generate_thumbnail(video_path: str, filename: str) -> str:
    """Generates a thumbnail for the video and returns the filename."""
    try:
        cap = cv2.VideoCapture(video_path)
        success, frame = cap.read()
        if success:
            thumb_filename = f"thumb_{filename}.jpg"
            thumb_path = os.path.join(THUMB_DIR, thumb_filename)
            # Resize for optimization (optional, keep simple for now)
            cv2.imwrite(thumb_path, frame)
            cap.release()
            return f"thumbnails/{thumb_filename}"
        cap.release()
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
    return ""

def create_notification_internal(c: sqlite3.Cursor, user_id: str, sender_id: str, type: str, message: str):
    """Internal helper to add notification using existing cursor."""
    if user_id == sender_id:
        return
    c.execute(
        "INSERT INTO notifications (id, user_id, sender_id, type, message) VALUES (?, ?, ?, ?, ?)",
        (str(uuid4()), user_id, sender_id, type, message)
    )

# --- Models ---
# ... (Models unchanged) ...

class UserLogin(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    role: str = "athlete" 

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    avatar_url: str
    access_code: Optional[str] = None
    followed_coach_id: Optional[str] = None

class UserUpdate(BaseModel):
    access_code: Optional[str] = None
    followed_coach_id: Optional[str] = None

class ProgrammingSet(BaseModel):
    id: str
    type: str = "working" # working, warmup, note, movement
    reps: Optional[str] = None
    weight: Optional[str] = None
    text: Optional[str] = None # For notes or metcon movements

class ProgrammingBlock(BaseModel):
    id: str
    name: str
    type: str = "strength" # strength, metcon
    metcon_type: Optional[str] = None # AMRAP, EMOM, For Time
    metcon_duration: Optional[str] = None
    description: Optional[str] = None # For simplified text-based workouts
    data: List[ProgrammingSet]

class ProgrammingUpdate(BaseModel):
    date: str
    coach_id: str
    blocks: List[ProgrammingBlock]

class Comment(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_role: str
    user_avatar: str
    text: str
    image_url: Optional[str]
    is_coach_feedback: bool
    created_at: str

class LogRecord(BaseModel):
    id: str
    date: str
    title: str
    result_score: str
    video_url: Optional[str]
    thumbnail_url: Optional[str]
    created_at: str
    user_id: str
    user_name: str 
    user_avatar: str 
    kudos_count: int
    comments: List[Comment]

class CommentCreate(BaseModel):
    user_id: str
    text: str
    is_coach_feedback: bool = False

class KudosToggle(BaseModel):
    user_id: str

class Notification(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    sender_avatar: str
    type: str
    message: str
    is_read: bool
    created_at: str

class MarkRead(BaseModel):
    notification_ids: List[str]

# --- Endpoints ---

@app.post("/register", response_model=UserResponse)
@app.post("/register", response_model=UserResponse)
def register(user: UserRegister):
    if not is_allowed(user.email):
        raise HTTPException(status_code=403, detail="Access denied. Email not in allowlist.")
        
    with get_db() as conn:
        c = conn.cursor()
        
        user_id = str(uuid4())
        avatar = f"https://api.dicebear.com/7.x/avataaars/svg?seed={user.name}"
        
        try:
            c.execute(
                "INSERT INTO users (id, name, email, password, role, avatar_url) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, user.name, user.email, user.password, user.role, avatar)
            )
        except Exception: # Catch both sqlite3 and postgres integrity errors
            raise HTTPException(status_code=400, detail="Email already exists")
    
    return {
        "id": user_id, "name": user.name, "email": user.email, 
        "role": user.role, "avatar_url": avatar,
        "access_code": None, "followed_coach_id": None
    }

@app.post("/login", response_model=UserResponse)
@app.post("/login", response_model=UserResponse)
def login(creds: UserLogin):
    if not is_allowed(creds.email):
        raise HTTPException(status_code=403, detail="Access denied. Email not in allowlist.")

    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE email = ? AND password = ?", (creds.email, creds.password))
        row = c.fetchone()
    
    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return dict(row)

@app.get("/programming", response_model=List[ProgrammingBlock])
def get_programming(date: str = Query(..., description="Date in YYYY-MM-DD"), coach_id: str = "user_coach"):
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT content FROM programming WHERE date = ? AND coach_id = ?", (date, coach_id))
        row = c.fetchone()
    
    if row:
        content = row['content']
        if isinstance(content, str):
            return json.loads(content)
        return content
    return [] 

@app.post("/programming")
def save_programming(data: ProgrammingUpdate):
    with get_db() as conn:
        c = conn.cursor()
        content_json = json.dumps([item.dict() for item in data.blocks])
        # Note: UPSERT syntax differs between Postgres and SQLite.
        # SQLite: INSERT OR REPLACE
        # Postgres: INSERT ... ON CONFLICT ... DO UPDATE
        # For simplicity in this migration, let's just DELETE then INSERT 
        # (Assuming low concurrency for this specific endpoint)
        c.execute("DELETE FROM programming WHERE date = ? AND coach_id = ?", (data.date, data.coach_id))
        c.execute(
            "INSERT INTO programming (date, coach_id, content) VALUES (?, ?, ?)",
            (data.date, data.coach_id, content_json)
        )
    return {"status": "success"}

@app.get("/users")
def get_users(role: Optional[str] = None, query: Optional[str] = None):
    with get_db() as conn:
        c = conn.cursor()
        
        sql = "SELECT id, name, email, role, avatar_url, access_code, followed_coach_id FROM users WHERE 1=1"
        params = []
        
        if role:
            sql += " AND role = ?"
            params.append(role)
        if query:
            sql += " AND name LIKE ?"
            params.append(f"%{query}%")
            
        c.execute(sql, params)
        rows = c.fetchall()
    return [dict(r) for r in rows]

@app.patch("/users/{user_id}")
def update_user(user_id: str, data: UserUpdate):
    with get_db() as conn:
        c = conn.cursor()
        
        if data.access_code is not None:
            c.execute("UPDATE users SET access_code = ? WHERE id = ?", (data.access_code, user_id))
        if data.followed_coach_id is not None:
            # Handle "null" case for unfollowing
            coach_val = data.followed_coach_id if data.followed_coach_id != "null" else None
            c.execute("UPDATE users SET followed_coach_id = ? WHERE id = ?", (coach_val, user_id))
        
    return {"status": "success"}

@app.get("/logs", response_model=List[LogRecord])
@app.get("/logs", response_model=List[LogRecord])
def get_logs(date: str = Query(..., description="Date in YYYY-MM-DD format"), coach_id: Optional[str] = None):
    with get_db() as conn:
        c = conn.cursor()
        
        # Ensure column exists if migration didn't run via init (double check)
        try:
            c.execute("SELECT thumbnail_filename FROM logs LIMIT 1")
        except:
            # ALTER TABLE is consistent
            c.execute("ALTER TABLE logs ADD COLUMN thumbnail_filename TEXT")
            # If using transaction, this commits at end of block
    
        c.execute('''
            SELECT l.*, u.name as user_name, u.avatar_url as user_avatar
            FROM logs l
            JOIN users u ON l.user_id = u.id
            WHERE l.date = ? 
            ORDER BY l.created_at DESC
        ''', (date,))
        log_rows = c.fetchall()
        
        logs = []
        for log in log_rows:
            c.execute("SELECT COUNT(*) as count FROM kudos WHERE log_id = ?", (log["id"],))
            kudos_row = c.fetchone()
            kudos_count = kudos_row['count'] if kudos_row else 0
            
            c.execute('''
                SELECT c.*, u.name as user_name, u.role as user_role, u.avatar_url as user_avatar 
                FROM comments c 
                JOIN users u ON c.user_id = u.id 
                WHERE c.log_id = ? 
                ORDER BY c.created_at ASC
            ''', (log["id"],))
            comment_rows = c.fetchall()
            
            comments = []
            for cm in comment_rows:
                image_url = f"{BASE_URL}/uploads/{cm['image_filename']}" if cm['image_filename'] else None
                comments.append({
                    "id": cm["id"],
                    "user_id": cm["user_id"],
                    "user_name": cm["user_name"],
                    "user_role": cm["user_role"],
                    "user_avatar": cm["user_avatar"],
                    "text": cm["text"],
                    "image_url": image_url,
                    "is_coach_feedback": bool(cm["is_coach_feedback"]),
                    "created_at": str(cm["created_at"])
                })
    
            video_url = f"{BASE_URL}/uploads/{log['video_filename']}" if log['video_filename'] else None
            
            # Handle thumbnail
            thumb = log['thumbnail_filename']
            thumb_url = f"{BASE_URL}/uploads/{thumb}" if thumb else None
    
            logs.append({
                "id": log["id"],
                "date": log["date"],
                "title": log["title"],
                "result_score": log["result_score"],
                "video_url": video_url,
                "thumbnail_url": thumb_url,
                "created_at": str(log["created_at"]),
                "user_id": log["user_id"],
                "user_name": log["user_name"], 
                "user_avatar": log["user_avatar"], 
                "kudos_count": kudos_count,
                "comments": comments
            })
    
    return logs

@app.post("/analyze")
async def analyze_video(
    title: str = Form(...),
    result: str = Form(...) ,
    user_id: str = Form(...),
    file: UploadFile = File(None) 
):
    video_filename = ""
    thumbnail_filename = ""
    safe_title = "".join([c for c in title if c.isalnum() or c in " -_"]).strip() or "uncategorized"
    
    if file:
        exercise_dir = os.path.join(UPLOAD_DIR, safe_title)
        os.makedirs(exercise_dir, exist_ok=True)
        safe_filename = f"{uuid4()}_{file.filename}"
        file_path_on_disk = os.path.join(exercise_dir, safe_filename)
        video_filename = f"{safe_title}/{safe_filename}"
        
        try:
            with open(file_path_on_disk, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Generate thumbnail
            thumbnail_filename = generate_thumbnail(file_path_on_disk, safe_filename)
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not save file: {e}")

    log_id = str(uuid4())
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute(
            "INSERT INTO logs (id, date, title, result_score, video_filename, thumbnail_filename, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (log_id, today_str, title, result, video_filename, thumbnail_filename, user_id)
        )

    return {"status": "success", "log_id": log_id}

@app.put("/logs/{log_id}")
async def update_log(
    log_id: str, 
    result_score: str = Form(...),
    user_id: str = Form(...),
    file: UploadFile = File(None),
    remove_video: bool = Form(False)
):
    with get_db() as conn:
        c = conn.cursor()
        
        # Check ownership
        c.execute("SELECT user_id, video_filename, title, thumbnail_filename FROM logs WHERE id = ?", (log_id,))
        row = c.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Log not found")
            
        # Handle dict/row access
        db_user_id = row['user_id']
        current_video = row['video_filename']
        title = row['title']
        current_thumb = row['thumbnail_filename']
        
        if db_user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this log")
    
        new_video_filename = current_video
        new_thumb_filename = current_thumb
    
        if remove_video:
            new_video_filename = ""
            new_thumb_filename = ""
        
        if file:
            safe_title = "".join([c for c in title if c.isalnum() or c in " -_"]).strip() or "uncategorized"
            exercise_dir = os.path.join(UPLOAD_DIR, safe_title)
            os.makedirs(exercise_dir, exist_ok=True)
            safe_filename = f"{uuid4()}_{file.filename}"
            file_path_on_disk = os.path.join(exercise_dir, safe_filename)
            new_video_filename = f"{safe_title}/{safe_filename}"
            try:
                with open(file_path_on_disk, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                new_thumb_filename = generate_thumbnail(file_path_on_disk, safe_filename)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
    
        c.execute("UPDATE logs SET result_score = ?, video_filename = ?, thumbnail_filename = ? WHERE id = ?", (result_score, new_video_filename, new_thumb_filename, log_id))
    
    return {"status": "success"}



@app.post("/logs/{log_id}/comments")
def add_comment(
    log_id: str, 
    user_id: str = Form(...),
    text: str = Form(...),
    is_coach_feedback: bool = Form(False),
    file: UploadFile = File(None)
):
    with get_db() as conn:
        c = conn.cursor()
        
        # Check if log exists first to avoid cascade errors
        c.execute("SELECT user_id, title FROM logs WHERE id = ?", (log_id,))
        row = c.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Log not found")
        log_owner = row['user_id']
        log_title = row['title']
    
        # Get Commenter Name
        c.execute("SELECT name FROM users WHERE id = ?", (user_id,))
        user_row = c.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        commenter_name = user_row['name']
    
        image_filename = ""
        if file:
            safe_filename = f"comment_{uuid4()}_{file.filename}"
            file_path = os.path.join(UPLOAD_DIR, safe_filename)
            try:
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                image_filename = safe_filename
            except Exception as e:
                print(f"Error saving comment image: {e}")
    
        comment_id = str(uuid4())
        c.execute(
            "INSERT INTO comments (id, log_id, user_id, text, is_coach_feedback, image_filename) VALUES (?, ?, ?, ?, ?, ?)",
            (comment_id, log_id, user_id, text, is_coach_feedback, image_filename)
        )
        
        # Notify Log Owner
        create_notification_internal(c, log_owner, user_id, "comment", f"{commenter_name} commented on your {log_title}: '{text[:20]}...'")
    
    return {"status": "success", "comment_id": comment_id}

@app.post("/logs/{log_id}/kudos")
def toggle_kudos(log_id: str, action: KudosToggle):
    with get_db() as conn:
        c = conn.cursor()
        
        # Check log existence
        c.execute("SELECT user_id, title FROM logs WHERE id = ?", (log_id,))
        row = c.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Log not found")
        log_owner = row['user_id']
        log_title = row['title']
    
        c.execute("SELECT 1 FROM kudos WHERE log_id = ? AND user_id = ?", (log_id, action.user_id))
        exists = c.fetchone()
        
        status = "unchanged"
        
        if exists:
            c.execute("DELETE FROM kudos WHERE log_id = ? AND user_id = ?", (log_id, action.user_id))
            status = "removed"
        else:
            c.execute("INSERT INTO kudos (log_id, user_id) VALUES (?, ?)", (log_id, action.user_id))
            status = "added"
            
            # Notify
            c.execute("SELECT name FROM users WHERE id = ?", (action.user_id,))
            user_row = c.fetchone()
            if user_row:
                liker_name = user_row['name']
                create_notification_internal(c, log_owner, action.user_id, "kudos", f"{liker_name} liked your {log_title}")
    
    return {"status": "success", "action": status}

@app.get("/notifications", response_model=List[Notification])
def get_notifications(user_id: str = Query(...)):
    with get_db() as conn:
        c = conn.cursor()
        
        c.execute('''
            SELECT n.*, u.name as sender_name, u.avatar_url as sender_avatar
            FROM notifications n
            JOIN users u ON n.sender_id = u.id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
            LIMIT 20
        ''', (user_id,))
        rows = c.fetchall()
        
    # Manually map to ensure bool/str conversion
    notifications = []
    for r in rows:
        notifications.append({
            "id": r["id"],
            "sender_id": r["sender_id"],
            "sender_name": r["sender_name"],
            "sender_avatar": r["sender_avatar"],
            "type": r["type"],
            "message": r["message"],
            "is_read": bool(r["is_read"]),
            "created_at": str(r["created_at"])
        })
    return notifications

@app.post("/notifications/mark-read")
def mark_notifications_read(payload: MarkRead):
    with get_db() as conn:
        c = conn.cursor()
        # Inefficient but simple SQLite list handling
        for nid in payload.notification_ids:
            c.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (nid,))
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
