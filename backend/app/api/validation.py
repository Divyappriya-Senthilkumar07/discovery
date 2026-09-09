from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.validation import ValidationInput, ValidationOutput
from app.agents.agent4_contextual_validation import ContextualValidationAgent
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/validation", tags=["Contextual Validation"])
validation_agent = ContextualValidationAgent()


@router.post("/validate", response_model=ValidationOutput)
async def validate_article_context(
    data: ValidationInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    output = await validation_agent.execute(data, db=db, article_id=data.article_id, client_id=data.client_id)
    return output
