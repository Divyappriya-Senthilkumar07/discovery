from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.orchestrator.pipeline import PipelineOrchestrator, PipelineRunRequest, PipelineRunResult
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/pipeline", tags=["Pipeline Orchestrator"])
orchestrator = PipelineOrchestrator()


@router.post("/run", response_model=PipelineRunResult)
async def run_pipeline(
    request: PipelineRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await orchestrator.run(request, db=db)
    return result
