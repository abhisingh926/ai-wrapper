from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.integration import Integration, UserIntegration
from app.schemas.billing import (
    IntegrationResponse, IntegrationConnectRequest,
    UserIntegrationResponse, ActionSchema,
)
from app.middleware.auth import get_current_user
from app.utils.encryption import encrypt_credentials, decrypt_credentials

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("", response_model=List[IntegrationResponse])
async def list_integrations(
    category: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all available integrations, optionally filtered by category."""
    query = select(Integration).where(Integration.enabled == True)
    if category:
        query = query.where(Integration.category == category)
    result = await db.execute(query.order_by(Integration.name))
    return result.scalars().all()


@router.get("/connected", response_model=List[UserIntegrationResponse])
async def list_connected_integrations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all integrations the current user has connected."""
    result = await db.execute(
        select(UserIntegration)
        .where(UserIntegration.user_id == current_user.id, UserIntegration.status == "connected")
    )
    user_integrations = result.scalars().all()

    response = []
    for ui in user_integrations:
        # Load the integration details
        integ_result = await db.execute(
            select(Integration).where(Integration.id == ui.integration_id)
        )
        integration = integ_result.scalar_one()
        response.append(UserIntegrationResponse(
            id=ui.id,
            integration=IntegrationResponse(
                id=integration.id, slug=integration.slug, name=integration.name,
                description=integration.description, icon_url=integration.icon_url,
                category=integration.category, config_schema=integration.config_schema,
                enabled=integration.enabled,
            ),
            status=ui.status,
            connected_at=ui.connected_at,
        ))
    return response


@router.get("/{slug}", response_model=IntegrationResponse)
async def get_integration(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get details for a specific integration."""
    result = await db.execute(select(Integration).where(Integration.slug == slug))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration


@router.post("/{slug}/connect")
async def connect_integration(
    slug: str,
    data: IntegrationConnectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Connect a user to an integration with credentials."""
    # Find integration
    result = await db.execute(select(Integration).where(Integration.slug == slug))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    # Check if already connected
    existing = await db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == current_user.id,
            UserIntegration.integration_id == integration.id,
        )
    )
    user_integration = existing.scalar_one_or_none()

    encrypted_creds = encrypt_credentials(data.credentials)

    if user_integration:
        # Update existing connection
        user_integration.credentials = {"encrypted": encrypted_creds}
        user_integration.status = "connected"
    else:
        # Create new connection
        user_integration = UserIntegration(
            user_id=current_user.id,
            integration_id=integration.id,
            credentials={"encrypted": encrypted_creds},
            status="connected",
        )
        db.add(user_integration)

    await db.commit()
    return {"message": f"Connected to {integration.name}"}


@router.delete("/{slug}/disconnect")
async def disconnect_integration(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect a user from an integration."""
    result = await db.execute(select(Integration).where(Integration.slug == slug))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    result = await db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == current_user.id,
            UserIntegration.integration_id == integration.id,
        )
    )
    user_integration = result.scalar_one_or_none()
    if not user_integration:
        raise HTTPException(status_code=404, detail="Integration not connected")

    user_integration.status = "disconnected"
    await db.commit()
    return {"message": f"Disconnected from {integration.name}"}


@router.get("/{slug}/actions", response_model=List[ActionSchema])
async def get_integration_actions(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get available actions for a specific integration."""
    result = await db.execute(select(Integration).where(Integration.slug == slug))
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    actions = integration.actions_schema or []
    return [ActionSchema(**action) for action in actions]
