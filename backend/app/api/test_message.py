import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.integration import Integration, UserIntegration
from app.middleware.auth import get_current_user
from app.utils.encryption import decrypt_credentials

router = APIRouter(prefix="/api/integrations", tags=["integration-actions"])


class TelegramTestRequest(BaseModel):
    chat_id: str
    message: str


@router.post("/telegram/test")
async def send_telegram_test_message(
    data: TelegramTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a test message via the user's connected Telegram bot."""
    # Find the Telegram integration
    result = await db.execute(select(Integration).where(Integration.slug == "telegram"))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Telegram integration not found")

    # Find user's connection
    result = await db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == current_user.id,
            UserIntegration.integration_id == integration.id,
            UserIntegration.status == "connected",
        )
    )
    user_integration = result.scalar_one_or_none()
    if not user_integration:
        raise HTTPException(status_code=400, detail="Telegram is not connected. Please add your bot token first.")

    # Decrypt credentials to get bot token
    try:
        encrypted = user_integration.credentials.get("encrypted", "")
        creds = decrypt_credentials(encrypted)
        bot_token = creds.get("api_key", "")
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt credentials. Try reconnecting Telegram.")

    if not bot_token:
        raise HTTPException(status_code=400, detail="Bot token is missing. Please reconnect Telegram.")

    # Send message via Telegram Bot API
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json={
            "chat_id": data.chat_id,
            "text": data.message,
            "parse_mode": "HTML",
        })

    if resp.status_code != 200:
        error_data = resp.json()
        description = error_data.get("description", "Unknown error")
        raise HTTPException(status_code=400, detail=f"Telegram error: {description}")

    return {"message": "Message sent successfully!", "telegram_response": resp.json()}
