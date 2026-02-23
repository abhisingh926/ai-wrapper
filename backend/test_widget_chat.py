import asyncio
import json
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.agent import Agent

async def main():
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/aiwrapper")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as db:
        result = await db.execute(select(Agent.id).limit(1))
        agent_id = result.scalar_one_or_none()
        if not agent_id:
            print("No agent found")
            return
        print(f"AGENT_ID={agent_id}")

loop = asyncio.get_event_loop()
loop.run_until_complete(main())
