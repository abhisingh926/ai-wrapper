from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.subscription import Subscription
from app.schemas.user import UserResponse, UserUpdateRequest, PasswordChangeRequest
from app.schemas.billing import SubscriptionResponse
from app.middleware.auth import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user


@router.put("", response_model=UserResponse)
async def update_profile(
    data: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile."""
    if data.name is not None:
        current_user.name = data.name
    if data.email is not None:
        # Check if email is taken
        result = await db.execute(
            select(User).where(User.email == data.email, User.id != current_user.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = data.email

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.put("/password")
async def change_password(
    data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change user password."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


@router.delete("")
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete user account."""
    await db.delete(current_user)
    await db.commit()
    return {"message": "Account deleted"}
