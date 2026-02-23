"""
Public Tools API — Returns available tools for the agent creation wizard.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.tool import Tool

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.get("")
async def list_public_tools(db: AsyncSession = Depends(get_db)):
    """List all tools visible to users (enabled only)."""
    result = await db.execute(
        select(Tool)
        .where(Tool.enabled == True)
        .order_by(Tool.sort_order)
    )
    tools = result.scalars().all()
    return [
        {
            "id": t.slug,
            "name": t.name,
            "icon": t.icon,
            "desc": t.description,
            "category": t.category,
            "badge": t.badge,
        }
        for t in tools
    ]
