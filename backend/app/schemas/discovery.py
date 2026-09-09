from typing import List, Dict
from pydantic import BaseModel, Field


class DiscoveryInput(BaseModel):
    client_id: str
    top_k: int = 50
    similarity_threshold: float = 0.65


class DiscoveryOutput(BaseModel):
    candidate_article_ids: List[str] = Field(default_factory=list)
    similarity_scores: Dict[str, float] = Field(default_factory=dict)
