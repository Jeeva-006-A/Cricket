from pydantic import BaseModel

class UserAuth(BaseModel):
    username: str
    password: str

class MatchData(BaseModel):
    teamA: str
    teamB: str
    scoreData: dict
    result: str
