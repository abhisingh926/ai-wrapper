"""
Skills API — User-facing endpoints for skill configuration and testing.
"""

import json
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import litellm
import httpx

from app.database import get_db
from app.models.user import User
from app.models.skill import Skill
from app.models.skill_config import UserSkillConfig
from app.models.skill_message_log import SkillMessageLog
from app.models.integration import Integration, UserIntegration
from app.middleware.auth import get_current_user
from app.utils.encryption import decrypt_credentials
from app.services.web_search import web_search

router = APIRouter(prefix="/api/skills", tags=["skills"])


# ── Schemas ──

class SkillConfigSave(BaseModel):
    market_type: str = "crypto"
    custom_prompt: str = ""
    notify_channel: str = "email"
    notify_target: str = ""
    notify_country_code: str = "+1"
    notify_time: str = "08:00"
    notify_timezone: str = "UTC"
    is_active: bool = False


class SkillTestRequest(BaseModel):
    market_type: str = "crypto"
    custom_prompt: str = ""


# ── Config CRUD ──

@router.get("/{skill_id}/config")
async def get_skill_config(
    skill_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Load user's config for a skill."""
    result = await db.execute(
        select(UserSkillConfig).where(
            UserSkillConfig.user_id == current_user.id,
            UserSkillConfig.skill_id == skill_id,
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        return {
            "market_type": "crypto",
            "custom_prompt": "",
            "notify_channel": "email",
            "notify_target": "",
            "notify_country_code": "+1",
            "notify_time": "08:00",
            "notify_timezone": "UTC",
            "is_active": False,
        }
    return {
        "market_type": config.market_type,
        "custom_prompt": config.custom_prompt,
        "notify_channel": config.notify_channel,
        "notify_target": config.notify_target,
        "notify_country_code": config.notify_country_code,
        "notify_time": config.notify_time,
        "notify_timezone": config.notify_timezone,
        "is_active": config.is_active,
    }


@router.post("/{skill_id}/config")
async def save_skill_config(
    skill_id: str,
    data: SkillConfigSave,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save user's config for a skill."""
    result = await db.execute(
        select(UserSkillConfig).where(
            UserSkillConfig.user_id == current_user.id,
            UserSkillConfig.skill_id == skill_id,
        )
    )
    config = result.scalar_one_or_none()

    if config:
        config.market_type = data.market_type
        config.custom_prompt = data.custom_prompt
        config.notify_channel = data.notify_channel
        config.notify_target = data.notify_target
        config.notify_country_code = data.notify_country_code
        config.notify_time = data.notify_time
        config.notify_timezone = data.notify_timezone
        config.is_active = data.is_active
    else:
        config = UserSkillConfig(
            user_id=current_user.id,
            skill_id=skill_id,
            **data.model_dump(),
        )
        db.add(config)

    await db.commit()
    return {"detail": "Config saved"}


# ── Logs & History ──

@router.get("/{skill_id}/logs")
async def get_skill_logs(
    skill_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch history of messages sent by this skill for the user."""
    result = await db.execute(
        select(SkillMessageLog)
        .where(
            SkillMessageLog.user_id == current_user.id,
            SkillMessageLog.skill_id == skill_id,
        )
        .order_by(SkillMessageLog.created_at.desc())
        .limit(50)
    )
    logs = result.scalars().all()
    
    return [
        {
            "id": str(log.id),
            "content": log.content,
            "channel": log.channel,
            "target": log.target,
            "status": log.status,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


# ── Test Skill ──

MARKET_LABELS = {
    "crypto": "Cryptocurrency Market (Bitcoin, Ethereum, Solana, etc.)",
    "indian": "Indian Stock Market (NSE/BSE — Nifty 50, Sensex)",
    "forex": "Forex Market (Currency pairs — EUR/USD, GBP/USD, etc.)",
    "custom": "Custom Market Query",
}


async def _get_llm_api_key(db: AsyncSession) -> tuple[str, str]:
    """Fetch admin-configured OpenAI/Google/Anthropic API key."""
    for provider_slug in ("openai", "google", "anthropic"):
        try:
            int_result = await db.execute(
                select(Integration).where(Integration.slug == provider_slug)
            )
            integration = int_result.scalar_one_or_none()
            if not integration:
                continue
            ui_result = await db.execute(
                select(UserIntegration).where(
                    UserIntegration.integration_id == integration.id,
                    UserIntegration.status == "connected",
                )
            )
            user_integration = ui_result.scalars().first()
            if user_integration and user_integration.credentials:
                encrypted = user_integration.credentials.get("encrypted", "")
                if encrypted:
                    creds = decrypt_credentials(encrypted)
                    api_key = creds.get("api_key", "")
                    if api_key:
                        if provider_slug == "google":
                            return api_key, "gemini/gemini-2.0-flash"
                        elif provider_slug == "anthropic":
                            return api_key, "anthropic/claude-sonnet-4-20250514"
                        else:
                            return api_key, "gpt-4o-mini"
        except Exception:
            continue
    return "", ""


@router.post("/{skill_id}/test")
async def test_skill(
    skill_id: str,
    data: SkillTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Run a test of the Market Analyst skill:
    1. Build search queries based on market_type + custom_prompt
    2. Search the web
    3. Feed results to LLM for analysis
    4. Return the analysis
    """
    # 1. Build search queries
    market_label = MARKET_LABELS.get(data.market_type, "Financial Market")
    queries = []

    if data.custom_prompt.strip():
        queries.append(f"{data.custom_prompt.strip()} latest market analysis today")
        queries.append(f"{data.custom_prompt.strip()} price prediction outlook")
    else:
        if data.market_type == "crypto":
            queries.append("cryptocurrency market analysis today Bitcoin Ethereum price")
            queries.append("best crypto to buy today 2025 analysis")
        elif data.market_type == "indian":
            queries.append("Indian stock market today Nifty 50 Sensex analysis")
            queries.append("best stocks to buy today India NSE BSE")
        elif data.market_type == "forex":
            queries.append("Forex market analysis today EUR/USD GBP/USD trends")
            queries.append("best forex pairs to trade today analysis")
        else:
            queries.append("stock market analysis today top picks")
            queries.append("best investments today market outlook")

    # 2. Search the web
    all_results = []
    for q in queries[:2]:
        search_result = await web_search(q)
        if search_result.get("results"):
            all_results.extend(search_result["results"])

    if not all_results:
        raise HTTPException(status_code=500, detail="Web search returned no results. Please try again.")

    # Build context from search results
    search_context = f"Web search results for {market_label}:\n\n"
    for i, r in enumerate(all_results[:8], 1):
        search_context += f"{i}. **{r.get('title', '')}**\n   {r.get('snippet', '')}\n   URL: {r.get('url', '')}\n\n"

    # 3. Get LLM API key
    api_key, model = await _get_llm_api_key(db)
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No AI provider API key configured. Ask your admin to add one in Admin Panel → API Keys."
        )

    # 4. Build LLM prompt
    custom_focus = ""
    if data.custom_prompt.strip():
        custom_focus = f"\n\nThe user is specifically interested in: **{data.custom_prompt.strip()}**\nFocus your analysis on these specific assets/topics."

    system_prompt = f"""You are a professional Market Analyst AI. Analyze the following web search results about the {market_label} and provide a comprehensive, actionable market briefing.{custom_focus}

Your report MUST be formatted strictly in clear, numbered or bulleted points. Do not write long paragraphs.

Your report MUST include the following structured points:
1. 📊 **Market Overview** — Current state and sentiment
2. 🔥 **Top Picks / Recommendations** — 3-5 specific assets with reasons (include current prices if available from search results)
3. ⚠️ **Risk Factors** — Key risks to watch
4. 📈 **Short-term Outlook** — Next 24-48 hours prediction
5. 💡 **Action Items** — Clear buy/sell/hold recommendations formatted as bullet points

Use markdown formatting. Be specific with numbers. Include disclaimer at the end.
Current date: {__import__('datetime').datetime.now().strftime('%B %d, %Y')}"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": search_context},
    ]

    # 5. Call LLM
    try:
        response = await litellm.acompletion(
            model=model,
            messages=messages,
            temperature=0.7,
            api_key=api_key,
        )
        analysis = response.choices[0].message.content
        
        # Log this execution to the database so the user has a "Run History"
        # We look up the user's config to see where they intend to send it
        config_result = await db.execute(
            select(UserSkillConfig).where(
                UserSkillConfig.user_id == current_user.id,
                UserSkillConfig.skill_id == skill_id,
            )
        )
        config = config_result.scalar_one_or_none()
        channel = config.notify_channel if config else "dashboard"
        target = config.notify_target if config else "Live Test"

        new_log = SkillMessageLog(
            user_id=current_user.id,
            skill_id=skill_id,
            content=analysis,
            channel=channel,
            target=target,
            status="sent (test)"
        )
        db.add(new_log)
        await db.commit()

        # Dispatch via WhatsApp Bridge if configured
        if channel == "whatsapp" and target and target.strip() != "Live Test":
            try:
                wa_bridge_url = os.environ.get("WA_BRIDGE_URL", "http://localhost:3001")
                country_code = config.notify_country_code if config and config.notify_country_code else "+1"
                
                # Remove any existing +, brackets, or spaces from the input target
                clean_target = ''.join(filter(str.isdigit, target))
                clean_cc = ''.join(filter(str.isdigit, country_code))
                full_phone = f"+{clean_cc}{clean_target}"

                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"{wa_bridge_url}/wa/send/global_admin_whatsapp",
                        json={"phone": full_phone, "message": analysis},
                        timeout=10.0
                    )
                    print(f"[{skill_id}] ✅ WhatsApp report dispatched to {full_phone}")
            except Exception as wa_err:
                print(f"[{skill_id}] ❌ Failed to dispatch WhatsApp message to target: {wa_err}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

    return {
        "analysis": analysis,
        "sources": [{"title": r.get("title", ""), "url": r.get("url", "")} for r in all_results[:6]],
        "market_type": data.market_type,
        "query_used": queries[0],
    }
