from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID


# --- Workflow Schemas ---
class WorkflowStepCreate(BaseModel):
    step_order: int
    type: str  # trigger | action
    integration_slug: str
    action_name: str
    config_json: dict = {}


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_type: str  # webhook | schedule | polling
    cron_expression: Optional[str] = None
    steps: List[WorkflowStepCreate] = []


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    cron_expression: Optional[str] = None
    steps: Optional[List[WorkflowStepCreate]] = None


class WorkflowStepResponse(BaseModel):
    id: UUID
    step_order: int
    type: str
    integration_slug: str
    action_name: str
    config_json: dict

    class Config:
        from_attributes = True


class WorkflowResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    status: str
    trigger_type: str
    cron_expression: Optional[str]
    webhook_url: Optional[str]
    created_at: datetime
    updated_at: datetime
    steps: List[WorkflowStepResponse] = []

    class Config:
        from_attributes = True


class WorkflowListResponse(BaseModel):
    id: UUID
    name: str
    status: str
    trigger_type: str
    created_at: datetime
    updated_at: datetime
    execution_count: int = 0
    last_run: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExecutionResponse(BaseModel):
    id: UUID
    workflow_id: UUID
    status: str
    started_at: datetime
    finished_at: Optional[datetime]
    error_message: Optional[str]
    result_payload: Optional[dict]
    retried: int

    class Config:
        from_attributes = True
