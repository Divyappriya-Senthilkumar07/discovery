from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.brief import Brief
from app.schemas.briefs import BriefEntry, BriefGenerateRequest
from app.agents.agent8_daily_brief import DailyBriefAgent
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/briefs", tags=["Daily Briefs & Clustering"])
brief_agent = DailyBriefAgent()


@router.post("/generate", response_model=List[BriefEntry])
async def generate_daily_brief(
    request: BriefGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    output = await brief_agent.execute(request, db=db, client_id=request.client_id)
    return output


@router.get("/client/{client_id}", response_model=List[dict])
async def get_client_briefs(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Brief).where(Brief.client_id == client_id).order_by(desc(Brief.generated_at)))
    briefs = result.scalars().all()
    return [b.to_dict() for b in briefs]
