from pydantic import BaseModel

class UserAuth(BaseModel):
    username: str
    password: str

from typing import Any

class MatchData(BaseModel):
    teamA: str
    teamB: str
    scoreData: Any
    result: str
