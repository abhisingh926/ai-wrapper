import httpx
from app.config import get_settings

settings = get_settings()


async def send_verification_email(to_email: str, token: str):
    """Send email verification link."""
    verification_url = f"{settings.FRONTEND_URL}/verify?token={token}"
    
    if not settings.RESEND_API_KEY:
        # Development mode: just log the URL
        print(f"[DEV] Verification URL for {to_email}: {verification_url}")
        return True

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={
                "from": settings.FROM_EMAIL,
                "to": to_email,
                "subject": "Verify your email - AI Wrapper Platform",
                "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to AI Wrapper Platform!</h2>
                    <p>Please verify your email address by clicking the button below:</p>
                    <a href="{verification_url}" 
                       style="display: inline-block; background: #6366f1; color: white; 
                              padding: 12px 24px; border-radius: 8px; text-decoration: none;
                              margin: 16px 0;">
                        Verify Email
                    </a>
                    <p style="color: #666;">If you didn't create an account, you can ignore this email.</p>
                </div>
                """,
            },
        )
        return response.status_code == 200


async def send_reset_password_email(to_email: str, token: str):
    """Send password reset link."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    if not settings.RESEND_API_KEY:
        print(f"[DEV] Reset URL for {to_email}: {reset_url}")
        return True

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={
                "from": settings.FROM_EMAIL,
                "to": to_email,
                "subject": "Reset your password - AI Wrapper Platform",
                "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Password Reset</h2>
                    <p>Click the button below to reset your password:</p>
                    <a href="{reset_url}"
                       style="display: inline-block; background: #6366f1; color: white;
                              padding: 12px 24px; border-radius: 8px; text-decoration: none;
                              margin: 16px 0;">
                        Reset Password
                    </a>
                    <p style="color: #666;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
                </div>
                """,
            },
        )
        return response.status_code == 200
