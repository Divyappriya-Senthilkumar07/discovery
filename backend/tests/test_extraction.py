import pytest
import pytest_asyncio
from sqlalchemy import select, func
from app.db.session import AsyncSessionLocal, init_db
from app.models.article import Article
from app.agents.agent1_extraction import ExtractionAgent
from app.schemas.extraction import ExtractionInput


@pytest.mark.asyncio
async def test_extraction_agent_full_matrix():
    await init_db()
    agent = ExtractionAgent()

    # Fixture 1: RSS Feed
    rss_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>TechWire News RSS</title>
        <link>https://techwire.io/rss</link>
        <item>
          <title>Fintech Unicorn Launches New Instant Credit Infrastructure</title>
          <link>https://techwire.io/stories/fintech-instant-credit-launch</link>
          <description>A leading digital payments company announced a brand new BNPL architecture for regional merchants today.</description>
          <author>Jane Reporter</author>
          <pubDate>Mon, 08 Sep 2026 10:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>
    """
    async with AsyncSessionLocal() as db:
        rss_input = ExtractionInput(
            source_url="https://techwire.io/stories/fintech-instant-credit-launch?utm_source=twitter&utm_medium=social",
            source_type="rss",
            raw_content=rss_xml
        )
        rss_out = await agent.execute(rss_input, db=db)
        assert rss_out.extraction_method == "rss"
        assert "Fintech Unicorn" in rss_out.title
        assert "BNPL architecture" in rss_out.body_text
        assert rss_out.status in ["success", "degraded"]
        rss_article_id = rss_out.article_id

        # Fixture 2: Static HTML
        html_page = """<!DOCTYPE html>
        <html>
        <head>
            <title>Venture Beat - Enterprise AI Models Benchmark</title>
            <meta property="og:title" content="Enterprise AI Models Benchmark" />
            <meta name="author" content="David Smith" />
        </head>
        <body>
            <header><nav>Home | About | Contact</nav></header>
            <article>
                <h1>Enterprise AI Models Benchmark</h1>
                <p>New enterprise intelligence systems are revolutionizing real-time news analysis across global media.</p>
                <p>Analysts report spending significantly less time weeding out false positive alerts when semantic disambiguation is applied.</p>
            </article>
            <footer>Copyright 2026</footer>
        </body>
        </html>
        """
        html_input = ExtractionInput(
            source_url="https://venturebeat.com/ai/enterprise-models-benchmark#overview",
            source_type="manual",
            raw_content=html_page
        )
        html_out = await agent.execute(html_input, db=db)
        assert html_out.extraction_method == "static_html"
        assert "Enterprise AI Models Benchmark" in html_out.title
        assert "real-time news analysis" in html_out.body_text
        assert html_out.status == "success"

        # Fixture 3: JS-Rendered Dynamic Site (SPA)
        js_page = """<!DOCTYPE html>
        <html>
        <head>
            <title>Fintech Daily Live Dispatch</title>
        </head>
        <body>
            <div id="root"></div>
            <script>
                const payload = "Prosus fintech affiliate PayU expands multi-currency cross-border settlement for international commerce";
                document.getElementById("root").innerHTML = "<p>" + payload + "</p>";
            </script>
        </body>
        </html>
        """
        js_input = ExtractionInput(
            source_url="https://fintechdaily.live/spa/dispatch-101",
            source_type="manual",
            raw_content=js_page
        )
        js_out = await agent.execute(js_input, db=db)
        assert js_out.extraction_method == "headless_browser"
        assert "Fintech Daily Live" in js_out.title
        assert "PayU expands" in js_out.body_text or "settlement" in js_out.body_text

        # 4. Deduplication Check: Ingest duplicate URL with different query parameters
        dup_input = ExtractionInput(
            source_url="https://techwire.io/stories/fintech-instant-credit-launch?utm_source=newsletter&ref=homepage",
            source_type="rss",
            raw_content=rss_xml
        )
        dup_out = await agent.execute(dup_input, db=db)
        # Must return the SAME article_id as original
        assert dup_out.article_id == rss_article_id, "Deduplication failed to return existing article ID"

        # Verify database count has no duplicate record for this normalized URL
        count_stmt = select(func.count(Article.id)).where(Article.url == "https://techwire.io/stories/fintech-instant-credit-launch")
        url_count = (await db.execute(count_stmt)).scalar()
        assert url_count == 1, f"Expected exactly 1 article in DB for deduplicated URL, found {url_count}"
