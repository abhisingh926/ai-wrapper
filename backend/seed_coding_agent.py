import asyncio
from sqlalchemy import select
from app.database import async_session
from app.models.integration import Integration

async def seed():
    async with async_session() as db:
        for slug, name, icon in [("github", "GitHub", "🐙"), ("gitlab", "GitLab", "🦊")]:
            existing = await db.execute(select(Integration).where(Integration.slug == slug))
            if not existing.scalar_one_or_none():
                integ = Integration(
                    slug=slug,
                    name=name,
                    description=f"Connect to {name} for the Coding Agent",
                    icon_url=icon,
                    category="tools",
                    config_schema={
                        "type": "object",
                        "properties": {
                            "access_token": {
                                "type": "string", 
                                "title": "Personal Access Token",
                                "description": "Needs repo, read:user permissions"
                            }
                        },
                        "required": ["access_token"]
                    },
                    enabled=True
                )
                db.add(integ)
                print(f"Added {name} integration to database.")
            else:
                print(f"{name} integration already exists.")
        await db.commit()

if __name__ == "__main__":
    asyncio.run(seed())
