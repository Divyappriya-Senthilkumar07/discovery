from typing import Literal, List
from pydantic import BaseModel, Field


class CredibilityInput(BaseModel):
    domain: str


class CredibilityOutput(BaseModel):
    domain: str
    credibility_score: float
    tier: Literal["tier1", "tier2", "tier3"]
    signals_used: List[str] = Field(default_factory=list)
    manually_overridden: bool = False


class CredibilityOverride(BaseModel):
    domain: str
    tier: Literal["tier1", "tier2", "tier3"]
    credibility_score: float
