import pytest
import pytest_asyncio
import uuid
from app.db.session import AsyncSessionLocal, init_db
from app.models.client import Client
from app.models.article import Article
from app.agents.agent3_semantic_discovery import SemanticDiscoveryAgent
from app.schemas.discovery import DiscoveryInput
from app.services.extraction_service import ExtractionService


@pytest.mark.asyncio
async def test_semantic_discovery_synonym_ranking_without_exact_name():
    await init_db()
    agent = SemanticDiscoveryAgent()

    async with AsyncSessionLocal() as db:
        # 1. Create client: PayU with DNA terms
        client_id = str(uuid.uuid4())
        client = Client(
            id=client_id,
            name="PayU",
            parent_company="Prosus",
            aliases=["LazyPay", "PayU Payments"],
            subsidiaries=["Wibmo", "Red Dot Payment"],
            industry_terms=["fintech", "BNPL", "payment gateway", "merchant acquiring", "cross-border settlement", "digital payments"],
            manually_edited_fields=[]
        )
        db.add(client)

        # 2. Add relevant articles that NEVER mention the string 'PayU'
        art_rel1 = Article(
            id=str(uuid.uuid4()),
            content_hash=ExtractionService.compute_content_hash("https://news.com/art1", "Prosus backed fintech payments unicorn"),
            url="https://news.com/art1",
            title="Prosus payments unicorn rolls out merchant BNPL credit in Southeast Asia",
            body_text="A major digital payment provider owned by Prosus has deployed a next-generation BNPL installment credit architecture for regional e-commerce merchants, accelerating point-of-sale financing.",
            domain="news.com",
            extraction_method="static_html",
            status="success"
        )
        art_rel2 = Article(
            id=str(uuid.uuid4()),
            content_hash=ExtractionService.compute_content_hash("https://news.com/art2", "Payment gateway provider expands cross-border"),
            url="https://news.com/art2",
            title="Payment gateway provider expands cross-border settlement rails",
            body_text="Digital payments infrastructure and merchant acquiring networks expanded their currency settlement capabilities today, offering low-latency transaction processing for emerging market stores.",
            domain="news.com",
            extraction_method="static_html",
            status="success"
        )

        # 3. Add completely irrelevant articles
        art_irrel1 = Article(
            id=str(uuid.uuid4()),
            content_hash=ExtractionService.compute_content_hash("https://news.com/art3", "Wild tiger population increases in Siberian"),
            url="https://news.com/art3",
            title="Wild tiger population increases in Siberian wildlife sanctuary",
            body_text="Conservation biologists reported a measurable increase in the count of wild tigers across protected sub-zero taiga forest zones following anti-poaching measures.",
            domain="news.com",
            extraction_method="static_html",
            status="success"
        )
        art_irrel2 = Article(
            id=str(uuid.uuid4()),
            content_hash=ExtractionService.compute_content_hash("https://news.com/art4", "Global copper futures drop amid shifts"),
            url="https://news.com/art4",
            title="Global copper futures drop amid international mining supply",
            body_text="Commodity exchanges saw red metal prices slide by two percent this morning following updated inventory figures from major smelting plants in South America.",
            domain="news.com",
            extraction_method="static_html",
            status="success"
        )

        db.add_all([art_rel1, art_rel2, art_irrel1, art_irrel2])
        await db.commit()

        # 4. Execute Semantic Discovery Pre-filter
        discovery_input = DiscoveryInput(
            client_id=client_id,
            top_k=5,
            similarity_threshold=0.30
        )
        output = await agent.execute(discovery_input, db=db)

        # Assertions:
        # Candidate shortlist must contain the relevant articles
        assert art_rel1.id in output.candidate_article_ids, "Relevant synonym article 1 was missed!"
        assert art_rel2.id in output.candidate_article_ids, "Relevant synonym article 2 was missed!"
        
        # Relevant articles must have higher similarity than irrelevant articles
        rel1_score = output.similarity_scores.get(art_rel1.id, 0.0)
        rel2_score = output.similarity_scores.get(art_rel2.id, 0.0)
        irrel1_score = output.similarity_scores.get(art_irrel1.id, 0.0)
        irrel2_score = output.similarity_scores.get(art_irrel2.id, 0.0)

        assert rel1_score > irrel1_score, f"Expected rel1 ({rel1_score}) > irrel1 ({irrel1_score})"
        assert rel2_score > irrel2_score, f"Expected rel2 ({rel2_score}) > irrel2 ({irrel2_score})"

        # Verify top candidates are dominated by relevant articles
        top_ids = output.candidate_article_ids[:2]
        assert art_rel1.id in top_ids or art_rel2.id in top_ids
