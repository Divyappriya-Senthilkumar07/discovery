import asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.client import Client
from app.models.rule import Rule
from app.models.source import DomainCredibility, DiscoveredSource
from app.models.article import Article
from app.core.security import get_password_hash
from app.core.logging import logger


async def seed_demo_data():
    """
    Seed initial accounts, client DNA profiles, sources, and sample articles
    if the database is currently unpopulated.
    """
    async with AsyncSessionLocal() as db:
        logger.info("Verifying and seeding Context Engine initial demo accounts, clients, and sources...")

        # 1. Default Users
        existing_users = set((await db.execute(select(User.email))).scalars().all())
        analyst = User(
            email="analyst@contextengine.ai",
            hashed_password=get_password_hash("analyst123"),
            role="analyst",
            is_active=True
        )
        admin = User(
            email="admin@contextengine.ai",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            is_active=True
        )
        analyst_discover = User(
            email="analyst@discover.ai",
            hashed_password=get_password_hash("analyst123"),
            role="analyst",
            is_active=True
        )
        admin_discover = User(
            email="admin@discover.ai",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            is_active=True
        )
        for u in [analyst, admin, analyst_discover, admin_discover]:
            if u.email not in existing_users:
                db.add(u)

        # 2. Demo Clients
        existing_client_ids = set((await db.execute(select(Client.id))).scalars().all())
        payu = Client(
            id="client-payu-demo",
            name="PayU",
            aliases=["PayU Payments", "PayU India", "Ibibo Group Payments"],
            parent_company="Prosus",
            subsidiaries=["LazyPay", "Wibmo", "RedDot Payment"],
            key_executives=["Laurent le Moal", "Anirban Mukherjee"],
            industry_terms=["fintech", "BNPL", "digital payments", "payment gateway", "merchant acquiring", "cross-border checkout"],
            manually_edited_fields=[],
            generated_at=datetime.now(timezone.utc)
        )

        reliance = Client(
            id="client-reliance-demo",
            name="Reliance Industries",
            aliases=["RIL", "Reliance Group"],
            parent_company=None,
            subsidiaries=["Jio Platforms", "Reliance Retail", "Reliance Petroleum", "Jio Financial Services"],
            key_executives=["Mukesh Ambani", "Isha Ambani", "Akash Ambani"],
            industry_terms=["telecom", "5G", "petrochemicals", "retail", "refinery", "clean energy"],
            manually_edited_fields=[],
            generated_at=datetime.now(timezone.utc)
        )

        razorpay = Client(
            id="client-razorpay-demo",
            name="Razorpay",
            aliases=["Razorpay Software"],
            parent_company=None,
            subsidiaries=["Curlec", "Opfin", "Thirdwatch", "IZI Health"],
            key_executives=["Harshil Mathur", "Shashank Kumar"],
            industry_terms=["payment gateway", "neo-banking", "payroll", "SME lending", "fintech unicorn"],
            manually_edited_fields=[],
            generated_at=datetime.now(timezone.utc)
        )
        for c in [payu, reliance, razorpay]:
            if c.id not in existing_client_ids:
                db.add(c)

        # 3. Default Business Rules
        existing_rules = set((await db.execute(select(Rule.name))).scalars().all())
        rule1 = Rule(
            client_id="client-payu-demo",
            name="Tier 1 & 2 Fintech Ingestion Rule",
            natural_language_text="Only show Tier 1 national news published in India or Global within the last 48 hours, excluding cricket and sports",
            geography=["India", "Global"],
            domain_tiers=["tier1", "tier2"],
            recency_hours=48,
            mandatory_terms=["fintech", "payments"],
            excluded_terms=["crypto", "sports", "cricket"]
        )
        if rule1.name not in existing_rules:
            db.add(rule1)

        # 4. Domain Credibility Index
        existing_domains = set((await db.execute(select(DomainCredibility.domain))).scalars().all())
        cred_sources = [
            DomainCredibility(
                domain="reuters.com",
                credibility_score=0.96,
                tier="tier1",
                signals_used=["Global wire service", "Stringent independent editorial board", "High source citation index"],
                manually_overridden=False
            ),
            DomainCredibility(
                domain="bloomberg.com",
                credibility_score=0.95,
                tier="tier1",
                signals_used=["Institutional financial terminal", "Tier-1 global newsroom", "Cross-verified reporting"],
                manually_overridden=False
            ),
            DomainCredibility(
                domain="economictimes.indiatimes.com",
                credibility_score=0.88,
                tier="tier1",
                signals_used=["Leading national financial daily", "Regional corporate authority", "High domestic reach"],
                manually_overridden=False
            ),
            DomainCredibility(
                domain="techcrunch.com",
                credibility_score=0.84,
                tier="tier2",
                signals_used=["Venture & startup trade press", "High tech industry authority", "Direct founder sourcing"],
                manually_overridden=False
            ),
            DomainCredibility(
                domain="entrackr.com",
                credibility_score=0.76,
                tier="tier2",
                signals_used=["Regional startup ecosystem reporting", "Funding round tracking", "Independent tech blog"],
                manually_overridden=False
            ),
            DomainCredibility(
                domain="inc42.com",
                credibility_score=0.74,
                tier="tier2",
                signals_used=["Indian startup trade journalism", "E-commerce & fintech focus", "Emerging business media"],
                manually_overridden=False
            )
        ]
        for cs in cred_sources:
            if cs.domain not in existing_domains:
                db.add(cs)

        # 5. Discovered Sources Queue
        existing_discovered = set((await db.execute(select(DiscoveredSource.domain))).scalars().all())
        discovered = [
            DiscoveredSource(
                domain="fintechnews.sg",
                example_article_url="https://fintechnews.sg/articles/prosus-digital-payments-expansion-apac",
                matched_client_id="client-payu-demo",
                reason="Unregistered Tier-2 regional fintech portal publishing frequent APAC digital payments coverage",
                status="pending_review"
            ),
            DiscoveredSource(
                domain="thepaypers.com",
                example_article_url="https://thepaypers.com/payments/lazypay-merchant-checkout-bnpl-adoption",
                matched_client_id="client-payu-demo",
                reason="Specialized global payment gateway trade publication with extensive BNPL insights",
                status="approved"
            )
        ]
        for ds in discovered:
            if ds.domain not in existing_discovered:
                db.add(ds)

        # 6. Sample Articles for Live Feed
        existing_articles = set((await db.execute(select(Article.id))).scalars().all())
        art1 = Article(
            id="art-demo-1",
            url="https://economictimes.indiatimes.com/tech/fintech/prosus-payments-arm-expands-merchant-checkout/articleshow/108920.cms",
            title="Prosus digital payments subsidiary expands merchant checkout credit network",
            body_text="Prosus digital payments division announces major expansion in instant merchant checkout rails. The firm's subsidiary LazyPay reported 45% annual credit volume growth across tier-1 e-commerce partners. Chief Executive Laurent le Moal indicated plans to scale cross-border payment gateway integrations for emerging digital retail merchants across high-growth markets.",
            author="Aakriti Sharma",
            published_at=datetime.now(timezone.utc),
            domain="economictimes.indiatimes.com",
            content_hash="hash-et-prosus-payments-demo",
            extraction_method="static_html",
            status="success"
        )
        art2 = Article(
            id="art-demo-2",
            url="https://reuters.com/business/finance/bnpl-providers-accelerate-digital-credit-underwriting/2026-09-08",
            title="Leading BNPL provider expands digital lending partnerships with regional e-commerce stores",
            body_text="Leading BNPL provider LazyPay has deployed automated underwriting models to approve consumer point-of-sale financing at top checkout gateways. The platform integrates seamless installment payment solutions designed for modern mobile-first digital shoppers without requiring traditional card rails.",
            author="Reuters Business Desk",
            published_at=datetime.now(timezone.utc),
            domain="reuters.com",
            content_hash="hash-reuters-bnpl-demo",
            extraction_method="static_html",
            status="success"
        )
        art3 = Article(
            id="art-demo-3",
            url="https://techwire.org/apple-harvest-breaks-records-kashmir-2026",
            title="Apple harvest in Kashmir orchards breaks records as farmers celebrate crisp red delicious yield",
            body_text="Orchard owners across the Kashmir valley are celebrating an unprecedented autumn harvest as cold mountain weather produced exceptionally crisp red delicious apples. Agricultural authorities report local fruit export shipments increased thirty percent over last year's crop yield.",
            author="Tariq Ahmad",
            published_at=datetime.now(timezone.utc),
            domain="techwire.org",
            content_hash="hash-apple-fruit-demo",
            extraction_method="static_html",
            status="success"
        )
        for art in [art1, art2, art3]:
            if art.id not in existing_articles:
                db.add(art)

        # 7. Forensic Audit Logs
        from app.models.audit_log import AuditLog
        existing_log = (await db.execute(select(AuditLog.id))).scalars().first()
        if not existing_log:
            logs = [
                AuditLog(
                    agent_name="ContextualValidationAgent",
                    article_id="art-demo-1",
                    client_id="client-payu-demo",
                    input_summary="Article mentions Prosus, LazyPay, Laurent le Moal expanding merchant checkout",
                    output_summary="Verdict: relevant, Confidence: 0.96",
                    confidence=0.96,
                    explanation="Article directly details PayU's parent company Prosus, subsidiary LazyPay, and CEO Laurent le Moal expanding merchant acquiring rails.",
                    latency_ms=142.5
                ),
                AuditLog(
                    agent_name="ContextualValidationAgent",
                    article_id="art-demo-2",
                    client_id="client-payu-demo",
                    input_summary="Article discusses LazyPay POS financing and automated underwriting",
                    output_summary="Verdict: relevant, Confidence: 0.91",
                    confidence=0.91,
                    explanation="Coverage highlights PayU's subsidiary LazyPay implementing BNPL payment gateway credit.",
                    latency_ms=128.0
                ),
                AuditLog(
                    agent_name="ContextualValidationAgent",
                    article_id="art-demo-3",
                    client_id="client-payu-demo",
                    input_summary="Orchard apple harvest in Kashmir valley",
                    output_summary="Verdict: not_relevant, Confidence: 0.08",
                    confidence=0.08,
                    explanation="Article discusses agricultural apple fruit harvest, possessing zero semantic or corporate relevance to digital payments.",
                    latency_ms=95.2
                ),
                AuditLog(
                    agent_name="RuleEngineAgent",
                    article_id="art-demo-1",
                    client_id="client-payu-demo",
                    input_summary="Evaluate against rule: Tier 1 & 2 Fintech Ingestion Rule",
                    output_summary="Passed: True",
                    confidence=1.0,
                    explanation="Article domain 'economictimes.indiatimes.com' is Tier 1 and content matches mandatory terms ['fintech', 'payments'].",
                    latency_ms=12.4
                )
            ]
            db.add_all(logs)

        await db.commit()
        logger.info("Demo database seed complete! Default analyst and admin ready.")


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
