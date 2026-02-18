from pydantic import BaseModel

class UserAuth(BaseModel):
    name: str | None = None
    email: str
    password: str
    username: str | None = None

from typing import Any

class MatchData(BaseModel):
    teamA: str
    teamB: str
    scoreData: Any
    result: str
    match_code: str | None = None
