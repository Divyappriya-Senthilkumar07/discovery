import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Integer, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="Custom Business Rule")
    natural_language_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    geography: Mapped[List[str]] = mapped_column(JSON, default=list)
    domain_tiers: Mapped[List[str]] = mapped_column(JSON, default=list)
    recency_hours: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mandatory_terms: Mapped[List[str]] = mapped_column(JSON, default=list)
    excluded_terms: Mapped[List[str]] = mapped_column(JSON, default=list)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "client_id": self.client_id,
            "name": self.name,
            "natural_language_text": self.natural_language_text,
            "geography": self.geography or [],
            "domain_tiers": self.domain_tiers or [],
            "recency_hours": self.recency_hours,
            "mandatory_terms": self.mandatory_terms or [],
            "excluded_terms": self.excluded_terms or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
