import asyncio
import logging
import pytz
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import async_session
from app.models.skill_config import UserSkillConfig
from app.models.user import User
from app.api.skills import test_skill, SkillTestRequest

logger = logging.getLogger(__name__)

async def run_scheduled_skill(config: UserSkillConfig):
    """Execute a single skill for a user based on their config."""
    try:
        async with async_session() as db:
            user = await db.get(User, config.user_id)
            if not user:
                return
                
            request = SkillTestRequest(
                market_type=config.market_type,
                custom_prompt=config.custom_prompt,
            )
            # Log user ID instead of email for GDPR compliance
            logger.info(f"Executing scheduled skill {config.skill_id} for user_id={user.id}")
            
            # test_skill requires skill_id, data, current_user, and db session
            await test_skill(
                skill_id=str(config.skill_id),
                data=request,
                current_user=user,
                db=db
            )
    except Exception as e:
        logger.error(f"Error executing scheduled skill for user_id={config.user_id}: {e}")

async def scheduler_loop():
    """Background task that checks every minute for skills to run."""
    logger.info("Skill scheduler started.")
    
    while True:
        try:
            now_utc = datetime.utcnow()
            
            async with async_session() as db:
                # Get all active configs
                result = await db.execute(
                    select(UserSkillConfig).where(UserSkillConfig.is_active == True)
                )
                configs = result.scalars().all()
                
                for config in configs:
                    if not config.notify_time:
                        continue
                        
                    try:
                        # Convert current UTC time to the user's timezone
                        tz = pytz.timezone(config.notify_timezone or "UTC")
                        now_local = datetime.now(tz)
                        
                        # Expected format is HH:MM
                        current_time_str = now_local.strftime("%H:%M")
                        
                        if current_time_str == config.notify_time:
                            # Time matches! Run it in the background so one slow skill doesn't block others
                            # FIX: Removed extra 'db' argument - function only takes config
                            asyncio.create_task(run_scheduled_skill(config))
                            
                    except pytz.UnknownTimeZoneError:
                        logger.warning(f"Unknown timezone {config.notify_timezone} for config_id={config.id}")
                    except Exception as e:
                        logger.error(f"Error processing config {config.id}: {e}")
                        
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
            
        # Wait until the start of the next minute
        now = datetime.utcnow()
        sleep_seconds = 60 - now.second
        await asyncio.sleep(sleep_seconds)

def start_scheduler():
    """Kick off the background loop."""
    asyncio.create_task(scheduler_loop())
