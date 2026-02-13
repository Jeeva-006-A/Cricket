import os
import json
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import uvicorn

from database import get_db, init_db
from auth import create_access_token, get_current_user, verify_password, get_password_hash
from schemas import UserAuth, MatchData

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
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, username, password FROM users WHERE username = %s", (user.username,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        # Manually map columns if we are not using RealDictCursor
        # row structure based on query: [id, username, password]
        db_user = {"id": row[0], "username": row[1], "password": row[2]}
        
        if not verify_password(user.password, db_user["password"]):
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
    cursor = conn.cursor()
    try:
        # Explicitly list columns to make manual mapping easier
        cursor.execute("SELECT id, team_a, team_b, score_data, result, created_at FROM matches WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
        rows = cursor.fetchall()
        
        matches = []
        for row in rows:
            # Map columns manually: [id, team_a, team_b, score_data, result, created_at]
            match_item = {
                "id": row[0],
                "team_a": row[1],
                "team_b": row[2],
                "score_data": json.loads(row[3]) if isinstance(row[3], str) else row[3],
                "result": row[4],
                "created_at": row[5].isoformat() if hasattr(row[5], "isoformat") else row[5]
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
