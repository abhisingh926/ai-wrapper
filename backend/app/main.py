from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.config import get_settings
from app.middleware.rate_limit import limiter
from app.api import auth, workflows, integrations, billing, profile, admin, test_message, assistant, agents, tools, knowledge, channels, webhooks, google_calendar_oauth, skills

from contextlib import asynccontextmanager
from app.scheduler import start_scheduler

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Kick off the background cron scheduler
    start_scheduler()
    yield
    # Shutdown logic could go here

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS - Use allowed origins from config, no wildcard
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Include routers
app.include_router(auth.router)
app.include_router(workflows.router)
app.include_router(integrations.router)
app.include_router(billing.router)
app.include_router(profile.router)
app.include_router(admin.router)
app.include_router(admin.landing_router)
app.include_router(test_message.router)
app.include_router(assistant.router)
app.include_router(agents.router)
app.include_router(tools.router)
app.include_router(channels.router)
app.include_router(knowledge.router, prefix="/api/agents", tags=["knowledge"])
app.include_router(webhooks.router)
app.include_router(google_calendar_oauth.router)
app.include_router(skills.router)



@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
