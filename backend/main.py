import os
import json
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from psycopg2 import extras
import uvicorn

from database import get_db, init_db
from auth import create_access_token, get_current_user, verify_password, get_password_hash
from schemas import UserAuth, MatchData

app = FastAPI(title="CricScore Pro API")

# Setup database
init_db()

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

# API Routes
@app.post("/api/signup")
async def signup(user: UserAuth):
    conn = get_db()
    cursor = conn.cursor()
    try:
        hashed_password = get_password_hash(user.password)
        cursor.execute("INSERT INTO users (username, password) VALUES (%s, %s)", (user.username, hashed_password))
        conn.commit()
        return {"message": "User created successfully"}
    except Exception as e:
        if "unique constraint" in str(e).lower():
            raise HTTPException(status_code=400, detail="Username already exists")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/login")
async def login(user: UserAuth):
    conn = get_db()
    cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
    try:
        cursor.execute("SELECT * FROM users WHERE username = %s", (user.username,))
        db_user = cursor.fetchone()
        if not db_user or not verify_password(user.password, db_user["password"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        token = create_access_token({"id": db_user["id"], "username": db_user["username"]})
        return {"token": token, "username": db_user["username"]}
    finally:
        conn.close()

@app.post("/api/matches")
async def save_match(match: MatchData, user_id: int = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO matches (user_id, team_a, team_b, score_data, result) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (user_id, match.teamA, match.teamB, json.dumps(match.scoreData), match.result)
        )
        match_id = cursor.fetchone()[0]
        conn.commit()
        return {"id": match_id}
    finally:
        conn.close()

@app.get("/api/matches")
async def get_matches(user_id: int = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
    try:
        cursor.execute("SELECT * FROM matches WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
        rows = cursor.fetchall()
        
        matches = []
        for row in rows:
            matches.append({
                "id": row["id"],
                "team_a": row["team_a"],
                "team_b": row["team_b"],
                "score_data": json.loads(row["score_data"]) if isinstance(row["score_data"], str) else row["score_data"],
                "result": row["result"],
                "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else row["created_at"]
            })
        return matches
    finally:
        conn.close()

# Static Files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "LHF_Front_end")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
