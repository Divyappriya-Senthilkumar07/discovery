from typing import Literal, Optional
from pydantic import BaseModel


class SourceDiscoveryInput(BaseModel):
    client_id: str
    article_id: Optional[str] = None


class SourceDiscoveryOutput(BaseModel):
    proposed_domain: str
    example_article_url: str
    matched_client_id: str
    reason: str
    status: Literal["pending_review", "approved", "rejected"] = "pending_review"


class SourceStatusUpdate(BaseModel):
    status: Literal["approved", "rejected"]
