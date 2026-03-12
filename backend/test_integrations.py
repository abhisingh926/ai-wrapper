import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import asyncio
from sqlalchemy import select
from app.database import async_session
from app.models.integration import Integration

async def main():
    async with async_session() as db:
        result = await db.execute(select(Integration))
        integrations = result.scalars().all()
        for r in integrations:
            print(f"Slug: {r.slug}, Name: {r.name}")
        if not integrations:
            print("No integrations found.")

asyncio.run(main())
