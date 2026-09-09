import pytest
import pytest_asyncio
import uuid
from sqlalchemy import select
from app.db.session import AsyncSessionLocal, init_db
from app.models.client import Client
from app.models.rule import Rule
from app.models.audit_log import AuditLog
from app.orchestrator.pipeline import PipelineOrchestrator, PipelineRunRequest


@pytest.mark.asyncio
async def test_end_to_end_pipeline_audit_traceability():
    await init_db()
    orchestrator = PipelineOrchestrator()

    async with AsyncSessionLocal() as db:
        # 1. Setup client & business rule
        client_stmt = select(Client).where(Client.name == "PayU")
        client = (await db.execute(client_stmt)).scalar_one_or_none()
        if not client:
            client_id = f"client-payu-{uuid.uuid4().hex[:6]}"
            client = Client(
                id=client_id,
                name="PayU",
                parent_company="Prosus",
                aliases=["LazyPay", "PayU India"],
                subsidiaries=["Wibmo"],
                industry_terms=["fintech", "BNPL", "digital payments", "payment gateway"],
                manually_edited_fields=[]
            )
            db.add(client)
            await db.commit()
            await db.refresh(client)
        else:
            client_id = client.id

        rule = Rule(
            client_id=client_id,
            name="Tier 1 & Tier 2 Fintech Only",
            domain_tiers=["tier1", "tier2"],
            mandatory_terms=["fintech"]
        )
        db.add(rule)
        await db.commit()

        # 2. Run test article through pipeline
        test_html = """<!DOCTYPE html>
        <html>
        <head><title>Prosus Payments Arm Launches Merchant Credit Service</title></head>
        <body>
            <article>
                <h1>Prosus Payments Arm Launches Merchant Credit Service</h1>
                <p>Global fintech leader announced a revolutionary digital checkout and BNPL credit line for online retailers today.</p>
                <p>The service directly integrates with existing merchant acquiring gateways across emerging markets.</p>
            </article>
        </body>
        </html>
        """
        req = PipelineRunRequest(
            source_url="https://techwire.io/stories/prosus-payments-launch",
            client_id=client_id,
            source_type="manual",
            raw_content=test_html
        )
        result = await orchestrator.run(req, db=db)

        assert result.article_id is not None
        assert result.verdict in ["relevant", "needs_review"]
        assert result.confidence > 0.50
        assert result.passed_rules is True
        assert len(result.stage_latencies) >= 4

        # 3. Acceptance Criteria: Trace article end-to-end through every stage via audit_log
        audit_stmt = (
            select(AuditLog)
            .where(AuditLog.article_id == result.article_id)
            .order_by(AuditLog.id.asc())
        )
        audit_records = (await db.execute(audit_stmt)).scalars().all()

        logged_agents = [rec.agent_name for rec in audit_records]

        # Verify each stage is logged with decisions, timestamps, and latency
        assert "ExtractionAgent" in logged_agents, f"ExtractionAgent missing from audit trail: {logged_agents}"
        assert "SemanticDiscoveryAgent" in logged_agents, f"SemanticDiscoveryAgent missing from audit trail: {logged_agents}"
        assert "ContextualValidationAgent" in logged_agents, f"ContextualValidationAgent missing from audit trail: {logged_agents}"
        assert "RuleEngineAgent" in logged_agents, f"RuleEngineAgent missing from audit trail: {logged_agents}"

        for record in audit_records:
            assert record.timestamp is not None
            assert record.latency_ms >= 0
            assert record.output_summary != ""
            assert record.client_id == client_id or record.client_id is not None
