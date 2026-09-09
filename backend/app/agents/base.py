import time
from abc import ABC, abstractmethod
from typing import Any, Optional, TypeVar, Generic
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import logger
from app.services.audit_service import AuditService

InputType = TypeVar("InputType", bound=BaseModel)
OutputType = TypeVar("OutputType", bound=BaseModel)


class BaseAgent(ABC, Generic[InputType, OutputType]):
    """
    Base contract for all 8 agents in Context Engine.
    Enforces process(input_data) -> output_data with standard error handling,
    latency tracking, and audit log persistence.
    """
    name: str = "BaseAgent"

    @abstractmethod
    async def process(self, input_data: InputType, db: Optional[AsyncSession] = None) -> OutputType:
        """
        Subclasses must implement their core logic here.
        """
        pass

    async def execute(
        self,
        input_data: InputType,
        db: Optional[AsyncSession] = None,
        article_id: Optional[str] = None,
        client_id: Optional[str] = None,
    ) -> OutputType:
        """
        Public wrapper around process that records latency, logs errors,
        and ensures all agent decisions are committed to audit_log.
        """
        start_time = time.perf_counter()
        input_summary = str(input_data.model_dump())[:500] if hasattr(input_data, "model_dump") else str(input_data)[:500]
        
        try:
            output = await self.process(input_data, db=db)
            latency_ms = (time.perf_counter() - start_time) * 1000

            # Extract confidence and explanation if present on output schema
            confidence = getattr(output, "confidence", None)
            explanation = getattr(output, "explanation", None)
            
            if hasattr(output, "model_dump"):
                output_summary = str(output.model_dump())[:500]
            elif isinstance(output, list):
                dumped = [item.model_dump() if hasattr(item, "model_dump") else item for item in output]
                output_summary = str(dumped)[:500]
                if output and hasattr(output[0], "explanation"):
                    explanation = getattr(output[0], "explanation", None)
                if output and hasattr(output[0], "confidence"):
                    confidence = getattr(output[0], "confidence", None)
            else:
                output_summary = str(output)[:500]

            # Try to infer article_id or client_id from input/output if not provided
            inferred_article_id = article_id or getattr(input_data, "article_id", None) or getattr(output, "article_id", None)
            inferred_client_id = client_id or getattr(input_data, "client_id", None) or getattr(output, "client_id", None)

            await AuditService.log_agent_decision(
                agent_name=self.name,
                input_summary=input_summary,
                output_summary=output_summary,
                article_id=str(inferred_article_id) if inferred_article_id else None,
                client_id=str(inferred_client_id) if inferred_client_id else None,
                confidence=confidence,
                explanation=explanation,
                latency_ms=latency_ms,
                db=db
            )
            return output
        except Exception as exc:
            latency_ms = (time.perf_counter() - start_time) * 1000
            logger.error("Agent execution failed", agent=self.name, error=str(exc), latency_ms=latency_ms)
            
            await AuditService.log_agent_decision(
                agent_name=self.name,
                input_summary=input_summary,
                output_summary=f"ERROR: {str(exc)}",
                article_id=str(article_id) if article_id else None,
                client_id=str(client_id) if client_id else None,
                confidence=0.0,
                explanation=f"Agent execution encountered an exception: {str(exc)}",
                latency_ms=latency_ms,
                db=db
            )
            raise
