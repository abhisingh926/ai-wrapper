from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from typing import List, Optional


INSECURE_DEFAULTS = {
    "change-me-in-production-use-a-strong-random-key",
    "change-me-use-fernet-key",
    "CHANGE_ME_GENERATE_A_STRONG_KEY",
    "CHANGE_ME_GENERATE_A_FERNET_KEY",
}


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AI Wrapper Platform"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_wrapper"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Email
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = "noreply@aiwrapper.com"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_PRO_MONTHLY: str = ""
    STRIPE_PRICE_BUSINESS_MONTHLY: str = ""

    # Frontend URL
    FRONTEND_URL: str = "http://localhost:3000"

    # Allowed CORS origins (comma-separated list; falls back to FRONTEND_URL when empty)
    ALLOWED_ORIGINS: Optional[str] = None

    # Encryption key for stored credentials
    ENCRYPTION_KEY: str

    # OAuth
    OAUTH_GOOGLE_CLIENT_ID: str = ""
    OAUTH_GOOGLE_CLIENT_SECRET: str = ""
    OAUTH_REDIRECT_URI: str = "http://localhost:3000/auth/callback"

    # OpenAI
    OPENAI_API_KEY: str = ""

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v or v in INSECURE_DEFAULTS:
            raise ValueError(
                "SECRET_KEY must be set to a strong random value. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long.")
        return v

    @field_validator("ENCRYPTION_KEY")
    @classmethod
    def validate_encryption_key(cls, v: str) -> str:
        if not v or v in INSECURE_DEFAULTS:
            raise ValueError(
                "ENCRYPTION_KEY must be set to a valid Fernet key. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        return v

    def get_allowed_origins(self) -> List[str]:
        """Return the list of allowed CORS origins."""
        if self.ALLOWED_ORIGINS:
            return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        origins = [self.FRONTEND_URL]
        if self.DEBUG:
            origins += [
                "http://localhost:3000",
                "http://localhost:8000",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:8000",
            ]
        return list(dict.fromkeys(origins))

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
