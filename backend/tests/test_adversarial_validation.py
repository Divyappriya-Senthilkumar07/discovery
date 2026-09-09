import pytest
import pytest_asyncio
from datetime import datetime, timezone
from app.agents.agent4_contextual_validation import ContextualValidationAgent
from app.schemas.validation import ValidationInput
from app.schemas.client_profile import ClientProfileOutput
from app.db.session import init_db, AsyncSessionLocal


@pytest.mark.asyncio
async def test_adversarial_disambiguation_matrix():
    await init_db()
    agent = ContextualValidationAgent()

    async with AsyncSessionLocal() as db:
        # Case 1: Apple Inc (Client) vs Apple Fruit / Orchard
        apple_client = ClientProfileOutput(
            client_id="apple-corp-01",
            aliases=["Apple", "Apple Inc", "AAPL"],
            parent_company=None,
            subsidiaries=["Beats", "Claris"],
            key_executives=["Tim Cook"],
            industry_terms=["iPhone", "MacBook", "iOS", "silicon", "App Store"],
            generated_at=datetime.now(timezone.utc)
        )

        # 1A: False Positive (Fruit Orchard)
        fruit_article = """Apple harvest in Kashmir orchards breaks ten-year record as farmers report high yield of red delicious varieties following favorable monsoon rains and cooler weather."""
        out_fruit = await agent.execute(
            ValidationInput(
                article_id="art-fruit-01",
                client_id=apple_client.client_id,
                article_text=fruit_article,
                client_context=apple_client
            ),
            db=db
        )
        assert out_fruit.verdict == "not_relevant"
        assert out_fruit.confidence < 0.50
        assert any(word in out_fruit.explanation.lower() for word in ["fruit", "orchard", "harvest", "agricultural", "farming"])

        # 1B: True Positive (Apple Tech)
        tech_article = """Apple unveiled its latest M4 silicon architecture and iOS enhancements today, highlighting efficiency gains across the MacBook Pro lineup."""
        out_tech = await agent.execute(
            ValidationInput(
                article_id="art-tech-01",
                client_id=apple_client.client_id,
                article_text=tech_article,
                client_context=apple_client
            ),
            db=db
        )
        assert out_tech.verdict == "relevant"
        assert out_tech.confidence > 0.85

        # Case 2: Amazon (Client) vs Amazon Rainforest
        amazon_client = ClientProfileOutput(
            client_id="amazon-corp-01",
            aliases=["Amazon", "Amazon.com", "AMZN"],
            parent_company=None,
            subsidiaries=["AWS", "Zoox"],
            key_executives=["Andy Jassy"],
            industry_terms=["e-commerce", "cloud computing", "AWS", "Prime", "fulfillment"],
            generated_at=datetime.now(timezone.utc)
        )
        rainforest_article = """Satellite imagery shows rate of deforestation in the Amazon basin slowing this quarter as environmental patrols crack down on illegal logging in the Brazilian rainforest."""
        out_forest = await agent.execute(
            ValidationInput(
                article_id="art-forest-01",
                client_id=amazon_client.client_id,
                article_text=rainforest_article,
                client_context=amazon_client
            ),
            db=db
        )
        assert out_forest.verdict == "not_relevant"
        assert out_forest.confidence < 0.50
        assert any(word in out_forest.explanation.lower() for word in ["rainforest", "basin", "deforestation", "conservation", "brazil"])

        # Case 3: ICICI Bank (Client) vs River Bank / Generic Holiday
        icici_client = ClientProfileOutput(
            client_id="icici-corp-01",
            aliases=["ICICI Bank", "ICICI"],
            parent_company=None,
            subsidiaries=["ICICI Securities", "ICICI Prudential"],
            key_executives=["Sandeep Bakhshi"],
            industry_terms=["commercial banking", "lending", "interest rates", "credit cards", "retail banking"],
            generated_at=datetime.now(timezone.utc)
        )
        river_article = """Heavy rainfall caused erosion along the northern river bank of the Yamuna, prompting authorities to reinforce the water embankment."""
        out_river = await agent.execute(
            ValidationInput(
                article_id="art-river-01",
                client_id=icici_client.client_id,
                article_text=river_article,
                client_context=icici_client
            ),
            db=db
        )
        assert out_river.verdict == "not_relevant"
        assert out_river.confidence < 0.50
        assert any(word in out_river.explanation.lower() for word in ["river", "embankment", "erosion", "geological"])

        # Case 4: Reliance Industries (Client) vs "Self-Reliance"
        reliance_client = ClientProfileOutput(
            client_id="reliance-corp-01",
            aliases=["Reliance Industries", "RIL", "Jio"],
            parent_company=None,
            subsidiaries=["Jio Platforms", "Reliance Retail"],
            key_executives=["Mukesh Ambani"],
            industry_terms=["conglomerate", "telecom", "petrochemicals", "refinery", "5G"],
            generated_at=datetime.now(timezone.utc)
        )
        phrase_article = """The government emphasized economic self-reliance in the energy sector, cautioning against excessive reliance on foreign imports during supply chain shocks."""
        out_phrase = await agent.execute(
            ValidationInput(
                article_id="art-phrase-01",
                client_id=reliance_client.client_id,
                article_text=phrase_article,
                client_context=reliance_client
            ),
            db=db
        )
        assert out_phrase.verdict == "not_relevant"
        assert out_phrase.confidence < 0.50
        assert any(word in out_phrase.explanation.lower() for word in ["self-reliance", "dependency", "linguistic", "reliance on", "import"])
