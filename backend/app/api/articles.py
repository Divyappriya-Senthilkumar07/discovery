from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.db.session import get_db
from app.models.article import Article
from app.schemas.extraction import ExtractionInput, ExtractionOutput
from app.agents.agent1_extraction import ExtractionAgent
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/articles", tags=["Articles & Extraction"])
extraction_agent = ExtractionAgent()


@router.post("/extract", response_model=ExtractionOutput)
async def extract_article(
    data: ExtractionInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    output = await extraction_agent.execute(data, db=db)
    return output


@router.get("", response_model=List[dict])
async def list_articles(
    skip: int = 0,
    limit: int = 50,
    domain: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Article).order_by(desc(Article.created_at)).offset(skip).limit(limit)
    if domain:
        query = query.where(Article.domain == domain)
    result = await db.execute(query)
    articles = result.scalars().all()
    return [a.to_dict() for a in articles]


@router.get("/{article_id}")
async def get_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article.to_dict()
