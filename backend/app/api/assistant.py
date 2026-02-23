"""
AI Assistant endpoint — Lets users interact with connected integrations
via natural language commands.
"""

from typing import Optional, List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.config import get_settings
from app.models.user import User
from app.api.auth import get_current_user
from app.models.integration import UserIntegration, Integration
from app.services.integrations.registry import get_integration
from app.utils.encryption import decrypt_credentials
import re
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class PromptRequest(BaseModel):
    description: str


class QueryRequest(BaseModel):
    message: str
    app: Optional[str] = None  # optional slug to target a specific app


class QueryResponse(BaseModel):
    reply: str
    data: Optional[dict] = None
    app_used: Optional[str] = None


def parse_intent(message: str, connected_apps: List[str]) -> dict:
    """
    Simple intent parser — matches user messages to integration actions.
    Returns: { "app": slug, "action": action_name, "params": {...} }
    """
    msg = message.lower().strip()

    # ── Gmail intents ──
    if "gmail" in connected_apps:
        # Check if the message is about emails at all
        email_words = ["email", "mail", "inbox", "emails", "mails"]
        action_words = ["read", "check", "show", "get", "fetch", "latest", "recent",
                        "new", "unread", "my", "list", "open", "view", "display"]
        has_email_word = any(w in msg for w in email_words)
        has_action_word = any(w in msg for w in action_words)

        # Read / fetch emails
        if has_email_word and has_action_word:
            max_results = 5
            m = re.search(r"(\d+)\s*(email|emails|mail|mails|message|messages)", msg)
            if m:
                max_results = min(int(m.group(1)), 20)

            query = "ALL"
            if "unread" in msg:
                query = "UNSEEN"

            return {
                "app": "gmail",
                "action": "read_inbox",
                "params": {"max_results": max_results, "query": query},
            }

        # Search emails
        if any(kw in msg for kw in ["search email", "search mail", "find email", "find mail"]):
            # Extract search term after the keyword
            search_term = msg
            for kw in ["search email for", "search mail for", "search emails for",
                        "find email for", "find mail for", "find emails for",
                        "search email about", "search mail about", "find email about",
                        "search email", "search mail", "find email", "find mail"]:
                if kw in msg:
                    search_term = msg.split(kw, 1)[-1].strip().strip('"').strip("'")
                    break
            return {
                "app": "gmail",
                "action": "read_inbox",
                "params": {"max_results": 10, "query": f'SUBJECT "{search_term}"' if search_term else "ALL"},
            }

        # Send email
        if any(kw in msg for kw in ["send email", "send mail", "compose email",
                                     "write email", "email to"]):
            # Try to parse: send email to <addr> subject <subj> body <body>
            to_match = re.search(r"(?:to|email)\s+([\w.+-]+@[\w-]+\.[\w.]+)", msg)
            subj_match = re.search(r"subject\s+[\"']?(.+?)[\"']?\s*(?:body|message|$)", msg, re.IGNORECASE)
            body_match = re.search(r"(?:body|message|saying)\s+[\"']?(.+?)[\"']?\s*$", msg, re.IGNORECASE)

            if to_match:
                return {
                    "app": "gmail",
                    "action": "send_email",
                    "params": {
                        "to": to_match.group(1),
                        "subject": subj_match.group(1) if subj_match else "Message from AI Wrapper",
                        "body": body_match.group(1) if body_match else "Sent via AI Wrapper",
                    },
                }
            return {
                "app": "gmail",
                "action": "need_info",
                "params": {},
                "message": "I can send an email! Please provide:\n• **To**: recipient email address\n• **Subject**: email subject\n• **Body**: message content\n\nExample: `Send email to john@example.com subject Hello body How are you?`"
            }

    # ── Telegram intents ──
    if "telegram" in connected_apps:
        if any(kw in msg for kw in ["send telegram", "telegram message", "send message on telegram",
                                     "send msg telegram", "message on telegram"]):
            chat_match = re.search(r"(?:to|chat)\s+(\d+)", msg)
            msg_match = re.search(r"(?:saying|message|body|msg)\s+[\"']?(.+?)[\"']?\s*$", msg, re.IGNORECASE)

            if chat_match and msg_match:
                return {
                    "app": "telegram",
                    "action": "send_message",
                    "params": {
                        "chat_id": chat_match.group(1),
                        "message": msg_match.group(1),
                    },
                }
            return {
                "app": "telegram",
                "action": "need_info",
                "params": {},
                "message": "I can send a Telegram message! Please provide:\n• **Chat ID**: the recipient's chat ID\n• **Message**: what to send\n\nExample: `Send Telegram to 5070526893 saying Hello!`"
            }

    # ── Help / list connected apps ──
    if any(kw in msg for kw in ["help", "what can you do", "what can i do",
                                 "which app", "connected app", "available"]):
        return {"app": None, "action": "help", "params": {}}

    # ── No match ──
    return {"app": None, "action": "unknown", "params": {}}


@router.post("/generate-prompt")
async def generate_prompt(
    req: PromptRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a comprehensive agent system prompt from a short user description."""
    settings = get_settings()
    
    # If the user has not configured OpenAI yet, use a mock response for demonstration
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "":
        import asyncio
        await asyncio.sleep(1.5) # Simulate API latency
        mock_prompt = (
            f"You are a helpful and specialized AI assistant. Your primary instruction is: '{req.description}'. "
            "You must embody this persona completely. Speak and act according to this description. "
            "Always be polite, concise, and helpful."
        )
        return {"prompt": mock_prompt}

    system_instructions = (
        "You are an expert AI prompt engineer. "
        "The user will give you a brief description of an AI assistant they want to create. "
        "Your job is to expand that short description into a highly detailed, professional, "
        "and effective system prompt for an LLM. "
        "The output should ONLY contain the generated prompt text, without any conversational filler or introductions."
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_instructions},
                        {"role": "user", "content": req.description}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 800
                }
            )
            resp.raise_for_status()
            data = resp.json()
            generated_text = data["choices"][0]["message"]["content"].strip()
            return {"prompt": generated_text}
    except Exception as e:
        logger.error(f"Error generating prompt: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate prompt from AI provider.")


@router.post("/query", response_model=QueryResponse)
async def assistant_query(
    req: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Process a user query and interact with connected integrations."""

    # 1. Get user's connected integrations
    result = await db.execute(
        select(UserIntegration, Integration)
        .join(Integration, UserIntegration.integration_id == Integration.id)
        .where(
            UserIntegration.user_id == current_user.id,
            UserIntegration.status == "connected",
        )
    )
    connections = result.all()
    connected_map = {}
    for ui, integ in connections:
        connected_map[integ.slug] = ui

    connected_apps = list(connected_map.keys())

    if not connected_apps:
        return QueryResponse(
            reply="You don't have any connected apps yet. Go to **Integrations** to connect Gmail, Telegram, or other apps first!",
            data=None,
            app_used=None,
        )

    # 2. Parse intent
    intent = parse_intent(req.message, connected_apps)

    # If user specified a specific app via dropdown
    if req.app and req.app in connected_apps:
        intent["app"] = req.app

    # 3. Handle special cases
    if intent["action"] == "help":
        app_icons = {"gmail": "📧", "telegram": "✈️", "discord": "🎮", "slack": "💼",
                     "openai": "🤖", "anthropic": "🧠", "notion": "📝", "github": "🐙",
                     "trello": "📋", "spotify": "🎵", "twitter": "🐦", "webhooks": "🔗"}
        app_list = "\n".join([f"• {app_icons.get(a, '🔌')} **{a.title()}**" for a in connected_apps])
        help_text = f"Here are your connected apps:\n\n{app_list}\n\n**Things you can ask:**\n• 📧 \"Show my latest 5 emails\"\n• 📧 \"Check unread emails\"\n• 📧 \"Search emails about invoices\"\n• 📧 \"Send email to john@example.com subject Hi body Hello!\"\n• ✈️ \"Send Telegram to 12345 saying Hello!\""
        return QueryResponse(reply=help_text, data={"connected_apps": connected_apps}, app_used=None)

    if intent["action"] == "need_info":
        return QueryResponse(reply=intent.get("message", "I need more details."), data=None, app_used=intent.get("app"))

    if intent["action"] == "unknown":
        suggestions = []
        if "gmail" in connected_apps:
            suggestions.extend(["Show my latest emails", "Check unread emails", "Search emails about [topic]"])
        if "telegram" in connected_apps:
            suggestions.append("Send Telegram to [chat_id] saying [message]")
        sug_text = "\n".join([f"• `{s}`" for s in suggestions])
        return QueryResponse(
            reply=f"I'm not sure what you'd like to do. Try one of these:\n\n{sug_text}\n\nOr type **help** to see all options.",
            data=None,
            app_used=None,
        )

    # 4. Execute the action
    app_slug = intent["app"]
    if app_slug not in connected_map:
        return QueryResponse(
            reply=f"**{app_slug.title()}** is not connected. Go to Integrations to connect it first.",
            data=None,
            app_used=None,
        )

    try:
        # Get credentials
        ui = connected_map[app_slug]
        encrypted = ui.credentials.get("encrypted", "")
        creds = decrypt_credentials(encrypted) if encrypted else {}

        # Get integration instance and execute
        integration = get_integration(app_slug)
        result = await integration.execute_action(
            action=intent["action"],
            config=intent["params"],
            credentials=creds,
        )

        # Format response
        if result.get("status") == "error":
            return QueryResponse(
                reply=f"❌ Error from {app_slug.title()}: {result.get('message', 'Unknown error')}",
                data=result,
                app_used=app_slug,
            )

        # Format based on action type
        if intent["action"] == "read_inbox":
            emails = result.get("emails", [])
            count = result.get("count", 0)
            if count == 0:
                reply = "📭 No emails found matching your query."
            else:
                reply = f"📬 Found **{count}** email(s):\n\n"
                for i, em in enumerate(emails[:10], 1):
                    sender = em.get("from", "Unknown")
                    subject = em.get("subject", "(No Subject)")
                    date = em.get("date", "")
                    body_preview = em.get("body", "")[:150].replace("\n", " ")
                    reply += f"**{i}. {subject}**\n"
                    reply += f"   From: {sender}\n"
                    reply += f"   Date: {date}\n"
                    if body_preview:
                        reply += f"   Preview: _{body_preview}..._\n"
                    reply += "\n"
            return QueryResponse(reply=reply, data=result, app_used=app_slug)

        elif intent["action"] == "send_email":
            return QueryResponse(
                reply=f"✅ Email sent successfully!\n\n• **To**: {result.get('to', 'N/A')}\n• **Subject**: {result.get('subject', 'N/A')}",
                data=result,
                app_used=app_slug,
            )

        elif intent["action"] == "send_message":
            return QueryResponse(
                reply=f"✅ Telegram message sent to chat `{result.get('chat_id', 'N/A')}`!",
                data=result,
                app_used=app_slug,
            )

        else:
            return QueryResponse(
                reply=f"✅ Action completed on {app_slug.title()}.",
                data=result,
                app_used=app_slug,
            )

    except Exception as e:
        logger.error(f"Assistant query error: {e}")
        return QueryResponse(
            reply=f"❌ Something went wrong: {str(e)}",
            data=None,
            app_used=app_slug,
        )
