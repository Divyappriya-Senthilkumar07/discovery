import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.agents.base import BaseAgent
from app.schemas.extraction import ExtractionInput, ExtractionOutput
from app.services.extraction_service import ExtractionService
from app.models.article import Article
from app.core.logging import logger


class ExtractionAgent(BaseAgent[ExtractionInput, ExtractionOutput]):
    name = "ExtractionAgent"

    async def process(
        self,
        input_data: ExtractionInput,
        db: Optional[AsyncSession] = None
    ) -> ExtractionOutput:
        norm_url = ExtractionService.normalize_url(input_data.source_url)
        
        # 1. Run fallback chain extraction
        extracted = await ExtractionService.extract(
            url=norm_url,
            source_type=input_data.source_type,
            raw_content=input_data.raw_content
        )

        title = extracted.get("title", "")
        body_text = extracted.get("body_text", "")
        domain = extracted.get("domain", ExtractionService.extract_domain(norm_url))
        extraction_method = extracted.get("extraction_method", "static_html")
        status = extracted.get("status", "success")

        content_hash = ExtractionService.compute_content_hash(norm_url, body_text)

        # 2. Deduplication check: reject duplicate URLs/hashes before insert
        article_id = None
        if db is not None:
            stmt = select(Article).where(
                (Article.content_hash == content_hash) | (Article.url == norm_url)
            )
            existing_article = (await db.execute(stmt)).scalar_one_or_none()

            if existing_article:
                logger.info("Duplicate article rejected before insert", url=norm_url, hash=content_hash)
                # Return existing record
                return ExtractionOutput(
                    article_id=existing_article.id,
                    title=existing_article.title,
                    body_text=existing_article.body_text,
                    author=existing_article.author,
                    published_at=existing_article.published_at,
                    domain=existing_article.domain,
                    extraction_method=existing_article.extraction_method, # type: ignore
                    status=existing_article.status # type: ignore
                )

            # Insert new article
            article_id = str(uuid.uuid4())
            new_article = Article(
                id=article_id,
                content_hash=content_hash,
                url=norm_url,
                title=title,
                body_text=body_text,
                author=extracted.get("author"),
                published_at=extracted.get("published_at"),
                domain=domain,
                extraction_method=extraction_method,
                status=status
            )
            db.add(new_article)
            await db.commit()
            await db.refresh(new_article)
        else:
            article_id = str(uuid.uuid4())

        return ExtractionOutput(
            article_id=article_id,
            title=title,
            body_text=body_text,
            author=extracted.get("author"),
            published_at=extracted.get("published_at"),
            domain=domain,
            extraction_method=extraction_method,  # type: ignore
            status=status  # type: ignore
        )
