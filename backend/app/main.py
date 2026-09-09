from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.db.session import init_db
from app.db.seed import seed_demo_data
from app.api.auth import router as auth_router
from app.api.articles import router as articles_router
from app.api.clients import router as clients_router
from app.api.validation import router as validation_router
from app.api.rules import router as rules_router
from app.api.pipeline import router as pipeline_router
from app.api.sources import router as sources_router
from app.api.briefs import router as briefs_router
from app.api.logs import router as logs_router
from app.api.benchmark import router as benchmark_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Starting Context Engine backend", version=settings.VERSION)
    await init_db()
    await seed_demo_data()
    yield
    logger.info("Shutting down Context Engine backend")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(articles_router, prefix=settings.API_V1_STR)
app.include_router(clients_router, prefix=settings.API_V1_STR)
app.include_router(validation_router, prefix=settings.API_V1_STR)
app.include_router(rules_router, prefix=settings.API_V1_STR)
app.include_router(pipeline_router, prefix=settings.API_V1_STR)
app.include_router(sources_router, prefix=settings.API_V1_STR)
app.include_router(briefs_router, prefix=settings.API_V1_STR)
app.include_router(logs_router, prefix=settings.API_V1_STR)
app.include_router(benchmark_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["System"])
async def health():
    return {
        "status": "ok",
        "service": "context-engine",
        "version": settings.VERSION,
        "llm_provider": settings.LLM_PROVIDER
    }
