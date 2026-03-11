"""
Google Calendar OAuth2 API — Generates auth URLs and handles OAuth callbacks.
Users connect their own Google Calendar per-agent.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
from urllib.parse import urlencode

from google_auth_oauthlib.flow import Flow

from app.database import get_db
from app.models.tool import Tool
from app.models.agent import Agent
from app.models.user import User
from app.api.auth import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/api/google-calendar", tags=["google-calendar"])
settings = get_settings()

SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _get_oauth_config(tool: Tool) -> dict:
    """Extract OAuth client config from the tool's global config."""
    config = tool.config or {}
    client_id = config.get("oauth_client_id", "")
    client_secret = config.get("oauth_client_secret", "")
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar OAuth not configured by admin. Please contact the administrator.",
        )
    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }


@router.get("/auth-url")
async def get_auth_url(
    agent_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a Google OAuth2 authorization URL for a specific agent."""
    # Verify the agent belongs to this user
    result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.user_id == user.id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Get global OAuth config
    tool_result = await db.execute(select(Tool).where(Tool.slug == "google_calendar"))
    tool = tool_result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Google Calendar tool not found")

    client_config = _get_oauth_config(tool)

    redirect_uri = f"{settings.FRONTEND_URL}/api/google-calendar/callback"

    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )

    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=json.dumps({"agent_id": agent_id, "user_id": str(user.id)}),
    )

    return {"auth_url": auth_url}


@router.get("/callback")
async def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle the OAuth2 callback from Google and store tokens per-agent."""
    try:
        state_data = json.loads(state)
        agent_id = state_data["agent_id"]
        user_id = state_data["user_id"]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    # Verify agent
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Get global OAuth config
    tool_result = await db.execute(select(Tool).where(Tool.slug == "google_calendar"))
    tool = tool_result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Google Calendar tool not found")

    client_config = _get_oauth_config(tool)
    backend_url = settings.FRONTEND_URL.replace(":3000", ":8000") if ":3000" in settings.FRONTEND_URL else settings.FRONTEND_URL
    redirect_uri = f"{backend_url}/api/google-calendar/callback"

    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )

    # Exchange code for tokens
    flow.fetch_token(code=code)
    credentials = flow.credentials

    # Store tokens in agent.tool_configs.google_calendar
    tool_configs = agent.tool_configs or {}
    tool_configs["google_calendar"] = {
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": list(credentials.scopes) if credentials.scopes else SCOPES,
        "connected": True,
    }
    agent.tool_configs = tool_configs
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(agent, "tool_configs")
    await db.commit()

    # Redirect back to agent settings page
    redirect_url = f"{settings.FRONTEND_URL}/dashboard/agents/{agent_id}?tab=tools&calendar=connected"
    return RedirectResponse(url=redirect_url)


@router.delete("/disconnect")
async def disconnect_calendar(
    agent_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect Google Calendar from an agent."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id, Agent.user_id == user.id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    tool_configs = agent.tool_configs or {}
    if "google_calendar" in tool_configs:
        del tool_configs["google_calendar"]
        agent.tool_configs = tool_configs
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(agent, "tool_configs")
        await db.commit()

    return {"detail": "Google Calendar disconnected"}
