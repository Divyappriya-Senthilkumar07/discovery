from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/logs", tags=["Audit Logs & Explainability"])


@router.get("", response_model=List[dict])
async def query_audit_logs(
    client_id: Optional[str] = None,
    agent_name: Optional[str] = None,
    article_id: Optional[str] = None,
    min_confidence: Optional[float] = None,
    max_confidence: Optional[float] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Searchable audit trail of every agent decision with explainability scores and latencies.
    """
    query = select(AuditLog).order_by(desc(AuditLog.timestamp)).offset(skip).limit(limit)

    if client_id:
        query = query.where(AuditLog.client_id == client_id)
    if agent_name:
        query = query.where(AuditLog.agent_name == agent_name)
    if article_id:
        query = query.where(AuditLog.article_id == article_id)
    if min_confidence is not None:
        query = query.where(AuditLog.confidence >= min_confidence)
    if max_confidence is not None:
        query = query.where(AuditLog.confidence <= max_confidence)
    if search:
        query = query.where(
            (AuditLog.explanation.ilike(f"%{search}%")) |
            (AuditLog.input_summary.ilike(f"%{search}%")) |
            (AuditLog.output_summary.ilike(f"%{search}%"))
        )

    result = await db.execute(query)
    logs = result.scalars().all()
    return [log.to_dict() for log in logs]


@router.get("/stats")
async def get_audit_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import func
    total_logs = (await db.execute(select(func.count(AuditLog.id)))).scalar() or 0
    avg_latency = (await db.execute(select(func.avg(AuditLog.latency_ms)))).scalar() or 0.0
    return {
        "total_agent_decisions": total_logs,
        "average_decision_latency_ms": round(float(avg_latency), 2)
    }
