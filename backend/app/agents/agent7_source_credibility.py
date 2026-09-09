from datetime import datetime, timezone
from typing import Optional, List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.agents.base import BaseAgent
from app.schemas.credibility import CredibilityInput, CredibilityOutput, CredibilityOverride
from app.models.source import DomainCredibility
from app.models.article import Article
from app.core.logging import logger

# Baseline authority scores for top domains
BASE_AUTHORITY = {
    "reuters.com": 0.96,
    "bloomberg.com": 0.95,
    "wsj.com": 0.94,
    "ft.com": 0.93,
    "bbc.com": 0.92,
    "nytimes.com": 0.91,
    "techcrunch.com": 0.82,
    "venturebeat.com": 0.80,
    "forbes.com": 0.78,
    "wired.com": 0.79,
    "techwire.io": 0.74,
}


class SourceCredibilityAgent(BaseAgent[CredibilityInput, CredibilityOutput]):
    name = "SourceCredibilityAgent"

    async def calculate_credibility(self, domain: str, db: Optional[AsyncSession] = None) -> CredibilityOutput:
        norm_domain = domain.lower().strip()
        if norm_domain.startswith("www."):
            norm_domain = norm_domain[4:]

        # 1. Check if domain has a persisted record in DomainCredibility table
        if db is not None:
            stmt = select(DomainCredibility).where(DomainCredibility.domain == norm_domain)
            record = (await db.execute(stmt)).scalar_one_or_none()

            if record and record.manually_overridden:
                # Honor manual analyst override!
                return CredibilityOutput(
                    domain=record.domain,
                    credibility_score=record.credibility_score,
                    tier=record.tier, # type: ignore
                    signals_used=record.signals_used or ["Analyst manual trust override"],
                    manually_overridden=True
                )

        # 2. Algorithmic credibility computation
        signals = []
        score = 0.50  # Baseline neutral

        # Signal A: Known editorial authority
        if norm_domain in BASE_AUTHORITY:
            score = BASE_AUTHORITY[norm_domain]
            signals.append(f"Recognized international editorial institution (base: {score})")
        else:
            # TLD and structure heuristic
            if norm_domain.endswith(".gov") or norm_domain.endswith(".edu"):
                score += 0.35
                signals.append("Institutional educational or governmental TLD (.edu/.gov)")
            elif norm_domain.endswith(".org"):
                score += 0.15
                signals.append("Non-profit / organizational TLD (.org)")
            elif any(norm_domain.endswith(tld) for tld in [".xyz", ".biz", ".click", ".top", ".buzz"]):
                score -= 0.25
                signals.append("Low-barrier commercial TLD with elevated spam prevalence")

        # Signal B: Publication frequency and volume in database
        if db is not None:
            article_count_stmt = select(func.count(Article.id)).where(Article.domain == norm_domain)
            count = (await db.execute(article_count_stmt)).scalar() or 0
            if count >= 10:
                score += 0.10
                signals.append(f"High historical publication frequency ({count} indexed articles)")
            elif count >= 3:
                score += 0.05
                signals.append(f"Established reporting frequency ({count} indexed articles)")
            else:
                signals.append("Sparse publishing history (<3 articles in corpus)")

        # Clamp score between 0.05 and 0.99
        final_score = max(0.05, min(0.99, round(score, 2)))

        # Tier classification
        if final_score >= 0.85:
            tier = "tier1"
        elif final_score >= 0.60:
            tier = "tier2"
        else:
            tier = "tier3"

        # Persist or update
        if db is not None:
            if record:
                record.credibility_score = final_score
                record.tier = tier
                record.signals_used = signals
                record.last_updated = datetime.now(timezone.utc)
            else:
                new_record = DomainCredibility(
                    domain=norm_domain,
                    credibility_score=final_score,
                    tier=tier,
                    signals_used=signals,
                    manually_overridden=False
                )
                db.add(new_record)
            await db.commit()

        return CredibilityOutput(
            domain=norm_domain,
            credibility_score=final_score,
            tier=tier,
            signals_used=signals,
            manually_overridden=False
        )

    async def override_credibility(
        self,
        override: CredibilityOverride,
        db: AsyncSession
    ) -> CredibilityOutput:
        """
        Analyst manual override that locks the credibility tier.
        """
        stmt = select(DomainCredibility).where(DomainCredibility.domain == override.domain)
        record = (await db.execute(stmt)).scalar_one_or_none()

        signals = [f"Manual override by analyst to {override.tier} with score {override.credibility_score}"]

        if record:
            record.credibility_score = override.credibility_score
            record.tier = override.tier
            record.manually_overridden = True
            record.signals_used = signals
            record.last_updated = datetime.now(timezone.utc)
        else:
            record = DomainCredibility(
                domain=override.domain,
                credibility_score=override.credibility_score,
                tier=override.tier,
                signals_used=signals,
                manually_overridden=True
            )
            db.add(record)

        await db.commit()
        await db.refresh(record)

        return CredibilityOutput(
            domain=record.domain,
            credibility_score=record.credibility_score,
            tier=record.tier, # type: ignore
            signals_used=signals,
            manually_overridden=True
        )

    async def process(
        self,
        input_data: CredibilityInput,
        db: Optional[AsyncSession] = None
    ) -> CredibilityOutput:
        return await self.calculate_credibility(input_data.domain, db=db)
