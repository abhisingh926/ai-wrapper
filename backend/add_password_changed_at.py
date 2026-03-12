import asyncio
from sqlalchemy import text
from app.database import async_session

async def main():
    async with async_session() as session:
        try:
            await session.execute(text(
                "ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP WITHOUT TIME ZONE"
            ))
            print("Added password_changed_at column to users table")
        except Exception as e:
            print(f"Error adding password_changed_at (may already exist): {e}")

        await session.commit()

asyncio.run(main())
