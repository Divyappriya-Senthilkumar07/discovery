from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ClientProfileInput(BaseModel):
    client_name: str
    seed_description: Optional[str] = None
    seed_url: Optional[str] = None


class ClientProfileOutput(BaseModel):
    client_id: str
    aliases: List[str] = Field(default_factory=list)
    parent_company: Optional[str] = None
    subsidiaries: List[str] = Field(default_factory=list)
    key_executives: List[str] = Field(default_factory=list)
    industry_terms: List[str] = Field(default_factory=list)
    generated_at: datetime
    last_edited_by: Optional[str] = None


class ClientProfileUpdate(BaseModel):
    aliases: Optional[List[str]] = None
    parent_company: Optional[str] = None
    subsidiaries: Optional[List[str]] = None
    key_executives: Optional[List[str]] = None
    industry_terms: Optional[List[str]] = None
