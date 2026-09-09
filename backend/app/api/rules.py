from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.rule import Rule
from app.schemas.rules import RuleFilter, RuleParseRequest, RulePreviewResponse, RuleSaveRequest
from app.agents.agent5_rule_engine import RuleEngineAgent
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/rules", tags=["Rule Engine"])
rule_agent = RuleEngineAgent()


@router.post("/parse", response_model=RuleFilter)
async def parse_natural_language_rule(
    request: RuleParseRequest,
    current_user: User = Depends(get_current_user)
):
    filter_data = await rule_agent.parse_natural_language(request)
    return filter_data


@router.post("/preview", response_model=RulePreviewResponse)
async def preview_rule(
    rule_filter: RuleFilter,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await rule_agent.execute(rule_filter, db=db, client_id=rule_filter.client_id)
    return result


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def save_rule(
    request: RuleSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_rule = Rule(
        client_id=request.client_id,
        name=request.name,
        natural_language_text=request.natural_language_text,
        geography=request.filter_data.geography,
        domain_tiers=request.filter_data.domain_tiers,
        recency_hours=request.filter_data.recency_hours,
        mandatory_terms=request.filter_data.mandatory_terms,
        excluded_terms=request.filter_data.excluded_terms
    )
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)
    return new_rule.to_dict()


@router.get("/client/{client_id}", response_model=List[dict])
async def get_client_rules(
    client_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Rule).where(Rule.client_id == client_id))
    rules = result.scalars().all()
    return [r.to_dict() for r in rules]


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    await db.delete(rule)
    await db.commit()
    return None

