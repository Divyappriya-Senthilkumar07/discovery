from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class ExtractionInput(BaseModel):
    source_url: str
    source_type: Literal["rss", "manual", "api"]
    # Optional raw content override for deterministic testing / mock feeds
    raw_content: Optional[str] = None


class ExtractionOutput(BaseModel):
    article_id: str
    title: str
    body_text: str
    author: Optional[str] = None
    published_at: Optional[datetime] = None
    domain: str
    extraction_method: Literal["rss", "static_html", "headless_browser"]
    status: Literal["success", "degraded", "failed"]
