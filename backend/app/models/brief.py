import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class Brief(Base):
    __tablename__ = "briefs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    story_cluster_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    representative_headline: Mapped[str] = mapped_column(String(512), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    contributing_sources: Mapped[List[str]] = mapped_column(JSON, default=list)
    outlier_articles: Mapped[List[str]] = mapped_column(JSON, default=list)
    article_ids: Mapped[List[str]] = mapped_column(JSON, default=list)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "story_cluster_id": self.story_cluster_id,
            "client_id": self.client_id,
            "representative_headline": self.representative_headline,
            "summary": self.summary,
            "contributing_sources": self.contributing_sources or [],
            "outlier_articles": self.outlier_articles or [],
            "article_ids": self.article_ids or [],
            "generated_at": self.generated_at.isoformat() if self.generated_at else None,
        }
