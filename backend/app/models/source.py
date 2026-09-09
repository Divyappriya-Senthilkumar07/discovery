from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Float, Boolean, DateTime, Text, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class DiscoveredSource(Base):
    __tablename__ = "discovered_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    domain: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    example_article_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    matched_client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending_review", nullable=False)  # pending_review, approved, rejected
    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "proposed_domain": self.domain,
            "domain": self.domain,
            "example_article_url": self.example_article_url,
            "matched_client_id": self.matched_client_id,
            "reason": self.reason,
            "status": self.status,
            "discovered_at": self.discovered_at.isoformat() if self.discovered_at else None,
        }


class DomainCredibility(Base):
    __tablename__ = "domain_credibility"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    domain: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    credibility_score: Mapped[float] = mapped_column(Float, nullable=False)
    tier: Mapped[str] = mapped_column(String(10), nullable=False)  # tier1, tier2, tier3
    signals_used: Mapped[List[str]] = mapped_column(JSON, default=list)
    manually_overridden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_updated: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "domain": self.domain,
            "credibility_score": self.credibility_score,
            "tier": self.tier,
            "signals_used": self.signals_used or [],
            "manually_overridden": self.manually_overridden,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
        }
