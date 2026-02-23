from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.config import get_settings
from app.middleware.rate_limit import limiter
from app.api import auth, workflows, integrations, billing, profile, admin, test_message, assistant, agents, tools, knowledge, channels, webhooks

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:3000", "http://127.0.0.1:8000"],
    allow_origin_regex=".*",
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
app.include_router(test_message.router)
app.include_router(assistant.router)
app.include_router(agents.router)
app.include_router(tools.router)
app.include_router(channels.router)
app.include_router(knowledge.router, prefix="/api/agents", tags=["knowledge"])
app.include_router(webhooks.router)



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
