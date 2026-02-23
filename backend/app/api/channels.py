"""
Public Channels API — Returns available channels/platforms for the agent creation wizard.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.admin_channel import AdminChannel
from app.models.agent import Agent
from app.config import get_settings

router = APIRouter(prefix="/api/channels", tags=["channels"])


@router.get("")
async def list_public_channels(db: AsyncSession = Depends(get_db)):
    """List all channels visible to users (enabled only)."""
    result = await db.execute(
        select(AdminChannel)
        .where(AdminChannel.enabled == True)
        .order_by(AdminChannel.sort_order)
    )
    channels = result.scalars().all()
    return [
        {
            "id": c.slug,
            "name": c.name,
            "icon": c.icon,
            "description": c.description,
            "badge": c.badge,
            "is_upcoming": c.is_upcoming,
        }
        for c in channels
    ]

@router.get("/whatsapp/config")
async def generate_whatsapp_config(
    db: AsyncSession = Depends(get_db)
):
    """
    Generates the OpenClaw `openclaw.json` configuration on the fly.
    This tells the daemon which Webhooks to hit and what the account IDs map to.
    """
    settings = get_settings()
    # The URL OpenClaw will POST incoming messages to
    # Uses the backend public URL or a local proxy URL if in development
    base_url = settings.BACKEND_URL or "http://localhost:8000"
    webhook_url = f"{base_url}/api/webhooks/whatsapp"

    # Find all agents assigned to the WhatsApp platform (not drafts)
    result = await db.execute(select(Agent).where(Agent.platform == "whatsapp", Agent.status != "draft"))
    agents = result.scalars().all()

    accounts_config = {}
    
    for agent in agents:
        # We use the internal Agent ID as the specific WhatsApp 'account' ID
        # Read the WhatsApp-specific dmPolicy & allowFrom settings from tool_configs
        wa_config = (agent.tool_configs or {}).get("whatsapp", {})
        dm_policy = wa_config.get("dmPolicy", "allowlist")
        allow_from = wa_config.get("allowFrom", [])

        accounts_config[str(agent.id)] = {
            "enabled": True,
            "webhook": webhook_url,
            "dmPolicy": dm_policy,
        }
        
        # Only inject allowFrom if not "all" and list is populated
        if dm_policy == "allowlist" and allow_from:
            accounts_config[str(agent.id)]["allowFrom"] = allow_from

    # Main OpenClaw config structure
    config = {
        "channels": {
            "whatsapp": {
                "enabled": True,
                "accounts": accounts_config,
                # Global defaults
                "sendReadReceipts": True,
                "textChunkLimit": 4000
            }
        }
    }

    return config
