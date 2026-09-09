import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.agents.base import BaseAgent
from app.schemas.client_profile import ClientProfileInput, ClientProfileOutput
from app.services.llm_service import LLMService
from app.models.client import Client
from app.core.logging import logger


class ClientDNAAgent(BaseAgent[ClientProfileInput, ClientProfileOutput]):
    name = "ClientDNAAgent"

    async def process(
        self,
        input_data: ClientProfileInput,
        db: Optional[AsyncSession] = None
    ) -> ClientProfileOutput:
        client_name = input_data.client_name.strip()

        # 1. Check if client already exists in database
        existing_client: Optional[Client] = None
        if db is not None:
            stmt = select(Client).where(Client.name.ilike(client_name))
            existing_client = (await db.execute(stmt)).scalar_one_or_none()

        # 2. Build prompt for LLM entity generation
        prompt = f"""
        Generate an exhaustive Client DNA Profile for the enterprise or brand: '{client_name}'.
        Seed Description: {input_data.seed_description or 'None'}
        Seed URL: {input_data.seed_url or 'None'}

        Return JSON with keys:
        - aliases: list of alternative corporate names, stock tickers, or abbreviations
        - parent_company: name of parent corporate entity or conglomerate, if any (or null)
        - subsidiaries: list of operating subsidiaries, major sub-brands, or acquired entities
        - key_executives: list of current CEO, founders, or high-profile leadership
        - industry_terms: list of specialized industry terms, jargon, business models (e.g. BNPL, cloud, SaaS)
        """
        system_instruction = "You are an expert Corporate Intelligence Research Agent generating exact entity knowledge graphs."
        llm_response = await LLMService.generate_json(prompt, system_instruction=system_instruction)

        gen_aliases = llm_response.get("aliases", [])
        gen_parent = llm_response.get("parent_company")
        gen_subs = llm_response.get("subsidiaries", [])
        gen_execs = llm_response.get("key_executives", [])
        gen_terms = llm_response.get("industry_terms", [])

        # 3. Apply analyst edit precedence: Analyst edits take strict priority on re-runs!
        last_edited_by = None
        client_id = str(uuid.uuid4())
        manually_edited = []

        if existing_client:
            client_id = existing_client.id
            last_edited_by = existing_client.last_edited_by
            manually_edited = existing_client.manually_edited_fields or []

            # If a field was manually edited by an analyst, keep the analyst's saved value!
            if "parent_company" in manually_edited:
                gen_parent = existing_client.parent_company
            if "aliases" in manually_edited:
                gen_aliases = existing_client.aliases
            if "subsidiaries" in manually_edited:
                gen_subs = existing_client.subsidiaries
            if "key_executives" in manually_edited:
                gen_execs = existing_client.key_executives
            if "industry_terms" in manually_edited:
                gen_terms = existing_client.industry_terms

            # Update existing client with latest generated values for unedited fields
            existing_client.parent_company = gen_parent
            existing_client.aliases = gen_aliases
            existing_client.subsidiaries = gen_subs
            existing_client.key_executives = gen_execs
            existing_client.industry_terms = gen_terms
            existing_client.updated_at = datetime.now(timezone.utc)

            await db.commit()
            await db.refresh(existing_client)
        elif db is not None:
            # Create new client record
            new_client = Client(
                id=client_id,
                name=client_name,
                seed_description=input_data.seed_description,
                seed_url=input_data.seed_url,
                parent_company=gen_parent,
                aliases=gen_aliases,
                subsidiaries=gen_subs,
                key_executives=gen_execs,
                industry_terms=gen_terms,
                manually_edited_fields=[],
                last_edited_by=None,
                generated_at=datetime.now(timezone.utc)
            )
            db.add(new_client)
            await db.commit()
            await db.refresh(new_client)

        now = datetime.now(timezone.utc)
        return ClientProfileOutput(
            client_id=client_id,
            aliases=gen_aliases,
            parent_company=gen_parent,
            subsidiaries=gen_subs,
            key_executives=gen_execs,
            industry_terms=gen_terms,
            generated_at=existing_client.generated_at if existing_client else now,
            last_edited_by=last_edited_by
        )
