from datetime import datetime
from typing import List
from pydantic import BaseModel, Field


class BriefEntry(BaseModel):
    story_cluster_id: str
    representative_headline: str
    summary: str
    contributing_sources: List[str] = Field(default_factory=list)
    outlier_articles: List[str] = Field(default_factory=list)
    client_id: str
    generated_at: datetime


class BriefGenerateRequest(BaseModel):
    client_id: str
    article_ids: List[str] = Field(default_factory=list)
