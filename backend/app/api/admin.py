from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User, UserRole
from app.models.subscription import Subscription, PlanType
from app.models.workflow import Workflow, Execution
from app.models.integration import Integration, UserIntegration
from app.schemas.user import UserResponse
from app.middleware.auth import require_admin
from app.utils.encryption import encrypt_credentials, decrypt_credentials

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
async def list_users(
    search: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all users (admin only)."""
    query = select(User)
    if search:
        query = query.where(User.email.ilike(f"%{search}%") | User.name.ilike(f"%{search}%"))
    query = query.order_by(User.created_at.desc()).limit(limit).offset(offset)
    
    result = await db.execute(query)
    users = result.scalars().all()

    # Get total count
    count_query = select(func.count(User.id))
    if search:
        count_query = count_query.where(User.email.ilike(f"%{search}%") | User.name.ilike(f"%{search}%"))
    total = (await db.execute(count_query)).scalar()

    return {
        "users": [UserResponse.model_validate(u) for u in users],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.put("/users/{user_id}/block")
async def toggle_block_user(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Block or unblock a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Toggle email_verified as a simple block mechanism
    user.is_blocked = not user.is_blocked
    await db.commit()
    status = "unblocked" if not user.is_blocked else "blocked"
    return {"message": f"User {status}"}


class ChangeRoleRequest(BaseModel):
    role: str  # "user" or "admin"


@router.put("/users/{user_id}/role")
async def change_user_role(
    user_id: str,
    data: ChangeRoleRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Change a user's role (admin only)."""
    if data.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'user' or 'admin'")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from demoting themselves
    if str(user.id) == str(current_user.id) and data.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    user.role = UserRole(data.role)
    await db.commit()
    return {"message": f"User role changed to {data.role}"}


@router.put("/users/{user_id}/reset-quota")
async def reset_user_quota(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reset a user's monthly run quota."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    subscription.runs_used = 0
    await db.commit()
    return {"message": "Quota reset successfully"}


@router.get("/analytics")
async def get_analytics(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get platform analytics dashboard data."""
    total_users = (await db.execute(select(func.count(User.id)))).scalar()
    active_subs = (await db.execute(
        select(func.count(Subscription.id)).where(Subscription.plan != PlanType.FREE)
    )).scalar()
    total_workflows = (await db.execute(select(func.count(Workflow.id)))).scalar()
    total_executions = (await db.execute(select(func.count(Execution.id)))).scalar()

    # Revenue estimate
    pro_count = (await db.execute(
        select(func.count(Subscription.id)).where(Subscription.plan == PlanType.PRO)
    )).scalar()
    business_count = (await db.execute(
        select(func.count(Subscription.id)).where(Subscription.plan == PlanType.BUSINESS)
    )).scalar()
    estimated_mrr = (pro_count * 19) + (business_count * 49)

    return {
        "total_users": total_users,
        "active_subscriptions": active_subs,
        "total_workflows": total_workflows,
        "total_executions": total_executions,
        "estimated_mrr": estimated_mrr,
        "pro_subscribers": pro_count,
        "business_subscribers": business_count,
    }


@router.get("/subscriptions")
async def list_subscriptions(
    plan: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all subscriptions."""
    query = select(Subscription)
    if plan:
        query = query.where(Subscription.plan == PlanType(plan))
    result = await db.execute(query.order_by(Subscription.created_at.desc()))
    return result.scalars().all()


@router.put("/integrations/{integration_id}")
async def update_integration(
    integration_id: str,
    enabled: bool,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Enable or disable an integration."""
    result = await db.execute(
        select(Integration).where(Integration.id == integration_id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    integration.enabled = enabled
    await db.commit()
    return {"message": f"Integration {'enabled' if enabled else 'disabled'}"}


# ─── Global API Key Management ───


class GlobalApiKeyRequest(BaseModel):
    slug: str
    api_key: str


@router.post("/api-keys")
async def save_global_api_key(
    data: GlobalApiKeyRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Save a global API key for an AI provider (admin only).
    These keys are used by the platform for all users."""
    # Find the integration
    result = await db.execute(select(Integration).where(Integration.slug == data.slug))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    encrypted = encrypt_credentials({"api_key": data.api_key})

    # Check if already exists for admin
    existing = await db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == current_user.id,
            UserIntegration.integration_id == integration.id,
        )
    )
    user_integration = existing.scalar_one_or_none()

    if user_integration:
        user_integration.credentials = {"encrypted": encrypted, "global": True}
        user_integration.status = "connected"
    else:
        user_integration = UserIntegration(
            user_id=current_user.id,
            integration_id=integration.id,
            credentials={"encrypted": encrypted, "global": True},
            status="connected",
        )
        db.add(user_integration)

    await db.commit()
    return {"message": f"Global API key for {integration.name} saved"}


@router.get("/api-keys")
async def list_global_api_keys(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all global API keys configured by admin (masked)."""
    # Get all admin's integrations that have global flag
    result = await db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == current_user.id,
        )
    )
    connections = result.scalars().all()

    keys = []
    for conn in connections:
        # Get integration details
        int_result = await db.execute(
            select(Integration).where(Integration.id == conn.integration_id)
        )
        integration = int_result.scalar_one_or_none()
        if not integration:
            continue

        # Mask the key
        try:
            creds = decrypt_credentials(conn.credentials.get("encrypted", ""))
            raw_key = creds.get("api_key", "")
            masked = raw_key[:8] + "..." + raw_key[-4:] if len(raw_key) > 12 else "••••••••"
        except Exception:
            masked = "••••••••"

        keys.append({
            "slug": integration.slug,
            "name": integration.name,
            "category": integration.category,
            "masked_key": masked,
            "status": conn.status,
            "connected_at": str(conn.connected_at) if conn.connected_at else None,
        })

    return keys


@router.delete("/api-keys/{slug}")
async def delete_global_api_key(
    slug: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a global API key."""
    result = await db.execute(select(Integration).where(Integration.slug == slug))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    result = await db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == current_user.id,
            UserIntegration.integration_id == integration.id,
        )
    )
    conn = result.scalar_one_or_none()
    if conn:
        await db.delete(conn)
        await db.commit()
    return {"message": f"Global key for {integration.name} removed"}


# ─── User Usage Tracking ───


@router.get("/usage")
async def get_user_usage(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get per-user usage stats for message tracking."""
    # Get all users with their workflow and execution counts
    users_result = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(100)
    )
    users = users_result.scalars().all()

    usage_data = []
    for user in users:
        # Count workflows
        wf_count = (await db.execute(
            select(func.count(Workflow.id)).where(Workflow.user_id == user.id)
        )).scalar() or 0

        # Count executions (messages)
        exec_count = (await db.execute(
            select(func.count(Execution.id)).where(Execution.workflow_id.in_(
                select(Workflow.id).where(Workflow.user_id == user.id)
            ))
        )).scalar() or 0

        # Get subscription info
        sub_result = await db.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
        sub = sub_result.scalar_one_or_none()

        # Count connected integrations
        conn_count = (await db.execute(
            select(func.count(UserIntegration.id)).where(
                UserIntegration.user_id == user.id,
                UserIntegration.status == "connected",
            )
        )).scalar() or 0

        usage_data.append({
            "id": str(user.id),
            "name": user.name or "—",
            "email": user.email,
            "plan": sub.plan.value if sub else "free",
            "workflows": wf_count,
            "executions": exec_count,
            "runs_used": sub.runs_used if sub else 0,
            "run_limit": sub.monthly_run_limit if sub else 0,
            "connected_integrations": conn_count,
            "joined": str(user.created_at) if user.created_at else None,
        })

    return usage_data


# ── Pricing Management ──

class PlanUpdate(BaseModel):
    name: str
    price_monthly: float
    agent_limit: int = 1
    message_limit: int = 500
    features: list[str]

    class Config:
        extra = "ignore"  # Accept legacy fields without error


@router.get("/pricing")
async def get_pricing(_admin: User = Depends(require_admin)):
    """Get all plan configurations."""
    from app.api.billing import load_plans
    return load_plans()


@router.put("/pricing/{plan_key}")
async def update_pricing(
    plan_key: str,
    data: PlanUpdate,
    _admin: User = Depends(require_admin),
):
    """Update a specific plan's pricing and limits."""
    from app.api.billing import load_plans, save_plans

    if plan_key not in ("free", "starter", "growth", "business"):
        raise HTTPException(status_code=400, detail="Invalid plan key")

    plans = load_plans()
    plans[plan_key] = data.model_dump()
    save_plans(plans)

    return {"message": f"{plan_key} plan updated", "plan": plans[plan_key]}


# ── Tools Management ──

from app.models.tool import Tool
from datetime import datetime


class ToolCreate(BaseModel):
    slug: str
    name: str
    icon: str = "🔧"
    description: str = ""
    category: str = "general"
    enabled: bool = True
    badge: str = "stable"
    sort_order: int = 0


class ToolUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    enabled: Optional[bool] = None
    badge: Optional[str] = None
    sort_order: Optional[int] = None
    config: Optional[dict] = None


@router.get("/tools")
async def admin_list_tools(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all tools (admin view - includes disabled)."""
    result = await db.execute(select(Tool).order_by(Tool.sort_order))
    tools = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "slug": t.slug,
            "name": t.name,
            "icon": t.icon,
            "description": t.description,
            "category": t.category,
            "enabled": t.enabled,
            "badge": t.badge,
            "sort_order": t.sort_order,
            "config": t.config or {},
        }
        for t in tools
    ]


@router.post("/tools")
async def admin_create_tool(
    data: ToolCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new tool."""
    # Check for duplicate slug
    existing = await db.execute(select(Tool).where(Tool.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tool slug already exists")

    tool = Tool(**data.model_dump())
    db.add(tool)
    await db.commit()
    await db.refresh(tool)
    return {"id": str(tool.id), "slug": tool.slug, "name": tool.name}


@router.put("/tools/{tool_id}")
async def admin_update_tool(
    tool_id: str,
    data: ToolUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a tool (enable/disable/coming_soon)."""
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(tool, field, value)
    tool.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Tool updated", "slug": tool.slug}


@router.delete("/tools/{tool_id}")
async def admin_delete_tool(
    tool_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a tool."""
    result = await db.execute(select(Tool).where(Tool.id == tool_id))
    tool = result.scalar_one_or_none()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    await db.delete(tool)
    await db.commit()
    return {"detail": "Tool deleted"}


# ── Channels Management ──

from app.models.admin_channel import AdminChannel

class ChannelCreate(BaseModel):
    slug: str
    name: str
    icon: str = "📱"
    description: str = ""
    enabled: bool = True
    badge: str = "stable"
    is_upcoming: bool = False
    sort_order: int = 0

class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    badge: Optional[str] = None
    is_upcoming: Optional[bool] = None
    sort_order: Optional[int] = None


@router.get("/channels")
async def admin_list_channels(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all channels (admin view - includes disabled and upcoming)."""
    result = await db.execute(select(AdminChannel).order_by(AdminChannel.sort_order))
    channels = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "slug": c.slug,
            "name": c.name,
            "icon": c.icon,
            "description": c.description,
            "enabled": c.enabled,
            "badge": c.badge,
            "is_upcoming": c.is_upcoming,
            "sort_order": c.sort_order,
        }
        for c in channels
    ]

@router.post("/channels")
async def admin_create_channel(
    data: ChannelCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new channel."""
    existing = await db.execute(select(AdminChannel).where(AdminChannel.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Channel slug already exists")

    channel = AdminChannel(**data.model_dump())
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return {"id": str(channel.id), "slug": channel.slug, "name": channel.name}

@router.put("/channels/{channel_id}")
async def admin_update_channel(
    channel_id: str,
    data: ChannelUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a channel (enable/disable/upcoming)."""
    result = await db.execute(select(AdminChannel).where(AdminChannel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(channel, field, value)
    channel.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Channel updated", "slug": channel.slug}

@router.delete("/channels/{channel_id}")
async def admin_delete_channel(
    channel_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a channel."""
    result = await db.execute(select(AdminChannel).where(AdminChannel.id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    await db.delete(channel)
    await db.commit()
    return {"detail": "Channel deleted"}

@router.post("/channels/seed")
async def seed_default_channels(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Seed the database with the default channel list if empty."""
    result = await db.execute(select(AdminChannel))
    if result.scalars().first():
        return {"message": "Channels already seeded."}

    defaults = [
        {"slug": "web", "name": "Web Widget", "icon": "🌐", "description": "Embeddable web chat widget", "sort_order": 1},
        {"slug": "telegram", "name": "Telegram", "icon": "✈️", "description": "Telegram bot integration", "sort_order": 2},
        {"slug": "whatsapp", "name": "WhatsApp", "icon": "💬", "description": "WhatsApp business API", "sort_order": 3, "is_upcoming": False, "badge": "beta", "enabled": True},
        {"slug": "discord", "name": "Discord", "icon": "🎮", "description": "Discord bot integration", "sort_order": 4, "is_upcoming": False, "enabled": True},
        {"slug": "slack", "name": "Slack", "icon": "💼", "description": "Slack app integration", "sort_order": 5, "is_upcoming": False, "enabled": True},
        {"slug": "instagram", "name": "Instagram", "icon": "📸", "description": "Instagram DM bot", "sort_order": 6, "is_upcoming": True, "badge": "coming_soon", "enabled": False},
    ]

    for c_data in defaults:
        db.add(AdminChannel(**c_data))
    
    await db.commit()
    return {"message": "Default channels seeded successfully."}


# ── AI Model Access Control ──

import json, os

MODELS_CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models_config.json")

def load_models_config() -> dict:
    """Load model-plan access config from JSON file."""
    try:
        with open(MODELS_CONFIG_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"providers": []}


def save_models_config(config: dict):
    """Save model-plan access config to JSON file."""
    with open(MODELS_CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


@router.get("/models")
async def get_models_config(_admin: User = Depends(require_admin)):
    """Get the model-plan access control matrix."""
    return load_models_config()


@router.put("/models")
async def update_models_config(
    request: Request,
    _admin: User = Depends(require_admin),
):
    """Update the model-plan access control matrix."""

    body = await request.json()
    if "providers" not in body:
        raise HTTPException(status_code=400, detail="Invalid config: missing 'providers'")
    save_models_config(body)
    return {"message": "Model access configuration saved successfully."}


# ── Platform Settings ──

PLATFORM_SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "platform_settings.json")

def load_platform_settings() -> dict:
    try:
        with open(PLATFORM_SETTINGS_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"max_scrape_pages": 10, "max_content_size_kb": 200}


def save_platform_settings(config: dict):
    with open(PLATFORM_SETTINGS_FILE, "w") as f:
        json.dump(config, f, indent=2)


@router.get("/settings")
async def get_platform_settings(_admin: User = Depends(require_admin)):
    """Get platform settings."""
    return load_platform_settings()


# ── Public Landing Page Settings (no auth required) ──

from fastapi import APIRouter as _APIRouter

landing_router = APIRouter(prefix="/api", tags=["landing"])


@landing_router.get("/landing-settings")
async def get_landing_settings():
    """Public endpoint: returns only landing-page visibility flags."""
    settings = load_platform_settings()
    return {
        "show_autonomous_skills_section": settings.get("show_autonomous_skills_section", True),
    }


@router.put("/settings")
async def update_platform_settings(
    request: Request,
    _admin: User = Depends(require_admin),
):
    """Update platform settings."""
    body = await request.json()
    # Validate
    max_pages = body.get("max_scrape_pages", 10)
    max_size = body.get("max_content_size_kb", 200)
    if not isinstance(max_pages, int) or max_pages < 1 or max_pages > 500:
        raise HTTPException(status_code=400, detail="max_scrape_pages must be between 1 and 500")
    if not isinstance(max_size, int) or max_size < 50 or max_size > 1000:
        raise HTTPException(status_code=400, detail="max_content_size_kb must be between 50 and 1000")
    save_platform_settings(body)
    return {"message": "Settings saved successfully."}


# ── Autonomous Skills Management ──

from app.models.skill import Skill


class SkillCreate(BaseModel):
    slug: str
    name: str
    icon: str = "🔧"
    description: str = ""
    schedule: str = "Daily"
    tags: list[str] = []
    gradient: str = "from-slate-500/20 to-slate-600/10"
    icon_bg: str = "from-slate-500 to-slate-400"
    enabled: bool = True
    sort_order: int = 0


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    schedule: Optional[str] = None
    tags: Optional[list[str]] = None
    gradient: Optional[str] = None
    icon_bg: Optional[str] = None
    enabled: Optional[bool] = None
    sort_order: Optional[int] = None


@router.get("/skills")
async def admin_list_skills(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all skills (admin view - includes hidden)."""
    result = await db.execute(select(Skill).order_by(Skill.sort_order))
    skills = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "slug": s.slug,
            "name": s.name,
            "icon": s.icon,
            "description": s.description,
            "schedule": s.schedule,
            "tags": s.tags or [],
            "gradient": s.gradient,
            "icon_bg": s.icon_bg,
            "enabled": s.enabled,
            "sort_order": s.sort_order,
        }
        for s in skills
    ]


@router.post("/skills")
async def admin_create_skill(
    data: SkillCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new autonomous skill."""
    existing = await db.execute(select(Skill).where(Skill.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Skill slug already exists")

    skill = Skill(**data.model_dump())
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return {"id": str(skill.id), "slug": skill.slug, "name": skill.name}


@router.put("/skills/{skill_id}")
async def admin_update_skill(
    skill_id: str,
    data: SkillUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a skill (enable/disable/edit)."""
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(skill, field, value)
    skill.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Skill updated", "slug": skill.slug}


@router.delete("/skills/{skill_id}")
async def admin_delete_skill(
    skill_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a skill."""
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    await db.delete(skill)
    await db.commit()
    return {"detail": "Skill deleted"}


@router.post("/skills/seed")
async def seed_default_skills(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Seed the database with default autonomous skills if empty."""
    result = await db.execute(select(Skill))
    if result.scalars().first():
        return {"message": "Skills already seeded."}

    defaults = [
        {"slug": "market-analyst", "name": "Market Analyst", "icon": "📈",
         "description": "Monitors asset prices & market trends. Alerts you when critical thresholds are met.",
         "schedule": "Hourly", "tags": ["Web Search", "Proactive Alerts"],
         "gradient": "from-emerald-500/20 to-teal-500/10", "icon_bg": "from-emerald-500 to-teal-400", "sort_order": 1},
        {"slug": "news-sentinel", "name": "News Sentinel", "icon": "📰",
         "description": "Scans global news for keywords or entities and alerts you of important developments.",
         "schedule": "Daily at 8 AM", "tags": ["Web Search", "Proactive Alerts"],
         "gradient": "from-blue-500/20 to-indigo-500/10", "icon_bg": "from-blue-500 to-indigo-400", "sort_order": 2},
        {"slug": "competitor-watcher", "name": "Competitor Watcher", "icon": "🔍",
         "description": "Checks competitor websites for major updates, product launches, or pricing changes.",
         "schedule": "Weekly", "tags": ["Web Search", "Proactive Alerts"],
         "gradient": "from-violet-500/20 to-purple-500/10", "icon_bg": "from-violet-500 to-purple-400", "sort_order": 3},
        {"slug": "github-issue-triage", "name": "GitHub Issue Triage", "icon": "🐙",
         "description": "Scans your repos for unassigned or critical issues and summarizes them for you.",
         "schedule": "Hourly (9-5)", "tags": ["GitHub Data", "Proactive Alerts"],
         "gradient": "from-orange-500/20 to-amber-500/10", "icon_bg": "from-orange-500 to-amber-400", "sort_order": 4},
        {"slug": "daily-briefing", "name": "Daily Briefing", "icon": "☀️",
         "description": "Gathers your schedule, weather, and breaking news into one concise morning alert.",
         "schedule": "Daily at 7 AM", "tags": ["Calendar", "Weather", "News"],
         "gradient": "from-cyan-500/20 to-sky-500/10", "icon_bg": "from-cyan-500 to-sky-400", "sort_order": 5},
        {"slug": "deep-researcher", "name": "Deep Researcher", "icon": "🧬",
         "description": "Performs multi-step web research on a topic and synthesizes a comprehensive report.",
         "schedule": "Custom", "tags": ["Multi-Step Search", "Reports"],
         "gradient": "from-rose-500/20 to-pink-500/10", "icon_bg": "from-rose-500 to-pink-400", "sort_order": 6},
    ]

    for s_data in defaults:
        db.add(Skill(**s_data))

    await db.commit()
    return {"message": "Default skills seeded successfully."}


# ── Public Skills Endpoint (no auth) ──

@landing_router.get("/skills")
async def list_public_skills(db: AsyncSession = Depends(get_db)):
    """Public endpoint: returns only enabled skills for the autonomous page."""
    result = await db.execute(
        select(Skill).where(Skill.enabled == True).order_by(Skill.sort_order)
    )
    skills = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "slug": s.slug,
            "name": s.name,
            "icon": s.icon,
            "description": s.description,
            "schedule": s.schedule,
            "tags": s.tags or [],
            "gradient": s.gradient,
            "icon_bg": s.icon_bg,
        }
        for s in skills
    ]

