from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.agents.base import BaseAgent
from app.schemas.rules import RuleFilter, RuleParseRequest, RulePreviewResponse
from app.services.llm_service import LLMService
from app.models.article import Article
from app.core.logging import logger

# Tier classifications for prominent news domains
KNOWN_DOMAIN_TIERS: Dict[str, str] = {
    "reuters.com": "tier1",
    "bloomberg.com": "tier1",
    "wsj.com": "tier1",
    "ft.com": "tier1",
    "economist.com": "tier1",
    "nytimes.com": "tier1",
    "bbc.com": "tier1",
    "techcrunch.com": "tier2",
    "venturebeat.com": "tier2",
    "forbes.com": "tier2",
    "wired.com": "tier2",
    "techwire.io": "tier2",
    "fintechdaily.live": "tier3",
}

REGION_KEYWORDS: Dict[str, List[str]] = {
    "India": ["india", "delhi", "mumbai", "bengaluru", "bangalore", "rbi", "sebi"],
    "APAC": ["apac", "asia", "singapore", "tokyo", "seoul", "indonesia", "malaysia", "vietnam", "thailand", "india"],
    "US": ["us", "united states", "america", "washington", "new york", "california", "sec", "fed"],
    "Europe": ["europe", "european", "uk", "london", "brussels", "germany", "france", "ecb"],
}


class RuleEngineAgent(BaseAgent[RuleFilter, RulePreviewResponse]):
    name = "RuleEngineAgent"

    async def parse_natural_language(self, request: RuleParseRequest) -> RuleFilter:
        """
        Parses analyst natural-language queries into structured RuleFilters using LLM.
        """
        prompt = f"""
        Convert the following media monitoring business rule from natural language into a strict JSON structured filter for client '{request.client_id}':

        Rule: \"{request.natural_language_rule}\"

        Return JSON matching this schema:
        - geography: list of countries/regions mentioned (e.g. ["India", "APAC", "US", "Europe"])
        - domain_tiers: list of allowed tiers from ["tier1", "tier2", "tier3"]. If 'top-tier' or 'major sources', use ["tier1"]. If unspecified, leave empty or [].
        - recency_hours: integer of recency window in hours (e.g. 24 for last 24h, 168 for last 7 days, 48 for last 2 days), or null.
        - mandatory_terms: list of lowercase keyword strings that MUST appear in the article
        - excluded_terms: list of lowercase keyword strings that must NOT appear in the article
        """
        system_instruction = "You are a Natural Language Rule Compiler converting English instructions into structured JSON query filters."
        data = await LLMService.generate_json(prompt, system_instruction=system_instruction)

        # Sanitize domain tiers to valid Literals
        raw_tiers = data.get("domain_tiers", [])
        clean_tiers = [t for t in raw_tiers if t in ["tier1", "tier2", "tier3"]]

        return RuleFilter(
            client_id=request.client_id,
            geography=data.get("geography", []),
            domain_tiers=clean_tiers,
            recency_hours=data.get("recency_hours"),
            mandatory_terms=[t.lower().strip() for t in data.get("mandatory_terms", [])],
            excluded_terms=[t.lower().strip() for t in data.get("excluded_terms", [])]
        )

    def evaluate_article(self, article: Article, rule_filter: RuleFilter) -> bool:
        """
        Evaluates a single article against the structured business rule filter.
        """
        text_corpus = f"{article.title} {article.body_text}".lower()

        # 1. Recency check
        if rule_filter.recency_hours and article.published_at:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=rule_filter.recency_hours)
            pub_at = article.published_at
            if pub_at.tzinfo is None:
                pub_at = pub_at.replace(tzinfo=timezone.utc)
            if pub_at < cutoff:
                return False

        # 2. Domain Tier check
        if rule_filter.domain_tiers:
            article_tier = KNOWN_DOMAIN_TIERS.get(article.domain, "tier2")
            if article_tier not in rule_filter.domain_tiers:
                return False

        # 3. Mandatory terms check (ALL mandatory terms must be present)
        for term in rule_filter.mandatory_terms:
            if term not in text_corpus:
                return False

        # 4. Excluded terms check (NONE may be present)
        for term in rule_filter.excluded_terms:
            if term in text_corpus:
                return False

        # 5. Geography check
        if rule_filter.geography:
            geo_matched = False
            for geo in rule_filter.geography:
                keywords = REGION_KEYWORDS.get(geo, [geo.lower()])
                if any(kw in text_corpus for kw in keywords):
                    geo_matched = True
                    break
            if not geo_matched:
                return False

        return True

    async def preview_rule(self, rule_filter: RuleFilter, db: AsyncSession) -> RulePreviewResponse:
        """
        Executes filter against ingested articles in DB and returns match count and sample titles.
        """
        stmt = select(Article)
        articles = (await db.execute(stmt)).scalars().all()

        matched_articles = [a for a in articles if self.evaluate_article(a, rule_filter)]
        sample_titles = [a.title for a in matched_articles[:5]]

        logger.info(
            "Rule preview executed",
            client_id=rule_filter.client_id,
            total_articles=len(articles),
            matched=len(matched_articles),
            mandatory_terms=rule_filter.mandatory_terms,
            domain_tiers=rule_filter.domain_tiers
        )

        return RulePreviewResponse(
            matched_article_count=len(matched_articles),
            sample_matches=sample_titles
        )

    async def process(
        self,
        input_data: RuleFilter,
        db: Optional[AsyncSession] = None
    ) -> RulePreviewResponse:
        if db is None:
            return RulePreviewResponse(matched_article_count=0, sample_matches=[])
        return await self.preview_rule(input_data, db=db)
