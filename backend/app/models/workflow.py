import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class WorkflowStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"


class TriggerType(str, enum.Enum):
    WEBHOOK = "webhook"
    SCHEDULE = "schedule"
    POLLING = "polling"


class StepType(str, enum.Enum):
    TRIGGER = "trigger"
    ACTION = "action"


class ExecutionStatus(str, enum.Enum):
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SAEnum(WorkflowStatus), default=WorkflowStatus.DRAFT, nullable=False)
    trigger_type = Column(SAEnum(TriggerType), nullable=False)
    cron_expression = Column(String(100), nullable=True)
    webhook_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="workflows")
    steps = relationship("WorkflowStep", back_populates="workflow", order_by="WorkflowStep.step_order", cascade="all, delete-orphan", passive_deletes=True)
    executions = relationship("Execution", back_populates="workflow", order_by="Execution.started_at.desc()", cascade="all, delete-orphan", passive_deletes=True)

    def __repr__(self):
        return f"<Workflow {self.name}>"


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    step_order = Column(Integer, nullable=False)
    type = Column(SAEnum(StepType), nullable=False)
    integration_slug = Column(String(100), nullable=False)
    action_name = Column(String(255), nullable=False)
    config_json = Column(JSONB, default={})

    # Relationships
    workflow = relationship("Workflow", back_populates="steps")

    def __repr__(self):
        return f"<WorkflowStep {self.step_order}: {self.action_name}>"


class Execution(Base):
    __tablename__ = "executions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    status = Column(SAEnum(ExecutionStatus), default=ExecutionStatus.RUNNING, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    result_payload = Column(JSONB, nullable=True)
    retried = Column(Integer, default=0)

    # Relationships
    workflow = relationship("Workflow", back_populates="executions")

    def __repr__(self):
        return f"<Execution {self.id} - {self.status}>"
