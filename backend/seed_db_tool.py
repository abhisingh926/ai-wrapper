import asyncio
from app.database import async_session
from app.models.tool import Tool

async def seed_tool():
    async with async_session() as session:
        tool = Tool(
            slug="database_agent",
            name="Database Query Agent",
            icon="🗄️",
            description="Connect an external database (Postgres/MySQL). AI will automatically learn your schema and translate natural language into safe Read-Only SQL queries.",
            category="Data",
            badge="NEW",
            enabled=True,
            sort_order=3
        )
        session.add(tool)
        await session.commit()
        print("Database Agent tool added to DB.")

if __name__ == "__main__":
    asyncio.run(seed_tool())
