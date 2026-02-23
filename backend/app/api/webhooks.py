from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import json
import httpx

from app.database import get_db
from app.models.agent import Agent
from app.services.chat_engine import execute_agent_chat
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

@router.post("/whatsapp")
async def whatsapp_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Receives incoming WhatsApp messages from the OpenClaw AI Gateway.
    The gateway is configured to map specific agent IDs to their respective accounts.
    """
    payload = await request.json()
    
    # OpenClaw Payload Structure parsing
    # Typically: { "channel": "whatsapp", "account": "AGENT_ID", "message": { "id": "...", "body": "...", "sender": "..." } }
    
    # 1. Extract Agent ID from the payload (sent via connection account name/ID config)
    agent_id = payload.get("account")
    if not agent_id:
        raise HTTPException(status_code=400, detail="Missing account (agent_id) in payload")

    msg_data = payload.get("message", {})
    body = msg_data.get("body", "").strip()
    sender = msg_data.get("sender", "unknown")

    if not body:
        return {"status": "ignored", "reason": "empty message"}

    # 2. Find Agent
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # 3. Format payload for chat engine
    # OpenClaw WhatsApp webhooks use the sender's phone number as a deterministic session ID
    user_messages = [{"role": "user", "content": body}]
    
    try:
        reply_text = await execute_agent_chat(
            db=db,
            agent=agent,
            client_ip=f"whatsapp_{sender}",  # Use the phone number as pseudo-IP for session pairing
            user_messages=user_messages,
            subscription=None # Can optionally fetch sub if rate-limiting WhatsApp
        )
        return {"reply": reply_text}
    except Exception as e:
        print(f"WhatsApp Webhook Error for Agent {agent_id}: {str(e)}")
        # We return a generic error message that will be broadcast back to the WhatsApp user
        return {"reply": "Sorry, I am currently experiencing technical difficulties. Please try again later."}

@router.post("/discord")
async def discord_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Receives incoming Discord messages from the OpenClaw AI Gateway.
    The gateway is configured to map specific agent IDs to their respective accounts.
    """
    payload = await request.json()
    
    agent_id = payload.get("account")
    if not agent_id:
        raise HTTPException(status_code=400, detail="Missing account (agent_id) in payload")

    msg_data = payload.get("message", {})
    body = msg_data.get("body", "").strip()
    sender = msg_data.get("sender", "unknown")

    if not body:
        return {"status": "ignored", "reason": "empty message"}

    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    user_messages = [{"role": "user", "content": body}]
    
    try:
        reply_text = await execute_agent_chat(
            db=db,
            agent=agent,
            client_ip=f"discord_{sender}",
            user_messages=user_messages,
            subscription=None
        )
        return {"reply": reply_text}
    except Exception as e:
        print(f"Discord Webhook Error for Agent {agent_id}: {str(e)}")
        return {"reply": "Sorry, I am currently experiencing technical difficulties. Please try again later."}

@router.post("/slack")
async def slack_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Receives incoming Slack messages from the OpenClaw AI Gateway.
    The gateway is configured to map specific agent IDs to their respective accounts.
    """
    payload = await request.json()
    
    agent_id = payload.get("account")
    if not agent_id:
        raise HTTPException(status_code=400, detail="Missing account (agent_id) in payload")

    msg_data = payload.get("message", {})
    body = msg_data.get("body", "").strip()
    sender = msg_data.get("sender", "unknown")

    if not body:
        return {"status": "ignored", "reason": "empty message"}

    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    user_messages = [{"role": "user", "content": body}]
    
    try:
        reply_text = await execute_agent_chat(
            db=db,
            agent=agent,
            client_ip=f"slack_{sender}",
            user_messages=user_messages,
            subscription=None
        )
        return {"reply": reply_text}
    except Exception as e:
        print(f"Slack Webhook Error for Agent {agent_id}: {str(e)}")
        return {"reply": "Sorry, I am currently experiencing technical difficulties. Please try again later."}
