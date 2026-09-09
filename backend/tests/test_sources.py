import pytest
import pytest_asyncio
import uuid
from sqlalchemy import select
from app.db.session import AsyncSessionLocal, init_db
from app.models.client import Client
from app.models.article import Article
from app.models.source import DiscoveredSource, DomainCredibility
from app.agents.agent6_source_discovery import SourceDiscoveryAgent
from app.agents.agent7_source_credibility import SourceCredibilityAgent
from app.schemas.sources import SourceDiscoveryInput
from app.schemas.credibility import CredibilityInput, CredibilityOverride
from app.services.extraction_service import ExtractionService


@pytest.mark.asyncio
async def test_source_discovery_and_credibility_matrix():
    await init_db()
    discovery_agent = SourceDiscoveryAgent()
    credibility_agent = SourceCredibilityAgent()

    async with AsyncSessionLocal() as db:
        # 1. Setup client
        client_name = f"PayU-{uuid.uuid4().hex[:4]}"
        client_id = f"client-fintech-{uuid.uuid4().hex[:6]}"
        client = Client(
            id=client_id,
            name=client_name,
            parent_company="Prosus",
            aliases=["LazyPay"],
            subsidiaries=["Wibmo"],
            industry_terms=["fintech", "BNPL", "payment gateway"],
            manually_edited_fields=[]
        )
        db.add(client)

        # 2. Add an article from an unregistered domain covering client's topic
        unreg_url = "https://unregistered-payments-chronicle.org/stories/prosus-fintech-report"
        art_unreg = Article(
            id=str(uuid.uuid4()),
            content_hash=ExtractionService.compute_content_hash(unreg_url, "Prosus fintech payment gateway analysis"),
            url=unreg_url,
            title="Analysis of Prosus fintech and BNPL payment gateway expansion",
            body_text="Independent chronicle analyzing payment infrastructure developments across developing markets.",
            domain="unregistered-payments-chronicle.org",
            extraction_method="static_html",
            status="success"
        )
        db.add(art_unreg)
        await db.commit()

        # 3. Trigger Source Discovery Agent
        disc_out = await discovery_agent.execute(
            SourceDiscoveryInput(client_id=client_id, article_id=art_unreg.id),
            db=db
        )

        # Acceptance criteria for Task 9:
        # Article from unregistered domain surfaces in review queue with example URL
        assert disc_out.proposed_domain == "unregistered-payments-chronicle.org"
        assert disc_out.example_article_url == unreg_url
        assert disc_out.status == "pending_review"
        assert "fintech" in disc_out.reason.lower() or "prosus" in disc_out.reason.lower() or "topic" in disc_out.reason.lower()

        # 4. Source Credibility Agent testing:
        # Known high authority domain scores higher than unknown domain
        reuters_cred = await credibility_agent.execute(CredibilityInput(domain="reuters.com"), db=db)
        unknown_cred = await credibility_agent.execute(CredibilityInput(domain="random-spammy-blog.xyz"), db=db)

        assert reuters_cred.credibility_score > unknown_cred.credibility_score
        assert reuters_cred.tier == "tier1"
        assert unknown_cred.tier == "tier3"
        assert reuters_cred.manually_overridden is False

        # 5. Analyst override testing:
        override = CredibilityOverride(
            domain="random-spammy-blog.xyz",
            tier="tier1",
            credibility_score=0.91
        )
        overridden_cred = await credibility_agent.override_credibility(override, db=db)

        assert overridden_cred.domain == "random-spammy-blog.xyz"
        assert overridden_cred.tier == "tier1"
        assert overridden_cred.credibility_score == 0.91
        assert overridden_cred.manually_overridden is True

        # Re-querying credibility for this domain MUST preserve the override!
        re_query_cred = await credibility_agent.execute(CredibilityInput(domain="random-spammy-blog.xyz"), db=db)
        assert re_query_cred.tier == "tier1"
        assert re_query_cred.manually_overridden is True
