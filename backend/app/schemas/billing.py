from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# --- Billing Schemas ---
class PlanResponse(BaseModel):
    name: str
    price_monthly: float
    agent_limit: int = 1
    message_limit: int = 500
    features: List[str]

    # Accept legacy fields without breaking
    class Config:
        extra = "ignore"


class CheckoutRequest(BaseModel):
    plan: str  # starter | growth | business


class SubscriptionResponse(BaseModel):
    id: UUID
    plan: str
    status: str
    start_date: datetime
    expiry_date: Optional[datetime]
    agent_limit: int = 1
    message_limit: int = 500
    messages_used: int = 0
    # Legacy fields with defaults
    workflow_limit: int = 0
    monthly_run_limit: int = 0
    runs_used: int = 0

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    id: str
    amount: float
    currency: str
    status: str
    date: datetime
    pdf_url: Optional[str]


# --- Integration Schemas ---
class IntegrationResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    description: Optional[str]
    icon_url: Optional[str]
    category: str
    config_schema: dict
    enabled: bool

    class Config:
        from_attributes = True


class IntegrationConnectRequest(BaseModel):
    credentials: dict


class UserIntegrationResponse(BaseModel):
    id: UUID
    integration: IntegrationResponse
    status: str
    connected_at: datetime

    class Config:
        from_attributes = True


class ActionSchema(BaseModel):
    name: str
    label: str
    description: str
    config_schema: dict
