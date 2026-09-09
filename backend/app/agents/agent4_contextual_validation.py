from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.base import BaseAgent
from app.schemas.validation import ValidationInput, ValidationOutput
from app.services.llm_service import LLMService
from app.core.config import settings
from app.core.logging import logger


class ContextualValidationAgent(BaseAgent[ValidationInput, ValidationOutput]):
    name = "ContextualValidationAgent"

    async def process(
        self,
        input_data: ValidationInput,
        db: Optional[AsyncSession] = None
    ) -> ValidationOutput:
        client = input_data.client_context
        article_text = input_data.article_text[:3000]

        prompt = f"""
        Perform rigorous contextual disambiguation to determine if the following article is genuinely relevant to the target enterprise client.

        Target Client:
        - Client ID: {client.client_id}
        - Parent Company: {client.parent_company or 'None'}
        - Aliases: {', '.join(client.aliases)}
        - Subsidiaries: {', '.join(client.subsidiaries)}
        - Industry Terms: {', '.join(client.industry_terms)}

        Article Text Excerpt:
        \"\"\"{article_text}\"\"\"

        Evaluate whether the article is:
        - relevant: Directly or substantially covers the client's business, parent company, executives, or products.
        - not_relevant: False positive or homonym (e.g. entities sharing names with agricultural produce, geographic features, or linguistic idioms).
        - needs_review: Ambiguous, indirect, or edge case requiring human judgment.

        Provide:
        - verdict: 'relevant', 'not_relevant', or 'needs_review'
        - confidence: float between 0.0 and 1.0 (calibrated: >0.85 for clear match, <0.50 for clear mismatch, 0.50-0.85 for borderline)
        - explanation: Exactly one concise, factual sentence citing the specific disambiguating context.
        """

        system_instruction = "You are a Senior Media Intelligence Disambiguation Analyst. Eliminate false positives and homonyms with precision."
        result = await LLMService.generate_json(prompt, system_instruction=system_instruction)

        raw_verdict = result.get("verdict", "needs_review")
        confidence = float(result.get("confidence", 0.65))
        explanation = result.get("explanation", "Evaluated against client contextual profile.")

        # Confidence routing as specified:
        # >0.85 auto-accept, 0.5–0.85 route to analyst review queue, <0.5 auto-reject
        if confidence > settings.AUTO_ACCEPT_THRESHOLD and raw_verdict != "not_relevant":
            final_verdict = "relevant"
        elif confidence < settings.REJECT_THRESHOLD or raw_verdict == "not_relevant":
            final_verdict = "not_relevant"
            if confidence > 0.5:
                confidence = 0.45  # Align with rejection threshold
        else:
            final_verdict = "needs_review"

        logger.info(
            "Contextual validation completed",
            article_id=input_data.article_id,
            verdict=final_verdict,
            confidence=confidence,
            explanation=explanation[:80]
        )

        return ValidationOutput(
            article_id=input_data.article_id,
            verdict=final_verdict,
            confidence=round(confidence, 2),
            explanation=explanation
        )
