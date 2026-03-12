from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AI Wrapper Platform"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_wrapper"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Auth - These MUST be set in production
    SECRET_KEY: str = ""
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
    
    # Allowed CORS origins (comma-separated)
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8000,http://127.0.0.1:3000,http://127.0.0.1:8000"
    
    # Encryption key for stored credentials - MUST be set in production
    ENCRYPTION_KEY: str = ""
    
    # OAuth
    OAUTH_GOOGLE_CLIENT_ID: str = ""
    OAUTH_GOOGLE_CLIENT_SECRET: str = ""
    OAUTH_REDIRECT_URI: str = "http://localhost:3000/auth/callback"
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    
    class Config:
        env_file = ".env"
        extra = "ignore"  # Allow extra fields from env
    
    def get_allowed_origins(self) -> list:
        """Parse ALLOWED_ORIGINS string into list and add FRONTEND_URL."""
        origins = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        if self.FRONTEND_URL and self.FRONTEND_URL not in origins:
            origins.append(self.FRONTEND_URL)
        return origins
    
    def validate_production_keys(self) -> None:
        """Validate that critical security keys are set for production."""
        if not self.DEBUG:
            if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
                raise ValueError("SECRET_KEY must be set and be at least 32 characters in production")
            if not self.ENCRYPTION_KEY or len(self.ENCRYPTION_KEY) < 32:
                raise ValueError("ENCRYPTION_KEY must be set and be at least 32 characters in production")


_settings = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
        # Validate production keys on startup
        _settings.validate_production_keys()
    return _settings
