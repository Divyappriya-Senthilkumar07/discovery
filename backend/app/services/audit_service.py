from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import logger
from app.models.audit_log import AuditLog
from app.db.session import AsyncSessionLocal


class AuditService:
    @staticmethod
    async def log_agent_decision(
        agent_name: str,
        input_summary: str,
        output_summary: str,
        article_id: Optional[str] = None,
        client_id: Optional[str] = None,
        confidence: Optional[float] = None,
        explanation: Optional[str] = None,
        latency_ms: float = 0.0,
        db: Optional[AsyncSession] = None
    ) -> AuditLog:
        """
        Record every agent decision into the dedicated audit_log table.
        This provides explainability, confidence scoring, and end-to-end traceability.
        """
        audit_entry = AuditLog(
            timestamp=datetime.now(timezone.utc),
            agent_name=agent_name,
            article_id=article_id,
            client_id=client_id,
            input_summary=input_summary[:1000] if input_summary else "",
            output_summary=output_summary[:1000] if output_summary else "",
            confidence=confidence,
            explanation=explanation,
            latency_ms=round(latency_ms, 2)
        )

        logger.info(
            "Agent executed",
            agent=agent_name,
            article_id=article_id,
            client_id=client_id,
            confidence=confidence,
            latency_ms=latency_ms,
            explanation=explanation[:100] if explanation else None
        )

        # Persist to database
        if db is not None:
            db.add(audit_entry)
            await db.commit()
            await db.refresh(audit_entry)
        else:
            async with AsyncSessionLocal() as session:
                session.add(audit_entry)
                await session.commit()
                await session.refresh(audit_entry)

        return audit_entry
