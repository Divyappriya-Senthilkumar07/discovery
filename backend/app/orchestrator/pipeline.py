import uuid
import time
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.schemas.extraction import ExtractionInput, ExtractionOutput
from app.schemas.client_profile import ClientProfileInput, ClientProfileOutput
from app.schemas.validation import ValidationInput, ValidationOutput
from app.schemas.rules import RuleFilter
from app.agents.agent1_extraction import ExtractionAgent
from app.agents.agent2_client_dna import ClientDNAAgent
from app.agents.agent3_semantic_discovery import SemanticDiscoveryAgent
from app.agents.agent4_contextual_validation import ContextualValidationAgent
from app.agents.agent5_rule_engine import RuleEngineAgent
from app.models.client import Client
from app.models.article import Article
from app.models.rule import Rule
from app.services.embedding_service import EmbeddingService
from app.services.audit_service import AuditService
from app.core.logging import logger


class PipelineRunRequest(BaseModel):
    source_url: str
    client_id: str
    source_type: str = "manual"
    raw_content: Optional[str] = None


class PipelineRunResult(BaseModel):
    run_id: str
    article_id: str
    client_id: str
    title: str
    semantic_similarity: float
    verdict: str  # "relevant", "not_relevant", "needs_review"
    confidence: float
    explanation: str
    passed_rules: bool
    rule_reasons: List[str]
    stage_latencies: Dict[str, float]
    total_latency_ms: float


class PipelineOrchestrator:
    def __init__(self):
        self.extraction_agent = ExtractionAgent()
        self.client_dna_agent = ClientDNAAgent()
        self.discovery_agent = SemanticDiscoveryAgent()
        self.validation_agent = ContextualValidationAgent()
        self.rule_engine = RuleEngineAgent()

    async def run(
        self,
        request: PipelineRunRequest,
        db: AsyncSession
    ) -> PipelineRunResult:
        run_id = str(uuid.uuid4())
        total_start = time.perf_counter()
        stage_latencies: Dict[str, float] = {}

        logger.info("Pipeline run started", run_id=run_id, url=request.source_url, client_id=request.client_id)

        # ----------------------------------------------------
        # STAGE 1: EXTRACTION AGENT
        # ----------------------------------------------------
        t0 = time.perf_counter()
        extract_in = ExtractionInput(
            source_url=request.source_url,
            source_type=request.source_type, # type: ignore
            raw_content=request.raw_content
        )
        extract_out: ExtractionOutput = await self.extraction_agent.execute(
            extract_in,
            db=db,
            client_id=request.client_id
        )
        stage_latencies["extraction_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        article_id = extract_out.article_id

        # ----------------------------------------------------
        # STAGE 2: CLIENT DNA PROFILE LOOKUP
        # ----------------------------------------------------
        t1 = time.perf_counter()
        client_stmt = select(Client).where(Client.id == request.client_id)
        client = (await db.execute(client_stmt)).scalar_one_or_none()

        if not client:
            # Generate on the fly if not yet in DB
            client_dna_in = ClientProfileInput(client_name=request.client_id)
            client_out: ClientProfileOutput = await self.client_dna_agent.execute(
                client_dna_in,
                db=db,
                client_id=request.client_id
            )
        else:
            client_out = ClientProfileOutput(
                client_id=client.id,
                aliases=client.aliases or [],
                parent_company=client.parent_company,
                subsidiaries=client.subsidiaries or [],
                key_executives=client.key_executives or [],
                industry_terms=client.industry_terms or [],
                generated_at=client.generated_at,
                last_edited_by=client.last_edited_by
            )
        stage_latencies["client_dna_ms"] = round((time.perf_counter() - t1) * 1000, 2)

        # ----------------------------------------------------
        # STAGE 3: SEMANTIC DISCOVERY (VECTOR SIMILARITY PRE-FILTER)
        # ----------------------------------------------------
        t2 = time.perf_counter()
        # Compute cosine similarity between client DNA and this extracted article
        query_text = f"{client_out.client_id} {client_out.parent_company or ''} {' '.join(client_out.aliases)} {' '.join(client_out.industry_terms)}"
        client_vec = EmbeddingService.encode(query_text)

        article_content = f"{extract_out.title}. {extract_out.body_text[:1000]}"
        article_vec = EmbeddingService.encode(article_content)
        similarity = float(EmbeddingService.cosine_similarity(client_vec, article_vec))

        await AuditService.log_agent_decision(
            agent_name="SemanticDiscoveryAgent",
            input_summary=f"Vector similarity calculation for article: {extract_out.title[:80]}",
            output_summary=f"Cosine similarity score: {similarity:.4f}",
            article_id=article_id,
            client_id=request.client_id,
            confidence=similarity,
            explanation=f"Computed cosine vector similarity of {similarity:.4f} between Client DNA and article text.",
            latency_ms=(time.perf_counter() - t2) * 1000,
            db=db
        )
        stage_latencies["semantic_discovery_ms"] = round((time.perf_counter() - t2) * 1000, 2)

        # ----------------------------------------------------
        # STAGE 4: CONTEXTUAL VALIDATION AGENT (LLM DISAMBIGUATION)
        # ----------------------------------------------------
        t3 = time.perf_counter()
        val_in = ValidationInput(
            article_id=article_id,
            client_id=request.client_id,
            article_text=f"{extract_out.title}\n\n{extract_out.body_text}",
            client_context=client_out
        )
        val_out: ValidationOutput = await self.validation_agent.execute(
            val_in,
            db=db,
            article_id=article_id,
            client_id=request.client_id
        )
        stage_latencies["contextual_validation_ms"] = round((time.perf_counter() - t3) * 1000, 2)

        # ----------------------------------------------------
        # STAGE 5: RULE ENGINE AGENT (BUSINESS HARD FILTERS)
        # ----------------------------------------------------
        t4 = time.perf_counter()
        rules_stmt = select(Rule).where(Rule.client_id == request.client_id)
        rules = (await db.execute(rules_stmt)).scalars().all()

        article_record = (await db.execute(select(Article).where(Article.id == article_id))).scalar_one()

        passed_all_rules = True
        rule_reasons = []

        for r in rules:
            r_filter = RuleFilter(
                client_id=r.client_id,
                geography=r.geography or [],
                domain_tiers=r.domain_tiers or [],
                recency_hours=r.recency_hours,
                mandatory_terms=r.mandatory_terms or [],
                excluded_terms=r.excluded_terms or []
            )
            passed = self.rule_engine.evaluate_article(article_record, r_filter)
            if not passed:
                passed_all_rules = False
                rule_reasons.append(f"Failed rule '{r.name}'")

        if not rules:
            rule_reasons.append("No custom client rules configured (default allow)")

        await AuditService.log_agent_decision(
            agent_name="RuleEngineAgent",
            input_summary=f"Evaluated {len(rules)} business rules on article {article_id}",
            output_summary=f"Rule evaluation: passed={passed_all_rules}, reasons={rule_reasons}",
            article_id=article_id,
            client_id=request.client_id,
            confidence=1.0 if passed_all_rules else 0.0,
            explanation="; ".join(rule_reasons),
            latency_ms=(time.perf_counter() - t4) * 1000,
            db=db
        )
        stage_latencies["rule_engine_ms"] = round((time.perf_counter() - t4) * 1000, 2)

        total_latency_ms = round((time.perf_counter() - total_start) * 1000, 2)

        logger.info(
            "Pipeline run finished",
            run_id=run_id,
            verdict=val_out.verdict,
            confidence=val_out.confidence,
            passed_rules=passed_all_rules,
            total_latency_ms=total_latency_ms
        )

        return PipelineRunResult(
            run_id=run_id,
            article_id=article_id,
            client_id=request.client_id,
            title=extract_out.title,
            semantic_similarity=round(similarity, 4),
            verdict=val_out.verdict,
            confidence=val_out.confidence,
            explanation=val_out.explanation,
            passed_rules=passed_all_rules,
            rule_reasons=rule_reasons,
            stage_latencies=stage_latencies,
            total_latency_ms=total_latency_ms
        )
