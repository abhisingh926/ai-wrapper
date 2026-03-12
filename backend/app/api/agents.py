"""
Agents API — CRUD for AI agents created via the wizard.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc, func, delete
from datetime import datetime
import json
import re
import io
import csv

from app.services.chat_engine import execute_agent_chat
from app.database import get_db
from app.models.user import User, UserRole
from app.models.agent import Agent
from app.models.agent_knowledge import AgentKnowledge
from app.models.lead import AgentLead
from app.models.chat_session import ChatSession, ChatMessage
from app.models.subscription import Subscription
from app.api.auth import get_current_user
import litellm
import os

router = APIRouter(prefix="/api/agents", tags=["agents"])


# ── Schemas ──

class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    ai_provider: str = Field(..., pattern="^(openai|anthropic|google|azure)$")
    ai_model: str = Field(..., min_length=1, max_length=100)
    platform: str = Field(default="web", pattern="^(web|whatsapp|discord|telegram|slack)$")
    tools: List[str] = Field(default_factory=list)
    tool_configs: dict = Field(default_factory=dict)
    system_prompt: str = Field(default="You are a helpful AI assistant.", max_length=10000)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    version: str = Field(default="1.0.0", pattern=r"^\d+\.\d+\.\d+$")


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    ai_provider: Optional[str] = Field(None, pattern="^(openai|anthropic|google|azure)$")
    ai_model: Optional[str] = Field(None, min_length=1, max_length=100)
    platform: Optional[str] = Field(None, pattern="^(web|whatsapp|discord|telegram|slack)$")
    tools: Optional[List[str]] = None
    tool_configs: Optional[dict] = None
    system_prompt: Optional[str] = Field(None, max_length=10000)
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    version: Optional[str] = Field(None, pattern=r"^\d+\.\d+\.\d+$")


class AgentOut(BaseModel):
    id: str
    name: str
    ai_provider: str
    ai_model: str
    platform: str
    tools: list
    tool_configs: dict
    system_prompt: str
    temperature: float
    version: str
    status: str
    messages_count: int
    api_calls_count: int
    errors_count: int
    avg_response_ms: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

class ChatMessageInput(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessageInput]

class ChatResponse(BaseModel):
    reply: str


# ── Endpoints ──

@router.get("/models/available")
async def get_available_models(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all models with 'allowed' flag based on user's plan. Admins get all."""
    from app.api.admin import load_models_config
    config = load_models_config()

    # Determine user's plan
    user_plan = "free"
    is_admin = current_user.role == UserRole.ADMIN
    if not is_admin:
        sub_result = await db.execute(
            select(Subscription).where(Subscription.user_id == current_user.id)
        )
        subscription = sub_result.scalar_one_or_none()
        if subscription:
            user_plan = subscription.plan.value

    # Annotate each model with allowed flag
    result_providers = []
    for provider in config.get("providers", []):
        models = []
        for model in provider.get("models", []):
            models.append({
                **model,
                "allowed": is_admin or user_plan in model.get("plans", []),
                "min_plan": model.get("plans", ["free"])[0] if model.get("plans") else "free",
            })
        result_providers.append({
            "id": provider["id"],
            "name": provider["name"],
            "icon": provider.get("icon", "🤖"),
            "color": provider.get("color", "from-slate-500 to-slate-600"),
            "models": models,
        })

    return {"providers": result_providers, "user_plan": user_plan, "is_admin": is_admin}


@router.get("")
async def list_agents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all agents for the current user."""
    result = await db.execute(
        select(Agent)
        .where(Agent.user_id == current_user.id)
        .order_by(Agent.created_at.desc())
    )
    agents = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "name": a.name,
            "ai_provider": a.ai_provider,
            "ai_model": a.ai_model,
            "platform": a.platform,
            "tools": a.tools or [],
            "tool_configs": a.tool_configs or {},
            "system_prompt": a.system_prompt or "",
            "temperature": a.temperature if a.temperature is not None else 0.7,
            "version": a.version or "1.0.0",
            "status": a.status,
            "messages_count": a.messages_count,
            "api_calls_count": a.api_calls_count,
            "errors_count": a.errors_count,
            "avg_response_ms": a.avg_response_ms,
            "created_at": a.created_at.isoformat() if a.created_at else "",
            "updated_at": a.updated_at.isoformat() if a.updated_at else "",
        }
        for a in agents
    ]


@router.post("")
async def create_agent(
    data: AgentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new agent."""
    # ── Enforce agent limit ──
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = sub_result.scalar_one_or_none()
    if subscription and current_user.role != UserRole.ADMIN:
        limits = subscription.get_plan_limits()
        agent_count_result = await db.execute(
            select(func.count()).select_from(Agent).where(Agent.user_id == current_user.id)
        )
        current_agent_count = agent_count_result.scalar() or 0
        if current_agent_count >= limits["agent_limit"]:
            raise HTTPException(
                status_code=403,
                detail=f"Agent limit reached. Your {subscription.plan.value.capitalize()} plan allows {limits['agent_limit']} agent(s). Please upgrade to create more."
            )

    # ── Enforce model access ──
    if current_user.role != UserRole.ADMIN:
        from app.api.admin import load_models_config
        config = load_models_config()
        user_plan = subscription.plan.value if subscription else "free"
        allowed = False
        for provider in config.get("providers", []):
            for model in provider.get("models", []):
                if model["id"] == data.ai_model and user_plan in model.get("plans", []):
                    allowed = True
                    break
        if not allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Model '{data.ai_model}' is not available on your {user_plan.capitalize()} plan. Please upgrade to access this model."
            )
    agent = Agent(
        user_id=current_user.id,
        name=data.name,
        ai_provider=data.ai_provider,
        ai_model=data.ai_model,
        platform=data.platform,
        tools=data.tools,
        tool_configs=data.tool_configs,
        system_prompt=data.system_prompt,
        status="draft",
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return {
        "id": str(agent.id),
        "name": agent.name,
        "ai_provider": agent.ai_provider,
        "ai_model": agent.ai_model,
        "platform": agent.platform,
        "tools": agent.tools or [],
        "tool_configs": agent.tool_configs or {},
        "system_prompt": agent.system_prompt or "",
        "temperature": agent.temperature if agent.temperature is not None else 0.7,
        "version": agent.version or "1.0.0",
        "status": agent.status,
        "messages_count": agent.messages_count,
        "api_calls_count": agent.api_calls_count,
        "errors_count": agent.errors_count,
        "avg_response_ms": agent.avg_response_ms,
        "created_at": agent.created_at.isoformat() if agent.created_at else "",
        "updated_at": agent.updated_at.isoformat() if agent.updated_at else "",
    }


@router.get("/{agent_id}")
async def get_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single agent."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {
        "id": str(agent.id),
        "name": agent.name,
        "ai_provider": agent.ai_provider,
        "ai_model": agent.ai_model,
        "platform": agent.platform,
        "tools": agent.tools or [],
        "tool_configs": agent.tool_configs or {},
        "system_prompt": agent.system_prompt or "",
        "temperature": agent.temperature if agent.temperature is not None else 0.7,
        "version": agent.version or "1.0.0",
        "status": agent.status,
        "messages_count": agent.messages_count,
        "api_calls_count": agent.api_calls_count,
        "errors_count": agent.errors_count,
        "avg_response_ms": agent.avg_response_ms,
        "created_at": agent.created_at.isoformat() if agent.created_at else "",
        "updated_at": agent.updated_at.isoformat() if agent.updated_at else "",
    }


@router.put("/{agent_id}")
async def update_agent(
    agent_id: str,
    data: AgentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an agent."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if data.name is not None:
        agent.name = data.name
    if data.ai_provider is not None:
        agent.ai_provider = data.ai_provider
    if data.ai_model is not None:
        # Validate model access based on user plan
        if current_user.role != UserRole.ADMIN:
            config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models_config.json")
            if os.path.exists(config_path):
                with open(config_path) as f:
                    models_data = json.load(f)
                # Get user's plan
                sub_result = await db.execute(
                    select(Subscription).where(Subscription.user_id == current_user.id)
                )
                subscription = sub_result.scalar_one_or_none()
                user_plan = subscription.plan.value if subscription else "free"
                # Check if model is allowed for this plan
                model_allowed = False
                for provider in models_data.get("providers", []):
                    for model in provider.get("models", []):
                        if model["id"] == data.ai_model and user_plan in model.get("plans", []):
                            model_allowed = True
                            break
                if not model_allowed:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Model '{data.ai_model}' is not available on your current plan. Please upgrade."
                    )
        agent.ai_model = data.ai_model
    if data.platform is not None:
        agent.platform = data.platform
    if data.tools is not None:
        agent.tools = data.tools
    if data.tool_configs is not None:
        agent.tool_configs = data.tool_configs
    if data.system_prompt is not None:
        agent.system_prompt = data.system_prompt
    if data.temperature is not None:
        agent.temperature = data.temperature
    if data.version is not None:
        agent.version = data.version

    agent.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(agent)
    return {
        "id": str(agent.id),
        "name": agent.name,
        "ai_provider": agent.ai_provider,
        "ai_model": agent.ai_model,
        "platform": agent.platform,
        "tools": agent.tools or [],
        "tool_configs": agent.tool_configs or {},
        "system_prompt": agent.system_prompt or "",
        "temperature": agent.temperature if agent.temperature is not None else 0.7,
        "version": agent.version or "1.0.0",
        "status": agent.status,
        "messages_count": agent.messages_count,
        "api_calls_count": agent.api_calls_count,
        "errors_count": agent.errors_count,
        "avg_response_ms": agent.avg_response_ms,
        "created_at": agent.created_at.isoformat() if agent.created_at else "",
        "updated_at": agent.updated_at.isoformat() if agent.updated_at else "",
    }


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an agent (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can delete agents")
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Delete related records first to avoid FK constraint errors
    await db.execute(delete(AgentKnowledge).where(AgentKnowledge.agent_id == agent_id))
    await db.execute(delete(AgentLead).where(AgentLead.agent_id == agent_id))
    # Delete chat messages via their sessions, then delete sessions
    sessions = await db.execute(select(ChatSession.id).where(ChatSession.agent_id == agent_id))
    session_ids = [s[0] for s in sessions.fetchall()]
    if session_ids:
        await db.execute(delete(ChatMessage).where(ChatMessage.session_id.in_(session_ids)))
    await db.execute(delete(ChatSession).where(ChatSession.agent_id == agent_id))

    await db.delete(agent)
    await db.commit()
    return {"detail": "Agent deleted"}


@router.post("/{agent_id}/deploy")
async def deploy_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set agent status to live."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.status = "live"
    agent.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Agent deployed", "status": "live"}


@router.post("/{agent_id}/pause")
async def pause_agent(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pause a live agent."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.status = "paused"
    agent.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Agent paused", "status": "paused"}


@router.post("/{agent_id}/chat", response_model=ChatResponse)
async def chat_with_agent(
    agent_id: str,
    req: ChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test chat with an agent, utilizing its system prompt and tools."""
    # ── Enforce message limit ──
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = sub_result.scalar_one_or_none()
    if subscription and current_user.role != UserRole.ADMIN:
        limits = subscription.get_plan_limits()
        if subscription.messages_used >= limits["message_limit"]:
            raise HTTPException(
                status_code=403,
                detail=f"Monthly message limit reached. Your {subscription.plan.value.capitalize()} plan allows {limits['message_limit']} messages/month. Please upgrade for more."
            )

    # 1. Fetch Agent
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # If agent is paused/draft, return empty reply silently
    if agent.status != "live":
        return {"reply": ""}

    # 2. Execute unified LLM Agent Chat Logic
    client_ip = request.client.host if request.client else "unknown"
    user_messages = [{"role": msg.role, "content": msg.content} for msg in req.messages]
    
    try:
        reply_text = await execute_agent_chat(
            db=db,
            agent=agent,
            client_ip=client_ip,
            user_messages=user_messages,
            subscription=subscription
        )
        return {"reply": reply_text}
    except Exception as e:
        print(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}")


@router.get("/{agent_id}/widget-status")
async def get_widget_status(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint: returns agent name and online/offline status for the widget."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {
        "name": agent.name,
        "status": agent.status,
        "online": agent.status == "live",
    }


@router.post("/{agent_id}/widget-chat", response_model=ChatResponse)
async def widget_chat_with_agent(
    agent_id: str,
    req: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Public chat endpoint for the embeddable widget — no auth required."""
    # 1. Fetch Agent (public — no user_id filter)
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # If agent is paused/draft, return empty reply silently
    if agent.status != "live":
        return {"reply": ""}

    # 2. Check subscription of the agent owner
    owner_result = await db.execute(select(User).where(User.id == agent.user_id))
    owner = owner_result.scalar_one_or_none()
    
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == agent.user_id)
    )
    subscription = sub_result.scalar_one_or_none()
    if subscription and owner and owner.role != UserRole.ADMIN:
        limits = subscription.get_plan_limits()
        if subscription.messages_used >= limits["message_limit"]:
            raise HTTPException(
                status_code=403,
                detail="This agent's message limit has been reached."
            )

    # 3. Execute Unified LLM Agent Chat Logic
    client_ip = request.client.host if request.client else "unknown"
    user_messages = [{"role": msg.role, "content": msg.content} for msg in req.messages]
    
    try:
        reply_text = await execute_agent_chat(
            db=db,
            agent=agent,
            client_ip=client_ip,
            user_messages=user_messages,
            subscription=subscription
        )
        return {"reply": reply_text}
    except Exception as e:
        print(f"Widget chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}")


@router.get("/{agent_id}/chat/session")
async def get_chat_session(
    agent_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get existing chat session messages for the current IP."""
    # Verify agent ownership
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    client_ip = request.client.host if request.client else "unknown"

    # Find existing session
    session_result = await db.execute(
        select(ChatSession).where(
            ChatSession.agent_id == agent.id,
            ChatSession.session_ip == client_ip,
        )
    )
    session = session_result.scalar_one_or_none()

    if not session:
        return {"messages": [], "session_id": None}

    # Load messages
    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
    )
    msgs = msg_result.scalars().all()

    return {
        "session_id": str(session.id),
        "messages": [
            {"role": m.role, "content": m.content}
            for m in msgs
        ],
    }


@router.delete("/{agent_id}/chat/session")
async def clear_chat_session(
    agent_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear the chat session for the current IP (start fresh)."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    client_ip = request.client.host if request.client else "unknown"

    session_result = await db.execute(
        select(ChatSession).where(
            ChatSession.agent_id == agent.id,
            ChatSession.session_ip == client_ip,
        )
    )
    session = session_result.scalar_one_or_none()
    if session:
        await db.delete(session)  # cascade deletes messages
        await db.commit()

    return {"message": "Chat session cleared"}

    return reply_text


# ─── Leads API ─────────────────────────────────────────


@router.get("/{agent_id}/leads")
async def list_leads(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all captured leads for an agent."""
    # Verify ownership
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Agent not found")
    
    result = await db.execute(
        select(AgentLead)
        .where(AgentLead.agent_id == agent_id)
        .order_by(desc(AgentLead.created_at))
    )
    leads = result.scalars().all()
    
    return [
        {
            "id": str(lead.id),
            "name": lead.name,
            "email": lead.email,
            "phone": lead.phone,
            "company": lead.company,
            "requirement": lead.requirement,
            "source": lead.source,
            "conversation_snippet": lead.conversation_snippet,
            "created_at": lead.created_at.isoformat() if lead.created_at else None,
        }
        for lead in leads
    ]


@router.delete("/{agent_id}/leads/{lead_id}")
async def delete_lead(
    agent_id: str,
    lead_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific lead."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Agent not found")
    
    result = await db.execute(
        select(AgentLead).where(AgentLead.id == lead_id, AgentLead.agent_id == agent_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    await db.delete(lead)
    await db.commit()
    return {"message": "Lead deleted"}


@router.get("/{agent_id}/leads/export")
async def export_leads_csv(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all leads as CSV."""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    result = await db.execute(
        select(AgentLead)
        .where(AgentLead.agent_id == agent_id)
        .order_by(desc(AgentLead.created_at))
    )
    leads = result.scalars().all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "Email", "Phone", "Company", "Requirement", "Source", "Date"])
    for lead in leads:
        writer.writerow([
            lead.name or "",
            lead.email or "",
            lead.phone or "",
            lead.company or "",
            lead.requirement or "",
            lead.source or "",
            lead.created_at.isoformat() if lead.created_at else "",
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={agent.name}_leads.csv"},
    )


# ═══════════════════════════════════════════════════════════════════
# Dashboard Analytics Endpoints
# ═══════════════════════════════════════════════════════════════════

@router.get("/{agent_id}/dashboard-stats")
async def get_dashboard_stats(
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return comprehensive analytics for the agent dashboard tab."""
    from datetime import timedelta

    # Verify agent ownership
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # 1. Total sessions
    total_sessions_q = await db.execute(
        select(func.count(ChatSession.id)).where(ChatSession.agent_id == agent_id)
    )
    total_sessions = total_sessions_q.scalar() or 0

    # 2. Total messages across all sessions
    total_messages_q = await db.execute(
        select(func.count(ChatMessage.id)).where(
            ChatMessage.session_id.in_(
                select(ChatSession.id).where(ChatSession.agent_id == agent_id)
            )
        )
    )
    total_messages = total_messages_q.scalar() or 0

    # 3. Daily messages — last 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    daily_msgs_q = await db.execute(
        select(
            func.date(ChatMessage.created_at).label("day"),
            func.count(ChatMessage.id).label("count"),
        )
        .where(
            ChatMessage.session_id.in_(
                select(ChatSession.id).where(ChatSession.agent_id == agent_id)
            ),
            ChatMessage.created_at >= seven_days_ago,
        )
        .group_by(func.date(ChatMessage.created_at))
        .order_by(func.date(ChatMessage.created_at))
    )
    daily_messages_raw = daily_msgs_q.all()

    # Fill in missing days with 0
    daily_messages = []
    for i in range(7):
        day = (datetime.utcnow() - timedelta(days=6 - i)).strftime("%Y-%m-%d")
        count = 0
        for row in daily_messages_raw:
            if str(row.day) == day:
                count = row.count
                break
        daily_messages.append({"date": day, "count": count})

    # 4. Daily new sessions — last 7 days
    daily_sess_q = await db.execute(
        select(
            func.date(ChatSession.created_at).label("day"),
            func.count(ChatSession.id).label("count"),
        )
        .where(
            ChatSession.agent_id == agent_id,
            ChatSession.created_at >= seven_days_ago,
        )
        .group_by(func.date(ChatSession.created_at))
        .order_by(func.date(ChatSession.created_at))
    )
    daily_sessions_raw = daily_sess_q.all()

    daily_sessions = []
    for i in range(7):
        day = (datetime.utcnow() - timedelta(days=6 - i)).strftime("%Y-%m-%d")
        count = 0
        for row in daily_sessions_raw:
            if str(row.day) == day:
                count = row.count
                break
        daily_sessions.append({"date": day, "count": count})

    # 5. Recent sessions with message count and last message preview
    from sqlalchemy.orm import selectinload
    sessions_q = await db.execute(
        select(ChatSession)
        .where(ChatSession.agent_id == agent_id)
        .options(selectinload(ChatSession.messages))
        .order_by(desc(ChatSession.updated_at))
        .limit(50)
    )
    sessions = sessions_q.scalars().all()

    recent_sessions = []
    for s in sessions:
        msgs = sorted(s.messages, key=lambda m: m.created_at)
        last_user_msg = ""
        for m in reversed(msgs):
            if m.role == "user":
                last_user_msg = m.content[:120]
                break

        recent_sessions.append({
            "id": str(s.id),
            "session_ip": s.session_ip,
            "message_count": len(msgs),
            "last_message": last_user_msg,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        })

    return {
        "overview": {
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "avg_response_ms": agent.avg_response_ms or 0,
            "errors_count": agent.errors_count or 0,
            "api_calls_count": agent.api_calls_count or 0,
        },
        "daily_messages": daily_messages,
        "daily_sessions": daily_sessions,
        "recent_sessions": recent_sessions,
    }


@router.get("/{agent_id}/sessions/{session_id}/messages")
async def get_session_messages(
    agent_id: str,
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all messages for a specific chat session."""
    # Verify agent ownership
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == current_user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Verify session belongs to agent
    session_result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.agent_id == agent_id,
        )
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Fetch messages
    msgs_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = msgs_result.scalars().all()

    return {
        "session": {
            "id": str(session.id),
            "session_ip": session.session_ip,
            "created_at": session.created_at.isoformat() if session.created_at else None,
        },
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


# ── Activity Logs ──

@router.get("/{agent_id}/activity")
async def get_agent_activity(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns real-time activity logs for an agent:
    - Recent chat messages (user + assistant)
    - Lead captures
    - Session info
    - System events derived from real data
    """
    from uuid import UUID as PyUUID
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")

    events = []

    # 1. System boot event (agent created)
    if agent.created_at:
        events.append({
            "type": "system",
            "icon": "🟢",
            "title": "Agent initialized",
            "detail": f"v{agent.version or '1.0.0'} • {agent.ai_provider}/{agent.ai_model}",
            "timestamp": agent.created_at.isoformat(),
        })

    # 2. Fetch recent chat sessions with messages
    sessions_result = await db.execute(
        select(ChatSession)
        .where(ChatSession.agent_id == agent_id)
        .order_by(desc(ChatSession.updated_at))
        .limit(10)
    )
    sessions = sessions_result.scalars().all()

    for sess in sessions:
        # Session connected event
        channel = "WhatsApp" if "whatsapp" in (sess.session_ip or "") else \
                  "Discord" if "discord" in (sess.session_ip or "") else \
                  "Slack" if "slack" in (sess.session_ip or "") else "Web Chat"
        
        events.append({
            "type": "connection",
            "icon": "🔗",
            "title": f"{channel} session connected",
            "detail": sess.session_ip or "unknown",
            "timestamp": sess.created_at.isoformat() if sess.created_at else None,
        })

        # Get messages for this session (last 20)
        msgs_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == sess.id)
            .order_by(desc(ChatMessage.created_at))
            .limit(20)
        )
        msgs = msgs_result.scalars().all()

        for msg in msgs:
            content_preview = (msg.content or "")[:120]
            if len(msg.content or "") > 120:
                content_preview += "..."

            if msg.role == "user":
                events.append({
                    "type": "message_in",
                    "icon": "📩",
                    "title": "Incoming message",
                    "detail": content_preview,
                    "timestamp": msg.created_at.isoformat() if msg.created_at else None,
                    "session_ip": sess.session_ip,
                })
            else:
                events.append({
                    "type": "message_out",
                    "icon": "🤖",
                    "title": "Agent response",
                    "detail": content_preview,
                    "timestamp": msg.created_at.isoformat() if msg.created_at else None,
                    "session_ip": sess.session_ip,
                })

    # 3. Lead captures
    leads_result = await db.execute(
        select(AgentLead)
        .where(AgentLead.agent_id == agent_id)
        .order_by(desc(AgentLead.created_at))
        .limit(10)
    )
    leads = leads_result.scalars().all()

    for lead in leads:
        events.append({
            "type": "lead",
            "icon": "🎯",
            "title": "Lead captured",
            "detail": f"{lead.name or 'Unknown'} • {lead.email or lead.phone or 'No contact'}",
            "timestamp": lead.created_at.isoformat() if lead.created_at else None,
        })

    # 4. Tools loaded event
    if agent.tools:
        events.append({
            "type": "system",
            "icon": "⚡",
            "title": "Tools loaded",
            "detail": ", ".join(agent.tools),
            "timestamp": agent.created_at.isoformat() if agent.created_at else None,
        })

    # Sort all events by timestamp descending
    events.sort(key=lambda e: e.get("timestamp") or "", reverse=True)

    return {
        "agent_id": str(agent.id),
        "agent_name": agent.name,
        "status": agent.status,
        "total_messages": agent.messages_count or 0,
        "total_sessions": len(sessions),
        "events": events[:100],  # cap at 100 most recent
    }

