import pytest
import pytest_asyncio
from app.db.session import AsyncSessionLocal, init_db
from app.agents.agent2_client_dna import ClientDNAAgent
from app.schemas.client_profile import ClientProfileInput, ClientProfileUpdate
from app.models.client import Client
from sqlalchemy import select


@pytest.mark.asyncio
async def test_client_dna_generation_and_analyst_precedence():
    await init_db()
    agent = ClientDNAAgent()

    async with AsyncSessionLocal() as db:
        # 1. Initial Generation for PayU
        inp = ClientProfileInput(
            client_name="PayU",
            seed_description="Global online payment service provider operating in high-growth emerging markets",
            seed_url="https://corporate.payu.com"
        )
        out = await agent.execute(inp, db=db)

        # Verify acceptance criteria: includes Prosus, fintech, BNPL
        assert out.parent_company == "Prosus" or "Prosus" in out.aliases or "Prosus" in str(out.model_dump())
        assert any("fintech" in term.lower() for term in out.industry_terms)
        assert any("bnpl" in term.lower() for term in out.industry_terms)
        client_id = out.client_id

        # 2. Analyst edits a field manually (e.g. customized subsidiaries and custom parent company)
        stmt = select(Client).where(Client.id == client_id)
        client_record = (await db.execute(stmt)).scalar_one()
        
        custom_subsidiaries = ["CustomAcquiredGatewayCorp", "LazyPay", "Wibmo"]
        custom_parent = "Prosus NV (Custom Analyst Override)"
        
        client_record.subsidiaries = custom_subsidiaries
        client_record.parent_company = custom_parent
        client_record.manually_edited_fields = ["subsidiaries", "parent_company"]
        client_record.last_edited_by = "lead_analyst@contextengine.ai"
        await db.commit()

        # 3. Pipeline Re-run for PayU: Analyst edits MUST survive and take strict precedence!
        re_run_out = await agent.execute(inp, db=db)

        assert re_run_out.client_id == client_id
        assert re_run_out.parent_company == custom_parent, "Analyst override for parent_company was overwritten!"
        assert "CustomAcquiredGatewayCorp" in re_run_out.subsidiaries, "Analyst custom subsidiary was lost on re-run!"
        assert re_run_out.last_edited_by == "lead_analyst@contextengine.ai"
