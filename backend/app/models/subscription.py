import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class PlanType(str, enum.Enum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"          # kept for backward compat
    GROWTH = "growth"
    BUSINESS = "business"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    plan = Column(SAEnum(PlanType), default=PlanType.FREE, nullable=False, index=True)
    status = Column(SAEnum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE, nullable=False, index=True)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    start_date = Column(DateTime, default=datetime.utcnow)
    expiry_date = Column(DateTime, nullable=True)

    # Plan limits
    agent_limit = Column(Integer, default=1)
    message_limit = Column(Integer, default=500)
    messages_used = Column(Integer, default=0)

    # Legacy columns (kept for backward compat)
    workflow_limit = Column(Integer, default=3)
    monthly_run_limit = Column(Integer, default=100)
    runs_used = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="subscription")

    @property
    def is_active(self):
        return self.status == SubscriptionStatus.ACTIVE

    def get_plan_limits(self):
        """Get current limits from pricing config."""
        from app.api.billing import load_plans
        plans = load_plans()
        plan_data = plans.get(self.plan.value, plans.get("free", {}))
        return {
            "agent_limit": plan_data.get("agent_limit", self.agent_limit or 1),
            "message_limit": plan_data.get("message_limit", self.message_limit or 500),
        }

