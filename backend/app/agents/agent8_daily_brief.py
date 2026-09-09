import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.agents.base import BaseAgent
from app.schemas.briefs import BriefEntry, BriefGenerateRequest
from app.models.article import Article
from app.models.brief import Brief
from app.services.embedding_service import EmbeddingService
from app.core.logging import logger


class DailyBriefAgent(BaseAgent[BriefGenerateRequest, List[BriefEntry]]):
    name = "DailyBriefAgent"

    async def cluster_and_summarize(
        self,
        client_id: str,
        articles: List[Article],
        db: Optional[AsyncSession] = None,
        cluster_threshold: float = 0.68,
        outlier_threshold: float = 0.45
    ) -> List[BriefEntry]:
        if not articles:
            return []

        # 1. Compute embeddings for all articles
        texts = [f"{a.title}. {a.body_text[:500]}" for a in articles]
        vectors = EmbeddingService.encode(texts)

        # 2. Pairwise similarity matrix
        n = len(articles)
        sim_matrix = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i == j:
                    sim_matrix[i][j] = 1.0
                else:
                    sim_matrix[i][j] = EmbeddingService.cosine_similarity(vectors[i], vectors[j])

        # 3. Agglomerative clustering into near-duplicate groups
        visited: Set[int] = set()
        clusters: List[List[int]] = []

        for i in range(n):
            if i in visited:
                continue
            # Find all near-duplicate articles matching article i
            group = [i]
            visited.add(i)
            for j in range(i + 1, n):
                if j not in visited and sim_matrix[i][j] >= cluster_threshold:
                    group.append(j)
                    visited.add(j)
            clusters.append(group)

        # Sort clusters by size (largest syndication clusters first)
        clusters.sort(key=lambda c: len(c), reverse=True)

        results: List[BriefEntry] = []
        now = datetime.now(timezone.utc)

        # If there is a dominant main cluster and singletons
        if clusters:
            main_cluster_indices = clusters[0]
            main_articles = [articles[idx] for idx in main_cluster_indices]

            # Sources contributing to main syndicated coverage
            sources = list({a.domain for a in main_articles})

            # Check other clusters for genuinely distinct angle outliers
            outliers: List[str] = []
            for other_cluster in clusters[1:]:
                for idx in other_cluster:
                    art = articles[idx]
                    # Compute max similarity to main cluster
                    max_sim_to_main = max(sim_matrix[idx][m_idx] for m_idx in main_cluster_indices)
                    if max_sim_to_main < cluster_threshold:
                        outliers.append(art.id)

            # Representative headline: pick most informative/longest title in main cluster
            rep_art = max(main_articles, key=lambda a: len(a.title))
            rep_headline = rep_art.title

            summary = (
                f"Consolidated media coverage from {len(main_articles)} outlets detailing {rep_art.title}. "
                f"Syndicated reporting confirms key developments across regional market ecosystems."
            )

            cluster_id = f"cluster-{uuid.uuid4().hex[:8]}"

            entry = BriefEntry(
                story_cluster_id=cluster_id,
                representative_headline=rep_headline,
                summary=summary,
                contributing_sources=sources,
                outlier_articles=outliers,
                client_id=client_id,
                generated_at=now
            )
            results.append(entry)

            # Persist to database if db provided
            if db is not None:
                brief_record = Brief(
                    story_cluster_id=cluster_id,
                    client_id=client_id,
                    representative_headline=rep_headline,
                    summary=summary,
                    contributing_sources=sources,
                    outlier_articles=outliers,
                    article_ids=[a.id for a in main_articles],
                    generated_at=now
                )
                db.add(brief_record)
                await db.commit()

        return results

    async def process(
        self,
        input_data: BriefGenerateRequest,
        db: Optional[AsyncSession] = None
    ) -> List[BriefEntry]:
        if db is None:
            return []

        # Fetch articles
        if input_data.article_ids:
            stmt = select(Article).where(Article.id.in_(input_data.article_ids))
        else:
            stmt = select(Article).limit(20)

        articles = (await db.execute(stmt)).scalars().all()
        return await self.cluster_and_summarize(input_data.client_id, list(articles), db=db)
