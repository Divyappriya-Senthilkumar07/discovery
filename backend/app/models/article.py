import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, Text, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    content_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    url: Mapped[str] = mapped_column(String(2048), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    body_text: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    domain: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    extraction_method: Mapped[str] = mapped_column(String(30), nullable=False)  # "rss", "static_html", "headless_browser"
    status: Mapped[str] = mapped_column(String(30), default="success", nullable=False)  # "success", "degraded", "failed"
    embedding_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON-encoded vector fallback for sqlite
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "article_id": self.id,
            "content_hash": self.content_hash,
            "url": self.url,
            "title": self.title,
            "body_text": self.body_text,
            "author": self.author,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "domain": self.domain,
            "extraction_method": self.extraction_method,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
