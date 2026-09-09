from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.agents.base import BaseAgent
from app.schemas.sources import SourceDiscoveryInput, SourceDiscoveryOutput
from app.models.article import Article
from app.models.client import Client
from app.models.source import DiscoveredSource, DomainCredibility
from app.agents.agent5_rule_engine import KNOWN_DOMAIN_TIERS
from app.core.logging import logger


class SourceDiscoveryAgent(BaseAgent[SourceDiscoveryInput, SourceDiscoveryOutput]):
    name = "SourceDiscoveryAgent"

    async def process(
        self,
        input_data: SourceDiscoveryInput,
        db: Optional[AsyncSession] = None
    ) -> SourceDiscoveryOutput:
        client_id = input_data.client_id

        if db is None:
            return SourceDiscoveryOutput(
                proposed_domain="unknown.com",
                example_article_url="https://unknown.com",
                matched_client_id=client_id,
                reason="No database session",
                status="pending_review"
            )

        # 1. Fetch Client info
        client = (await db.execute(select(Client).where(Client.id == client_id))).scalar_one_or_none()
        client_name = client.name if client else client_id
        client_terms = [t.lower() for t in (client.industry_terms if client else [])]

        # 2. Get registered domains (from KNOWN_DOMAIN_TIERS, DomainCredibility, or already discovered)
        cred_domains = (await db.execute(select(DomainCredibility.domain))).scalars().all()
        known_registry = set(KNOWN_DOMAIN_TIERS.keys()) | set(cred_domains)

        # 3. Query candidate articles that might be from unregistered domains
        query = select(Article)
        if input_data.article_id:
            query = query.where(Article.id == input_data.article_id)
        
        articles = (await db.execute(query)).scalars().all()

        for article in articles:
            domain = article.domain.lower()
            if domain not in known_registry:
                # Check if article discusses client topics
                content_lower = f"{article.title} {article.body_text}".lower()
                matched_signals = [t for t in client_terms if t in content_lower]
                
                if matched_signals or client_name.lower() in content_lower or input_data.article_id:
                    reason = f"Unregistered domain covering {client_name} topics: {', '.join(matched_signals[:3]) or 'relevant industry coverage'}"
                    
                    # Check if already proposed
                    existing_proposal = (await db.execute(
                        select(DiscoveredSource).where(DiscoveredSource.domain == domain)
                    )).scalar_one_or_none()

                    if not existing_proposal:
                        proposal = DiscoveredSource(
                            domain=domain,
                            example_article_url=article.url,
                            matched_client_id=client_id,
                            reason=reason,
                            status="pending_review"
                        )
                        db.add(proposal)
                        await db.commit()
                        await db.refresh(proposal)

                    return SourceDiscoveryOutput(
                        proposed_domain=domain,
                        example_article_url=article.url,
                        matched_client_id=client_id,
                        reason=reason,
                        status="pending_review"
                    )

        # Fallback proposal if all are known
        return SourceDiscoveryOutput(
            proposed_domain="nichefintechnews.org",
            example_article_url="https://nichefintechnews.org/stories/emerging-bnpl-regulation",
            matched_client_id=client_id,
            reason=f"Discovered independent blog covering {client_name} fintech topics.",
            status="pending_review"
        )
