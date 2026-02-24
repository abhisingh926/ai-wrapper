from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.models.subscription import Subscription, PlanType, SubscriptionStatus
from app.schemas.billing import (
    PlanResponse, CheckoutRequest, SubscriptionResponse, InvoiceResponse,
)
from app.middleware.auth import get_current_user
from app.config import get_settings
import json, os

settings = get_settings()

router = APIRouter(prefix="/api/billing", tags=["billing"])

# ── Dynamic Pricing (file-backed) ──
PRICING_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pricing_config.json")

DEFAULT_PLANS = {
    "free": {
        "name": "Free", "price_monthly": 0,
        "agent_limit": 1, "message_limit": 500,
        "features": ["1 AI Agent", "500 platform messages / month", "Web Widget channel", "Flash / Mini models", "Basic Q&A (No Tools)", "Community support"],
    },
    "starter": {
        "name": "Starter", "price_monthly": 1499,
        "agent_limit": 2, "message_limit": 5000,
        "features": ["2 AI Agents", "5,000 platform messages / month", "Unlimited messages (BYOK)", "Web + 2 channels", "Basic AI models", "1 Tool per agent", "Email support", "500 MB knowledge storage"],
    },
    "growth": {
        "name": "Growth", "price_monthly": 3999,
        "agent_limit": 5, "message_limit": 10000,
        "features": ["5 AI Agents", "10,000 platform messages / month", "Unlimited messages (BYOK)", "All 6 channels", "Premium models (via BYOK)", "Unlimited Basic Tools", "Priority support", "2 GB knowledge storage", "Custom branding"],
    },
    "business": {
        "name": "Business", "price_monthly": 9999,
        "agent_limit": 10, "message_limit": 20000,
        "features": ["10 AI Agents", "20,000 platform messages / month", "Unlimited messages (BYOK)", "All 6 channels", "Premium models (via BYOK)", "Unlimited Premium Tools", "Dedicated account manager", "SLA guarantee", "10 GB knowledge storage", "Remove \"Powered by\""],
    },
}


def load_plans() -> dict:
    """Load plans from config file, or return defaults."""
    try:
        with open(PRICING_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return DEFAULT_PLANS.copy()


def save_plans(plans: dict):
    """Save plans to config file."""
    with open(PRICING_FILE, "w") as f:
        json.dump(plans, f, indent=2)


def get_plan_responses() -> dict:
    """Get plans as PlanResponse objects."""
    plans = load_plans()
    return {k: PlanResponse(**v) for k, v in plans.items()}


@router.get("/plans", response_model=List[PlanResponse])
async def list_plans():
    """List all available subscription plans."""
    return list(get_plan_responses().values())


@router.get("/subscription")
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's subscription details."""
    from app.models.user import UserRole
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise HTTPException(status_code=404, detail="No subscription found")

    # Admin users get unlimited access
    if current_user.role == UserRole.ADMIN:
        return {
            "id": str(subscription.id),
            "plan": "admin",
            "status": "active",
            "agent_limit": 999,
            "message_limit": 999999,
            "messages_used": subscription.messages_used or 0,
            "stripe_customer_id": subscription.stripe_customer_id,
            "stripe_subscription_id": subscription.stripe_subscription_id,
        }
    return subscription


@router.post("/checkout")
async def create_checkout(
    data: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe checkout session for plan upgrade."""
    if data.plan not in ["starter", "growth", "business"]:
        raise HTTPException(status_code=400, detail="Invalid plan")

    PLANS = get_plan_responses()
    plan = PLANS[data.plan]

    # In production, create Stripe checkout session
    if settings.STRIPE_SECRET_KEY:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY

        price_id = settings.STRIPE_PRICE_PRO_MONTHLY if data.plan == "pro" else settings.STRIPE_PRICE_BUSINESS_MONTHLY

        session = stripe.checkout.Session.create(
            customer_email=current_user.email,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=f"{settings.FRONTEND_URL}/dashboard/billing?success=true",
            cancel_url=f"{settings.FRONTEND_URL}/dashboard/billing?canceled=true",
            metadata={"user_id": str(current_user.id), "plan": data.plan},
        )
        return {"checkout_url": session.url}

    # Development mode: simulate upgrade directly
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = result.scalar_one_or_none()
    if subscription:
        subscription.plan = PlanType(data.plan)
        subscription.agent_limit = plan.agent_limit
        subscription.message_limit = plan.message_limit
        subscription.messages_used = 0  # Reset on upgrade
        await db.commit()
    return {"message": f"Upgraded to {data.plan} (dev mode)", "checkout_url": None}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events."""
    if not settings.STRIPE_SECRET_KEY:
        return {"message": "Stripe not configured"}

    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"]["user_id"]
        plan_name = session["metadata"]["plan"]
        PLANS = get_plan_responses()
        plan = PLANS[plan_name]

        result = await db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        subscription = result.scalar_one_or_none()
        if subscription:
            subscription.plan = PlanType(plan_name)
            subscription.status = SubscriptionStatus.ACTIVE
            subscription.stripe_subscription_id = session.get("subscription")
            subscription.stripe_customer_id = session.get("customer")
            subscription.agent_limit = plan.agent_limit
            subscription.message_limit = plan.message_limit
            subscription.messages_used = 0
            await db.commit()

    elif event["type"] == "customer.subscription.deleted":
        sub_data = event["data"]["object"]
        free_plan = load_plans()["free"]
        result = await db.execute(
            select(Subscription).where(Subscription.stripe_subscription_id == sub_data["id"])
        )
        subscription = result.scalar_one_or_none()
        if subscription:
            subscription.status = SubscriptionStatus.CANCELLED
            subscription.plan = PlanType.FREE
            subscription.agent_limit = free_plan.get("agent_limit", 1)
            subscription.message_limit = free_plan.get("message_limit", 500)
            subscription.messages_used = 0
            await db.commit()

    return {"received": True}


@router.post("/cancel")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel the current subscription."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        raise HTTPException(status_code=404, detail="No subscription found")

    if subscription.plan == PlanType.FREE:
        raise HTTPException(status_code=400, detail="Cannot cancel free plan")

    # Cancel in Stripe if configured
    if settings.STRIPE_SECRET_KEY and subscription.stripe_subscription_id:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY
        stripe.Subscription.delete(subscription.stripe_subscription_id)

    subscription.status = SubscriptionStatus.CANCELLED
    free_plan = load_plans()["free"]
    subscription.plan = PlanType.FREE
    subscription.agent_limit = free_plan.get("agent_limit", 1)
    subscription.message_limit = free_plan.get("message_limit", 500)
    subscription.messages_used = 0
    await db.commit()

    return {"message": "Subscription cancelled. Downgraded to Free plan."}


@router.get("/invoices", response_model=List[InvoiceResponse])
async def list_invoices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List billing invoices."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = result.scalar_one_or_none()

    if not subscription or not settings.STRIPE_SECRET_KEY or not subscription.stripe_customer_id:
        return []

    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY
    invoices = stripe.Invoice.list(customer=subscription.stripe_customer_id, limit=20)

    return [InvoiceResponse(
        id=inv["id"], amount=inv["amount_paid"] / 100,
        currency=inv["currency"], status=inv["status"],
        date=inv["created"], pdf_url=inv.get("invoice_pdf"),
    ) for inv in invoices["data"]]
