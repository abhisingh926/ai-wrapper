import asyncio
from sqlalchemy import text
from app.database import async_session

async def main():
    async with async_session() as session:
        # Add notify_country_code
        try:
            await session.execute(text("ALTER TABLE user_skill_configs ADD COLUMN notify_country_code VARCHAR(10) DEFAULT '+1'"))
            print("Added notify_country_code")
        except Exception as e:
            print(f"Error adding notify_country_code: {e}")
            
        # Add notify_timezone
        try:
            await session.execute(text("ALTER TABLE user_skill_configs ADD COLUMN notify_timezone VARCHAR(100) DEFAULT 'UTC'"))
            print("Added notify_timezone")
        except Exception as e:
            print(f"Error adding notify_timezone: {e}")
            
        await session.commit()

asyncio.run(main())
