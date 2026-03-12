import asyncio
from sqlalchemy import select
from app.database import async_session
from app.models.user import User
from app.api.auth import create_access_token
import httpx

async def main():
    async with async_session() as session:
        result = await session.execute(select(User).where(User.role == "admin"))
        admin = result.scalars().first()
        if not admin:
            print("No admin found.")
            return
        
        token = create_access_token(data={"sub": str(admin.id)})
        
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                "http://localhost:8000/api/admin/api-keys/whatsapp",
                headers={"Authorization": f"Bearer {token}"}
            )
            print("STATUS:", resp.status_code)
            print("BODY:", resp.text)

asyncio.run(main())
