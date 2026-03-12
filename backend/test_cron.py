import asyncio
import os
import sys
from datetime import datetime
import pytz

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from app.database import async_session
from app.models.user import User
from app.models.skill import Skill
from app.models.skill_config import UserSkillConfig
from app.scheduler import scheduler_loop

async def trigger_cron_test():
    print("Setting up a test cron job...")
    async with async_session() as db:
        # Get first user and skill
        user_result = await db.execute(select(User).limit(1))
        user = user_result.scalar_one_or_none()
        
        skill_result = await db.execute(select(Skill).limit(1))
        skill = skill_result.scalar_one_or_none()
        
        if not user or not skill:
            print("No user or skill found, cannot test.")
            return

        # Figure out what time it is RIGHT NOW in UTC
        tz = pytz.timezone("UTC")
        now_local = datetime.now(tz)
        current_time_str = now_local.strftime("%H:%M")
        print(f"Current UTC time is: {current_time_str}")

        # Ensure a config exists for this exact minute
        config_result = await db.execute(
            select(UserSkillConfig).where(
                UserSkillConfig.user_id == user.id,
                UserSkillConfig.skill_id == skill.id
            )
        )
        config = config_result.scalar_one_or_none()
        
        if config:
            config.is_active = True
            config.notify_time = current_time_str
            config.notify_timezone = "UTC"
            config.notify_channel = "dashboard" # Just dashboard so it logs DB without needing WA key
            print(f"Updated existing config ID {config.id} to trigger at {current_time_str} UTC")
        else:
            config = UserSkillConfig(
                user_id=user.id,
                skill_id=skill.id,
                is_active=True,
                notify_time=current_time_str,
                notify_timezone="UTC",
                notify_channel="dashboard"
            )
            db.add(config)
            print(f"Created new config to trigger at {current_time_str} UTC")
            
        await db.commit()
    
    # We won't simulate the loop directly to avoid hangs, but setting this confirms the next 
    # minute tick in the ACTUAL running uvicorn background task will pick this up!
    print("\n✅ Database updated! The background task running in uvicorn should pick this up when the minute rolls over.")

if __name__ == "__main__":
    asyncio.run(trigger_cron_test())
