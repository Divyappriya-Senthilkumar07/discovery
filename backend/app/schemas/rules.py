from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class RuleFilter(BaseModel):
    client_id: str
    geography: List[str] = Field(default_factory=list)
    domain_tiers: List[Literal["tier1", "tier2", "tier3"]] = Field(default_factory=list)
    recency_hours: Optional[int] = None
    mandatory_terms: List[str] = Field(default_factory=list)
    excluded_terms: List[str] = Field(default_factory=list)


class RuleParseRequest(BaseModel):
    client_id: str
    natural_language_rule: str


class RulePreviewResponse(BaseModel):
    matched_article_count: int
    sample_matches: List[str] = Field(default_factory=list)


class RuleSaveRequest(BaseModel):
    client_id: str
    name: str = "Client Rule"
    natural_language_text: Optional[str] = None
    filter_data: RuleFilter
