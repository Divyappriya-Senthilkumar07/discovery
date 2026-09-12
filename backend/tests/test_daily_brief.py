import pytest
import pytest_asyncio
import uuid
from app.db.session import AsyncSessionLocal, init_db
from app.models.article import Article
from app.agents.agent8_daily_brief import DailyBriefAgent
from app.schemas.briefs import BriefGenerateRequest
from app.services.extraction_service import ExtractionService


@pytest.mark.asyncio
async def test_daily_brief_clustering_and_outlier_detection():
    await init_db()
    agent = DailyBriefAgent()

    async with AsyncSessionLocal() as db:
        client_id = f"client-brief-{uuid.uuid4().hex[:6]}"

        # 5 Syndicated Near-Duplicates regarding cross-border merchant rail
        wire_articles = [
            Article(
                id=str(uuid.uuid4()),
                content_hash=ExtractionService.compute_content_hash(f"https://source{i}.com/payu-crossborder", f"PayU launches cross-border merchant payments rail {i}"),
                url=f"https://source{i}.com/payu-crossborder",
                title=f"PayU launches cross-border merchant payments rail across Southeast Asia outlet {i}",
                body_text="PayU announced a new international payments rail for online merchants in Southeast Asia today, enabling local currency checkout settlement and reduced foreign transaction exchange rates.",
                domain=f"source{i}.com",
                extraction_method="static_html",
                status="success"
            )
            for i in range(1, 6)
        ]

        # 1 Genuinely distinct story angle (Cybersecurity Audit)
        distinct_article = Article(
            id=str(uuid.uuid4()),
            content_hash=ExtractionService.compute_content_hash("https://wired.com/payu-security-audit", "Independent cybersecurity compliance audit completed"),
            url="https://wired.com/payu-security-audit",
            title="Independent cybersecurity compliance audit completed with zero zero-day vulnerabilities",
            body_text="A forensic penetration test and SOC2 cybersecurity audit completed this morning, verifying encryption protocols and infrastructure hardening across server clusters.",
            domain="wired.com",
            extraction_method="static_html",
            status="success"
        )

        all_articles = wire_articles + [distinct_article]
        db.add_all(all_articles)
        await db.commit()

        # Run clustering
        brief_entries = await agent.cluster_and_summarize(
            client_id=client_id,
            articles=all_articles,
            db=db,
            cluster_threshold=0.65
        )

        assert len(brief_entries) >= 1
        main_brief = brief_entries[0]

        # Acceptance Criteria:
        # The 5 syndicated near-duplicates are grouped
        assert len(main_brief.contributing_sources) >= 4, f"Expected near-duplicate sources grouped, got {main_brief.contributing_sources}"
        
        # The 6th genuinely distinct article is flagged as an outlier
        assert any(distinct_article.title in o or distinct_article.id in o for o in main_brief.outlier_articles), f"Distinct article {distinct_article.id} was not flagged as outlier! Outliers: {main_brief.outlier_articles}"
        
        # None of the 5 syndicated articles should be flagged as outliers
        wire_titles = {a.title for a in wire_articles}
        for outlier_str in main_brief.outlier_articles:
            assert not any(wt in outlier_str for wt in wire_titles), f"Syndicated article {outlier_str} was incorrectly marked as outlier!"
