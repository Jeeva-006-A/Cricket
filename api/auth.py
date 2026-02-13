import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt

# Fix for passlib/bcrypt compatibility issue
import bcrypt
if not hasattr(bcrypt, "__about__"):
    class Dummy: pass
    bcrypt.__about__ = Dummy()
    bcrypt.__about__.__version__ = bcrypt.__version__

from passlib.context import CryptContext
from fastapi import HTTPException, Header, Depends
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET", "crick_score_pro_secret_key_123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    # Bcrypt has a 72-byte limit
    return pwd_context.verify(plain_password[:72], hashed_password)

def get_password_hash(password):
    # Bcrypt has a 72-byte limit
    return pwd_context.hash(password[:72])

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=403, detail="No token provided")
    try:
        payload = jwt.decode(authorization, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Unauthorized")
