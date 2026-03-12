import asyncio
import os
import sys

# Add backend directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base
from app.models.skill_message_log import SkillMessageLog
from app.models.skill_config import UserSkillConfig

async def create_tables():
    async with engine.begin() as conn:
        print("Creating skill message logs table...")
        # Create only the new table
        await conn.run_sync(Base.metadata.create_all, tables=[SkillMessageLog.__table__])
        print("Done!")

if __name__ == "__main__":
    asyncio.run(create_tables())
