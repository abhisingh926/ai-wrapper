import asyncio
from sqlalchemy import select
from app.database import async_session
from app.models.user import User
from app.models.agent import Agent
from app.api.auth import create_access_token

async def main():
    async with async_session() as session:
        result = await session.execute(select(Agent).order_by(Agent.created_at.desc()))
        agent = result.scalars().first()
        if agent:
            print(f"Agent ID: {agent.id}")
            user = await session.get(User, agent.user_id)
            print(f"User email: {user.email}")
            token = create_access_token(data={"sub": str(user.id)})
            print(f"Token: {token}")
        else:
            print("No agents found")

asyncio.run(main())
