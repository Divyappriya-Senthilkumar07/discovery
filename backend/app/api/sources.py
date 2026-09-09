from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.source import DiscoveredSource, DomainCredibility
from app.schemas.sources import SourceDiscoveryInput, SourceDiscoveryOutput, SourceStatusUpdate
from app.schemas.credibility import CredibilityInput, CredibilityOutput, CredibilityOverride
from app.agents.agent6_source_discovery import SourceDiscoveryAgent
from app.agents.agent7_source_credibility import SourceCredibilityAgent
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/sources", tags=["Sources & Credibility"])
discovery_agent = SourceDiscoveryAgent()
credibility_agent = SourceCredibilityAgent()


@router.post("/discover", response_model=SourceDiscoveryOutput)
async def trigger_source_discovery(
    data: SourceDiscoveryInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    output = await discovery_agent.execute(data, db=db, client_id=data.client_id)
    return output


@router.get("/discovered", response_model=List[dict])
async def list_discovered_sources(
    status_filter: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(DiscoveredSource).order_by(desc(DiscoveredSource.discovered_at))
    if status_filter:
        query = query.where(DiscoveredSource.status == status_filter)
    result = await db.execute(query)
    sources = result.scalars().all()
    return [s.to_dict() for s in sources]


@router.patch("/discovered/{source_id}/status")
async def update_discovered_source_status(
    source_id: int,
    update: SourceStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(DiscoveredSource).where(DiscoveredSource.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovered source not found")
    source.status = update.status
    await db.commit()
    return {"message": f"Source {source.domain} marked as {update.status}", "status": source.status}


@router.get("/credibility", response_model=List[dict])
async def list_domain_credibility(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(DomainCredibility).order_by(desc(DomainCredibility.credibility_score)))
    records = result.scalars().all()
    return [r.to_dict() for r in records]


@router.post("/credibility/score", response_model=CredibilityOutput)
async def get_or_calculate_domain_credibility(
    data: CredibilityInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await credibility_agent.execute(data, db=db)


@router.post("/credibility/override", response_model=CredibilityOutput)
async def override_domain_credibility(
    override: CredibilityOverride,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return await credibility_agent.override_credibility(override, db=db)
