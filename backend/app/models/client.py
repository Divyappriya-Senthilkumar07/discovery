import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    seed_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    seed_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    
    parent_company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    aliases: Mapped[List[str]] = mapped_column(JSON, default=list)
    subsidiaries: Mapped[List[str]] = mapped_column(JSON, default=list)
    key_executives: Mapped[List[str]] = mapped_column(JSON, default=list)
    industry_terms: Mapped[List[str]] = mapped_column(JSON, default=list)
    
    # Tracking fields that were manually customized by an analyst
    manually_edited_fields: Mapped[List[str]] = mapped_column(JSON, default=list)
    last_edited_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "client_id": self.id,
            "id": self.id,
            "name": self.name,
            "seed_description": self.seed_description,
            "seed_url": self.seed_url,
            "aliases": self.aliases or [],
            "parent_company": self.parent_company,
            "subsidiaries": self.subsidiaries or [],
            "key_executives": self.key_executives or [],
            "industry_terms": self.industry_terms or [],
            "manually_edited_fields": self.manually_edited_fields or [],
            "last_edited_by": self.last_edited_by,
            "generated_at": self.generated_at.isoformat() if self.generated_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
