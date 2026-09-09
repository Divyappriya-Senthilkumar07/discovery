from typing import Literal
from pydantic import BaseModel, Field
from app.schemas.client_profile import ClientProfileOutput


class ValidationInput(BaseModel):
    article_id: str
    client_id: str
    article_text: str
    client_context: ClientProfileOutput


class ValidationOutput(BaseModel):
    article_id: str
    verdict: Literal["relevant", "not_relevant", "needs_review"]
    confidence: float
    explanation: str
