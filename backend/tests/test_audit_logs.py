import pytest
import pytest_asyncio
import httpx
from app.main import app
from app.db.session import init_db, AsyncSessionLocal
from app.models.user import User
from app.core.security import get_password_hash, create_access_token
from app.services.audit_service import AuditService
from sqlalchemy import select


@pytest.mark.asyncio
async def test_audit_log_queryability_and_filtering():
    await init_db()

    # Setup admin user
    async with AsyncSessionLocal() as db:
        admin = (await db.execute(select(User).where(User.email == "audit_admin@contextengine.ai"))).scalar_one_or_none()
        if not admin:
            admin = User(
                email="audit_admin@contextengine.ai",
                hashed_password=get_password_hash("AdminPass123!"),
                role="admin",
                is_active=True
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)

        # Inject sample audit records
        await AuditService.log_agent_decision(
            agent_name="ContextualValidationAgent",
            input_summary="Adversarial evaluation Apple Corp vs fruit",
            output_summary="Verdict: not_relevant",
            article_id="art-test-audit-01",
            client_id="client-apple-01",
            confidence=0.15,
            explanation="Article refers to agricultural apple fruit and orchard farming",
            latency_ms=12.5,
            db=db
        )

        await AuditService.log_agent_decision(
            agent_name="RuleEngineAgent",
            input_summary="Evaluating business rules for client PayU",
            output_summary="Passed rules",
            article_id="art-test-audit-02",
            client_id="client-payu-01",
            confidence=0.95,
            explanation="Complies with tier1 domain requirement and APAC geography",
            latency_ms=8.2,
            db=db
        )

    token = create_access_token({"sub": "audit_admin@contextengine.ai", "role": "admin"})

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Query all logs
        res = await client.get("/api/v1/logs", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        logs = res.json()
        assert len(logs) >= 2

        # 2. Filter by agent_name
        res_agent = await client.get(
            "/api/v1/logs?agent_name=ContextualValidationAgent",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_agent.status_code == 200
        agent_logs = res_agent.json()
        assert all(l["agent_name"] == "ContextualValidationAgent" for l in agent_logs)

        # 3. Filter by client_id
        res_client = await client.get(
            "/api/v1/logs?client_id=client-apple-01",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_client.status_code == 200
        client_logs = res_client.json()
        assert any(l["client_id"] == "client-apple-01" for l in client_logs)

        # 4. Filter by confidence threshold
        res_conf = await client.get(
            "/api/v1/logs?min_confidence=0.80",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_conf.status_code == 200
        conf_logs = res_conf.json()
        assert all(l["confidence"] >= 0.80 for l in conf_logs if l["confidence"] is not None)

        # 5. Search text in explanation
        res_search = await client.get(
            "/api/v1/logs?search=orchard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_search.status_code == 200
        search_logs = res_search.json()
        assert any("orchard" in l["explanation"].lower() for l in search_logs)

        # 6. Stats endpoint
        res_stats = await client.get("/api/v1/logs/stats", headers={"Authorization": f"Bearer {token}"})
        assert res_stats.status_code == 200
        stats = res_stats.json()
        assert stats["total_agent_decisions"] >= 2
        assert stats["average_decision_latency_ms"] > 0
