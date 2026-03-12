import asyncio
from sqlalchemy import select
from app.database import async_session
from app.models.integration import Integration, UserIntegration

async def main():
    async with async_session() as db:
        result = await db.execute(select(UserIntegration))
        user_ints = result.scalars().all()
        for u in user_ints:
            print(f"User ID: {u.user_id}, Integration ID: {u.integration_id}")
            # get integration details to print slug
            int_res = await db.execute(select(Integration).where(Integration.id == u.integration_id))
            integration = int_res.scalar_one_or_none()
            if integration:
                print(f"  Slug: {integration.slug}")
        if not user_ints:
            print("No UserIntegrations found.")

asyncio.run(main())
