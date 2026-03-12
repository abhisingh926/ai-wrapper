import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import asyncio
from sqlalchemy import select
from app.database import async_session
from app.models.user import User
from app.api.auth import create_access_token

async def main():
    async with async_session() as session:
        result = await session.execute(select(User).where(User.role == "admin"))
        admin = result.scalars().first()
        if admin:
            token = create_access_token(data={"sub": str(admin.id)})
            print(token)
        else:
            print("NO_ADMIN")

asyncio.run(main())
