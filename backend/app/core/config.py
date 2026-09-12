from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Discover"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./context_engine.db"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "context_engine"
    POSTGRES_PORT: int = 5432

    # Authentication
    JWT_SECRET: str = "context-engine-dev-secret-key-32chars-min-replace-in-prod"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # LLM Providers (Gemini Primary, Groq Fallback)
    LLM_PROVIDER: str = "gemini"  # "gemini" or "groq"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Embeddings & Discovery
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    SIMILARITY_THRESHOLD: float = 0.65
    TOP_K_DISCOVERY: int = 50

    # Validation Confidence Routing
    AUTO_ACCEPT_THRESHOLD: float = 0.85
    REJECT_THRESHOLD: float = 0.50

    # Rule Engine Defaults
    RECENCY_WINDOW_HOURS: int = 168  # 7 days

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
