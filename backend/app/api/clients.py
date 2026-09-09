from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.client import Client
from app.schemas.client_profile import ClientProfileInput, ClientProfileOutput, ClientProfileUpdate
from app.agents.agent2_client_dna import ClientDNAAgent
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/clients", tags=["Clients & DNA Profile"])
client_dna_agent = ClientDNAAgent()


@router.post("", response_model=ClientProfileOutput, status_code=status.HTTP_201_CREATED)
async def create_or_generate_client(
    data: ClientProfileInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    output = await client_dna_agent.execute(data, db=db)
    return output


@router.get("", response_model=List[dict])
async def list_clients(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Client).offset(skip).limit(limit))
    clients = result.scalars().all()
    return [c.to_dict() for c in clients]


@router.get("/{client_id}", response_model=dict)
async def get_client(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client.to_dict()


@router.put("/{client_id}", response_model=dict)
async def update_client_profile(
    client_id: str,
    update_data: ClientProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    manually_edited = list(client.manually_edited_fields or [])

    if update_data.parent_company is not None:
        client.parent_company = update_data.parent_company
        if "parent_company" not in manually_edited:
            manually_edited.append("parent_company")

    if update_data.aliases is not None:
        client.aliases = update_data.aliases
        if "aliases" not in manually_edited:
            manually_edited.append("aliases")

    if update_data.subsidiaries is not None:
        client.subsidiaries = update_data.subsidiaries
        if "subsidiaries" not in manually_edited:
            manually_edited.append("subsidiaries")

    if update_data.key_executives is not None:
        client.key_executives = update_data.key_executives
        if "key_executives" not in manually_edited:
            manually_edited.append("key_executives")

    if update_data.industry_terms is not None:
        client.industry_terms = update_data.industry_terms
        if "industry_terms" not in manually_edited:
            manually_edited.append("industry_terms")

    client.manually_edited_fields = manually_edited
    client.last_edited_by = current_user.email

    await db.commit()
    await db.refresh(client)
    return client.to_dict()
