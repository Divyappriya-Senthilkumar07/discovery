import pytest
import pytest_asyncio
import uuid
from datetime import datetime, timedelta, timezone
from app.db.session import AsyncSessionLocal, init_db
from app.models.article import Article
from app.agents.agent5_rule_engine import RuleEngineAgent
from app.schemas.rules import RuleParseRequest, RuleFilter
from app.services.extraction_service import ExtractionService


@pytest.mark.asyncio
async def test_rule_engine_nl_parsing_and_preview_simulation():
    await init_db()
    agent = RuleEngineAgent()

    # 1. Verify 5 varied natural-language phrasings parse into structured filters
    nl_phrasings = [
        "fintech news from India and APAC, top-tier sources only, last 24 hours, must mention regulation",
        "US banking stories, top-tier only, last 48 hours, must mention compliance",
        "APAC digital payments, tier 1 sources, last 24 hours, must mention license",
        "Europe financial updates, last 7 days, must mention funding",
        "News from India, top-tier sources, must mention regulation, exclude sports",
    ]

    parsed_filters = []
    for phrasing in nl_phrasings:
        req = RuleParseRequest(client_id="client-test-01", natural_language_rule=phrasing)
        parsed = await agent.parse_natural_language(req)
        assert isinstance(parsed, RuleFilter)
        assert parsed.client_id == "client-test-01"
        parsed_filters.append(parsed)

    # Specific assertion on phrasing 1
    f1 = parsed_filters[0]
    assert any(g in ["India", "APAC"] for g in f1.geography)
    assert "tier1" in f1.domain_tiers
    assert f1.recency_hours == 24
    assert "regulation" in f1.mandatory_terms

    # Specific assertion on phrasing 5
    f5 = parsed_filters[4]
    assert "sports" in f5.excluded_terms
    assert "regulation" in f5.mandatory_terms

    # 2. Ingest known test articles to verify preview simulation matches query
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        # Article A: Matches f1 (India, tier1 domain: reuters.com, published 2 hours ago, mentions regulation)
        art_a = Article(
            id=str(uuid.uuid4()),
            content_hash=ExtractionService.compute_content_hash("https://reuters.com/india-fintech-reg", "India RBI issues new fintech regulation"),
            url="https://reuters.com/india-fintech-reg",
            title="India RBI issues new fintech regulation framework for digital lenders",
            body_text="Reserve Bank of India has published new regulation guidelines for APAC digital payment platforms operating in Mumbai.",
            domain="reuters.com",
            extraction_method="static_html",
            status="success",
            published_at=now - timedelta(hours=2)
        )

        # Article B: Fails f1 (Mentions sports, lacks regulation, domain is tier3)
        art_b = Article(
            id=str(uuid.uuid4()),
            content_hash=ExtractionService.compute_content_hash("https://fintechdaily.live/sports-sponsorship", "Payments app signs sports sponsorship deal"),
            url="https://fintechdaily.live/sports-sponsorship",
            title="Payments app signs sports cricket sponsorship deal",
            body_text="A local startup signed a sports sponsorship deal with Indian cricket league today.",
            domain="fintechdaily.live",
            extraction_method="static_html",
            status="success",
            published_at=now - timedelta(hours=5)
        )

        # Article C: Fails f1 due to recency (published 40 hours ago > 24 hours)
        art_c = Article(
            id=str(uuid.uuid4()),
            content_hash=ExtractionService.compute_content_hash("https://bloomberg.com/old-india-reg", "Past banking regulation recap in India"),
            url="https://bloomberg.com/old-india-reg",
            title="Past banking regulation recap in India and APAC",
            body_text="Historical review of RBI regulation and interest rate targets across India.",
            domain="bloomberg.com",
            extraction_method="static_html",
            status="success",
            published_at=now - timedelta(hours=40)
        )

        db.add_all([art_a, art_b, art_c])
        await db.commit()

        # Run preview against f1
        preview_res = await agent.preview_rule(f1, db=db)

        # Manual evaluation check
        manual_matches = [
            a for a in [art_a, art_b, art_c]
            if agent.evaluate_article(a, f1)
        ]

        assert preview_res.matched_article_count == len(manual_matches)
        assert preview_res.matched_article_count >= 1
        assert art_a.title in preview_res.sample_matches
        assert art_b.title not in preview_res.sample_matches
        assert art_c.title not in preview_res.sample_matches
