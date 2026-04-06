import asyncio
from app.database import async_session
from app.models.tool import Tool

async def seed_tool():
    async with async_session() as session:
        tool = Tool(
            slug="knowledge_base_v2",
            name="Knowledge Base 2.0",
            icon="🧠",
            description="Vector Database RAG using Chroma. Upload huge PDFs or Scrape entire domains.",
            category="Data",
            badge="NEW",
            enabled=True,
            sort_order=2
        )
        session.add(tool)
        await session.commit()
        print("Knowledge Base 2.0 tool added to DB.")

if __name__ == "__main__":
    asyncio.run(seed_tool())
