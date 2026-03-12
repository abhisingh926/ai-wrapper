import uuid
import secrets
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.config import get_settings
from app.models.user import User
from app.models.subscription import Subscription, PlanType, SubscriptionStatus
from app.schemas.user import (
    RegisterRequest, LoginRequest, ForgotPasswordRequest,
    ResetPasswordRequest, TokenResponse, UserResponse,
)
from app.middleware.auth import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, get_current_user,
)
from app.utils.email import send_verification_email, send_reset_password_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory store for OAuth CSRF tokens (in production, use Redis)
oauth_state_store = {}


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user with email and password."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    verification_token = str(uuid.uuid4())
    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
        verification_token=verification_token,
        password_changed_at=datetime.utcnow(),  # Initialize password version
    )
    db.add(user)
    await db.flush()

    # Create free subscription
    subscription = Subscription(
        user_id=user.id,
        plan=PlanType.FREE,
        status=SubscriptionStatus.ACTIVE,
        workflow_limit=3,
        monthly_run_limit=100,
    )
    db.add(subscription)
    await db.commit()
    await db.refresh(user)

    # Send verification email (async, non-blocking)
    await send_verification_email(data.email, verification_token)

    return user


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password, returns JWT tokens."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Please verify your email first")
    
    # Check if user is blocked
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="Your account has been blocked. Please contact support.")

    # Include password_changed_at in token for invalidation
    access_token = create_access_token(
        data={"sub": str(user.id)},
        password_changed_at=user.password_changed_at
    )
    return TokenResponse(access_token=access_token)


@router.get("/verify")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    """Verify user email with token from verification link."""
    result = await db.execute(select(User).where(User.verification_token == token))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")

    user.email_verified = True
    user.verification_token = None
    await db.commit()

    return {"message": "Email verified successfully"}


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send password reset link to user's email."""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    # Always return success (don't reveal if email exists)
    if user:
        reset_token = str(uuid.uuid4())
        user.reset_token = reset_token
        user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
        await db.commit()
        await send_reset_password_email(data.email, reset_token)

    return {"message": "If an account exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using token from reset link."""
    result = await db.execute(
        select(User).where(
            User.reset_token == data.token,
            User.reset_token_expires > datetime.utcnow(),
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.password_hash = hash_password(data.new_password)
    user.password_changed_at = datetime.utcnow()  # Update password version to invalidate old tokens
    user.reset_token = None
    user.reset_token_expires = None
    await db.commit()

    return {"message": "Password reset successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user's profile."""
    return current_user


# ─── OAuth / Social Login ────────────────────────────────────────────

OAUTH_PROVIDERS = {
    "google": {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scopes": "openid email profile",
    },
    "github": {
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scopes": "read:user user:email",
    },
    "microsoft": {
        "authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "userinfo_url": "https://graph.microsoft.com/v1.0/me",
        "scopes": "openid email profile User.Read",
    },
    "apple": {
        "authorize_url": "https://appleid.apple.com/auth/authorize",
        "token_url": "https://appleid.apple.com/auth/token",
        "userinfo_url": None,  # Apple returns user info in the ID token
        "scopes": "name email",
    },
}


@router.get("/oauth/{provider}")
async def oauth_initiate(provider: str):
    """Redirect user to the OAuth provider's authorization page."""
    import urllib.parse

    provider = provider.lower()
    if provider not in OAUTH_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    settings = get_settings()
    cfg = OAUTH_PROVIDERS[provider]
    client_id = getattr(settings, f"OAUTH_{provider.upper()}_CLIENT_ID", "")
    redirect_uri = settings.OAUTH_REDIRECT_URI

    if not client_id:
        raise HTTPException(
            status_code=501,
            detail=f"{provider.title()} OAuth not configured. Set OAUTH_{provider.upper()}_CLIENT_ID in .env",
        )

    # Generate secure CSRF state token
    csrf_token = secrets.token_urlsafe(32)
    # Store CSRF token with provider info (expires in 10 minutes)
    oauth_state_store[csrf_token] = {
        "provider": provider,
        "expires": datetime.utcnow() + timedelta(minutes=10)
    }
    
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": cfg["scopes"],
        "state": csrf_token,  # Use secure CSRF token
    }

    if provider == "apple":
        params["response_mode"] = "form_post"

    auth_url = f"{cfg['authorize_url']}?{urllib.parse.urlencode(params)}"
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=auth_url)


from pydantic import BaseModel

class OAuthCallbackRequest(BaseModel):
    code: str
    state: str


@router.post("/oauth/callback")
async def oauth_callback(
    payload: OAuthCallbackRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Exchange authorization code for tokens, fetch user profile,
    create or find the user, and return a JWT.
    """
    import httpx

    code = payload.code
    csrf_token = payload.state
    
    # Validate CSRF token
    state_data = oauth_state_store.get(csrf_token)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid OAuth state. Please try again.")
    
    # Check expiration
    if datetime.utcnow() > state_data["expires"]:
        del oauth_state_store[csrf_token]
        raise HTTPException(status_code=400, detail="OAuth state expired. Please try again.")
    
    provider = state_data["provider"]
    
    # Clean up used CSRF token
    del oauth_state_store[csrf_token]
    
    if provider not in OAUTH_PROVIDERS:
        raise HTTPException(status_code=400, detail="Invalid provider state")

    settings = get_settings()
    cfg = OAUTH_PROVIDERS[provider]
    client_id = getattr(settings, f"OAUTH_{provider.upper()}_CLIENT_ID", "")
    client_secret = getattr(settings, f"OAUTH_{provider.upper()}_CLIENT_SECRET", "")
    redirect_uri = settings.OAUTH_REDIRECT_URI

    # Exchange code for access token (no debug prints - use logging)
    logger.info(f"[OAuth] Exchanging code for provider={provider}")
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            cfg["token_url"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
                "client_secret": client_secret,
            },
            headers={"Accept": "application/json"},
        )

    if token_resp.status_code != 200:
        error_detail = token_resp.json() if token_resp.headers.get("content-type", "").startswith("application/json") else token_resp.text
        raise HTTPException(status_code=400, detail=f"Token exchange failed: {error_detail}")

    tokens = token_resp.json()
    access_token = tokens.get("access_token")

    # Fetch user info from provider
    if cfg["userinfo_url"]:
        async with httpx.AsyncClient() as client:
            user_resp = await client.get(
                cfg["userinfo_url"],
                headers={"Authorization": f"Bearer {access_token}"},
            )
        user_info = user_resp.json()
    else:
        user_info = tokens  # Apple sends user data in the token response

    # Normalize user info across providers
    if provider == "google":
        oauth_email = user_info.get("email")
        oauth_name = user_info.get("name", "")
    elif provider == "github":
        oauth_email = user_info.get("email")
        oauth_name = user_info.get("name") or user_info.get("login", "")
    elif provider == "microsoft":
        oauth_email = user_info.get("mail") or user_info.get("userPrincipalName")
        oauth_name = user_info.get("displayName", "")
    elif provider == "apple":
        # Apple only returns user info on first login
        oauth_email = user_info.get("email")
        oauth_name = ""
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    if not oauth_email:
        raise HTTPException(
            status_code=400, 
            detail="Could not retrieve email from provider. Please ensure your account has an email address."
        )

    # Find or create user
    result = await db.execute(select(User).where(User.email == oauth_email))
    user = result.scalar_one_or_none()

    if not user:
        try:
            user = User(
                name=oauth_name,
                email=oauth_email,
                password_hash="",  # No password for OAuth users
                email_verified=True,
                oauth_provider=provider,
                password_changed_at=datetime.utcnow(),
            )
            db.add(user)
            await db.flush()

            # Create free subscription for new OAuth users
            subscription = Subscription(
                user_id=user.id,
                plan=PlanType.FREE,
                status=SubscriptionStatus.ACTIVE,
                workflow_limit=3,
                monthly_run_limit=100,
            )
            db.add(subscription)
            await db.commit()
            await db.refresh(user)
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating OAuth user: {e}")
            raise HTTPException(status_code=500, detail="Failed to create account. Please try again.")

    # Check if user is blocked
    if user.is_blocked:
        raise HTTPException(
            status_code=403,
            detail="Your account has been blocked. Please contact support."
        )
    
    # Check if email verified (for existing users)
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email first"
        )
    
    # Issue JWT with password version
    jwt_token = create_access_token(
        data={"sub": str(user.id)},
        password_changed_at=user.password_changed_at
    )
    return {"access_token": jwt_token, "token_type": "bearer", "provider": provider}
