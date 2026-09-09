from typing import Optional, List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.agents.base import BaseAgent
from app.schemas.discovery import DiscoveryInput, DiscoveryOutput
from app.services.embedding_service import EmbeddingService
from app.models.client import Client
from app.models.article import Article
from app.core.logging import logger


class SemanticDiscoveryAgent(BaseAgent[DiscoveryInput, DiscoveryOutput]):
    name = "SemanticDiscoveryAgent"

    async def process(
        self,
        input_data: DiscoveryInput,
        db: Optional[AsyncSession] = None
    ) -> DiscoveryOutput:
        client_id = input_data.client_id
        top_k = input_data.top_k
        threshold = input_data.similarity_threshold

        if db is None:
            return DiscoveryOutput(candidate_article_ids=[], similarity_scores={})

        # 1. Fetch Client Profile from DB
        client_stmt = select(Client).where(Client.id == client_id)
        client = (await db.execute(client_stmt)).scalar_one_or_none()

        if not client:
            logger.warning("Client not found for semantic discovery", client_id=client_id)
            return DiscoveryOutput(candidate_article_ids=[], similarity_scores={})

        # 2. Construct rich contextual query representation from Client DNA
        aliases_str = " ".join(client.aliases or [])
        terms_str = " ".join(client.industry_terms or [])
        subs_str = " ".join(client.subsidiaries or [])
        parent_str = client.parent_company or ""
        
        query_text = f"{client.name} {parent_str} {aliases_str} {terms_str} {subs_str}".strip()
        client_vec = EmbeddingService.encode(query_text)

        # 3. Fetch all candidate articles from DB
        articles_stmt = select(Article)
        articles = (await db.execute(articles_stmt)).scalars().all()

        scored_candidates = []
        for article in articles:
            # Check or generate article embedding
            if article.embedding_json:
                article_vec = EmbeddingService.deserialize_vector(article.embedding_json)
            else:
                article_content = f"{article.title}. {article.body_text[:1000]}"
                article_vec = EmbeddingService.encode(article_content)
                article.embedding_json = EmbeddingService.serialize_vector(article_vec)
                db.add(article)

            sim = EmbeddingService.cosine_similarity(client_vec, article_vec)
            if sim >= threshold:
                scored_candidates.append((article.id, sim))

        await db.commit()

        # 4. Sort by highest similarity score
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        top_shortlist = scored_candidates[:top_k]

        candidate_ids = [item[0] for item in top_shortlist]
        similarity_scores = {item[0]: round(item[1], 4) for item in top_shortlist}

        logger.info(
            "Semantic discovery completed",
            client=client.name,
            total_articles=len(articles),
            matched=len(candidate_ids),
            threshold=threshold
        )

        return DiscoveryOutput(
            candidate_article_ids=candidate_ids,
            similarity_scores=similarity_scores
        )
