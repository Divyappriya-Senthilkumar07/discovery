import asyncio
import sys
from datetime import datetime, timezone
from sqlalchemy import select
from app.db.session import AsyncSessionLocal, init_db
from app.models.client import Client
from app.orchestrator.pipeline import PipelineOrchestrator, PipelineRunRequest
from app.core.logging import setup_logging, logger

# Sample active feed queue for background polling
SAMPLE_FEEDS = [
    {
        "url": "https://techwire.io/stories/fintech-instant-credit-launch",
        "client_name": "PayU",
        "type": "rss"
    },
    {
        "url": "https://venturebeat.com/ai/enterprise-models-benchmark",
        "client_name": "Apple",
        "type": "manual"
    }
]


async def run_worker_loop(poll_interval_seconds: int = 30):
    setup_logging()
    logger.info("Starting Discover Background Worker Loop", poll_interval=poll_interval_seconds)
    await init_db()
    orchestrator = PipelineOrchestrator()

    try:
        while True:
            logger.info("Worker polling cycle starting...", timestamp=datetime.now(timezone.utc).isoformat())
            
            async with AsyncSessionLocal() as db:
                clients = (await db.execute(select(Client))).scalars().all()
                if not clients:
                    logger.info("No clients configured yet in DB. Sleeping...")
                else:
                    for feed in SAMPLE_FEEDS:
                        # Find client or match first
                        matched_client = next((c for c in clients if feed["client_name"].lower() in c.name.lower()), clients[0])
                        try:
                            logger.info("Worker dispatching article through pipeline", url=feed["url"], client=matched_client.name)
                            req = PipelineRunRequest(
                                source_url=feed["url"],
                                client_id=matched_client.id,
                                source_type=feed["type"]
                            )
                            result = await orchestrator.run(req, db=db)
                            logger.info(
                                "Worker processed article",
                                article_id=result.article_id,
                                verdict=result.verdict,
                                latency_ms=result.total_latency_ms
                            )
                        except Exception as e:
                            logger.error("Worker failed processing item", url=feed["url"], error=str(e))

            logger.info(f"Worker cycle complete. Waiting {poll_interval_seconds}s...")
            await asyncio.sleep(poll_interval_seconds)
    except asyncio.CancelledError:
        logger.info("Worker received shutdown signal. Exiting gracefully.")


if __name__ == "__main__":
    try:
        asyncio.run(run_worker_loop())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user.")
