import os
import sys
import json

# Add current directory to sys.path for Vercel
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import uvicorn

try:
    import database
    from database import get_db, init_db
except ImportError:
    from .database import get_db, init_db

try:
    import auth
    from auth import create_access_token, get_current_user, verify_password, get_password_hash
except ImportError:
    from .auth import create_access_token, get_current_user, verify_password, get_password_hash

try:
    import schemas
    from schemas import UserAuth, MatchData
except ImportError:
    from .schemas import UserAuth, MatchData

app = FastAPI(title="CricScore Pro API")

# Setup database
try:
    if os.getenv("DATABASE_URL"):
        init_db()
except Exception as e:
    print(f"DB Init Error: {e}")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom error handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body)},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": str(type(exc).__name__)},
    )

# API Routes
@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.post("/api/signup")
async def signup(user: UserAuth):
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Use email as default username if not provided
        uname = user.username or user.email
        hashed_password = get_password_hash(user.password)
        
        # Check if email already exists
        cursor.execute("SELECT id FROM users WHERE email = %s", (user.email,))
        if cursor.fetchone():
             raise HTTPException(status_code=400, detail="Email already registered")

        cursor.execute(
            "INSERT INTO users (name, email, username, password) VALUES (%s, %s, %s, %s)", 
            (user.name, user.email, uname, hashed_password)
        )
        conn.commit()
        return {"message": "User created successfully"}
    except Exception as e:
        if "unique constraint" in str(e).lower():
            if "users_email_key" in str(e).lower():
                 raise HTTPException(status_code=400, detail="Email already registered")
            raise HTTPException(status_code=400, detail="Username/Email already exists")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/login")
async def login(user: UserAuth):
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Login with email
        cursor.execute("SELECT id, name, email, password FROM users WHERE email = %s", (user.email,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        db_user = {"id": row[0], "name": row[1], "email": row[2], "password": row[3]}
        
        if not verify_password(user.password, db_user["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Use name or email as display name in token
        display_name = db_user["name"] or db_user["email"]
        token = create_access_token({"id": db_user["id"], "username": display_name})
        return {"token": token, "username": display_name}
    finally:
        conn.close()

import random
import string

def generate_match_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@app.post("/api/matches")
async def save_match(match: MatchData, user_id: int = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Generate code if not provided
        m_code = match.match_code or generate_match_code()
        
        cursor.execute(
            "INSERT INTO matches (user_id, team_a, team_b, score_data, result, match_code) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id, match_code",
            (user_id, match.teamA, match.teamB, json.dumps(match.scoreData), match.result, m_code)
        )
        row = cursor.fetchone()
        match_id = row[0]
        match_code = row[1]
        conn.commit()
        return {"id": match_id, "match_code": match_code}
    finally:
        conn.close()

@app.put("/api/matches/{match_id}")
async def update_match(match_id: int, match: MatchData, user_id: int = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE matches SET score_data = %s, result = %s WHERE id = %s AND user_id = %s",
            (json.dumps(match.scoreData), match.result, match_id, user_id)
        )
        conn.commit()
        return {"status": "updated"}
    finally:
        conn.close()

@app.get("/api/matches/code/{match_code}")
async def get_match_by_code(match_code: str):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, team_a, team_b, score_data, result, created_at, match_code FROM matches WHERE match_code = %s", (match_code.upper(),))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Match not found")
        
        return {
            "id": row[0],
            "team_a": row[1],
            "team_b": row[2],
            "score_data": json.loads(row[3]) if isinstance(row[3], str) else row[3],
            "result": row[4],
            "created_at": row[5].isoformat() if hasattr(row[5], "isoformat") else row[5],
            "match_code": row[6]
        }
    finally:
        conn.close()

@app.get("/api/matches")
async def get_matches(user_id: int = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Explicitly list columns to make manual mapping easier
        cursor.execute("SELECT id, team_a, team_b, score_data, result, created_at, match_code FROM matches WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
        rows = cursor.fetchall()
        
        matches = []
        for row in rows:
            # Map columns manually: [id, team_a, team_b, score_data, result, created_at, match_code]
            match_item = {
                "id": row[0],
                "team_a": row[1],
                "team_b": row[2],
                "score_data": json.loads(row[3]) if isinstance(row[3], str) else row[3],
                "result": row[4],
                "created_at": row[5].isoformat() if hasattr(row[5], "isoformat") else row[5],
                "match_code": row[6]
            }
            matches.append(match_item)
        return matches
    finally:
        conn.close()

# Static Files serving for local development
# Mount this LAST so it doesn't stay in the way of /api routes
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
