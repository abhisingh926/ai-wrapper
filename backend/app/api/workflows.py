import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User
from app.models.workflow import Workflow, WorkflowStep, Execution, WorkflowStatus, ExecutionStatus
from app.models.subscription import Subscription
from app.schemas.workflow import (
    WorkflowCreate, WorkflowUpdate, WorkflowResponse,
    WorkflowListResponse, WorkflowStepResponse, ExecutionResponse,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.get("", response_model=List[WorkflowListResponse])
async def list_workflows(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all workflows for the current user."""
    result = await db.execute(
        select(Workflow).where(Workflow.user_id == current_user.id).order_by(Workflow.updated_at.desc())
    )
    workflows = result.scalars().all()

    response = []
    for wf in workflows:
        # Get execution stats
        exec_count = await db.execute(
            select(func.count(Execution.id)).where(Execution.workflow_id == wf.id)
        )
        last_exec = await db.execute(
            select(Execution.started_at).where(Execution.workflow_id == wf.id).order_by(Execution.started_at.desc()).limit(1)
        )
        response.append(WorkflowListResponse(
            id=wf.id,
            name=wf.name,
            status=wf.status.value,
            trigger_type=wf.trigger_type.value,
            created_at=wf.created_at,
            updated_at=wf.updated_at,
            execution_count=exec_count.scalar() or 0,
            last_run=last_exec.scalar_one_or_none(),
        ))

    return response


@router.post("", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    data: WorkflowCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new workflow with steps."""
    # Check quota
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = result.scalar_one_or_none()
    if subscription:
        wf_count = await db.execute(
            select(func.count(Workflow.id)).where(Workflow.user_id == current_user.id)
        )
        if (wf_count.scalar() or 0) >= subscription.workflow_limit:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Workflow limit reached. Please upgrade your plan.",
            )

    # Create workflow
    workflow = Workflow(
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        trigger_type=data.trigger_type,
        cron_expression=data.cron_expression,
        webhook_url=f"/api/webhooks/{uuid.uuid4()}" if data.trigger_type == "webhook" else None,
    )
    db.add(workflow)
    await db.flush()

    # Create steps
    for step_data in data.steps:
        step = WorkflowStep(
            workflow_id=workflow.id,
            step_order=step_data.step_order,
            type=step_data.type,
            integration_slug=step_data.integration_slug,
            action_name=step_data.action_name,
            config_json=step_data.config_json,
        )
        db.add(step)

    await db.commit()
    await db.refresh(workflow)

    # Load steps
    result = await db.execute(
        select(WorkflowStep).where(WorkflowStep.workflow_id == workflow.id).order_by(WorkflowStep.step_order)
    )
    steps = result.scalars().all()

    return WorkflowResponse(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        status=workflow.status.value,
        trigger_type=workflow.trigger_type.value,
        cron_expression=workflow.cron_expression,
        webhook_url=workflow.webhook_url,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
        steps=[WorkflowStepResponse(
            id=s.id, step_order=s.step_order, type=s.type.value if hasattr(s.type, 'value') else s.type,
            integration_slug=s.integration_slug, action_name=s.action_name,
            config_json=s.config_json,
        ) for s in steps],
    )


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific workflow with its steps."""
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Load steps
    steps_result = await db.execute(
        select(WorkflowStep).where(WorkflowStep.workflow_id == workflow.id).order_by(WorkflowStep.step_order)
    )
    steps = steps_result.scalars().all()

    return WorkflowResponse(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        status=workflow.status.value,
        trigger_type=workflow.trigger_type.value,
        cron_expression=workflow.cron_expression,
        webhook_url=workflow.webhook_url,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
        steps=[WorkflowStepResponse(
            id=s.id, step_order=s.step_order, type=s.type.value if hasattr(s.type, 'value') else s.type,
            integration_slug=s.integration_slug, action_name=s.action_name,
            config_json=s.config_json,
        ) for s in steps],
    )


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    data: WorkflowUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a workflow and its steps."""
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Update fields
    if data.name is not None:
        workflow.name = data.name
    if data.description is not None:
        workflow.description = data.description
    if data.trigger_type is not None:
        workflow.trigger_type = data.trigger_type
    if data.cron_expression is not None:
        workflow.cron_expression = data.cron_expression

    # Update steps if provided
    if data.steps is not None:
        # Delete existing steps
        existing = await db.execute(
            select(WorkflowStep).where(WorkflowStep.workflow_id == workflow.id)
        )
        for step in existing.scalars().all():
            await db.delete(step)

        # Create new steps
        for step_data in data.steps:
            step = WorkflowStep(
                workflow_id=workflow.id,
                step_order=step_data.step_order,
                type=step_data.type,
                integration_slug=step_data.integration_slug,
                action_name=step_data.action_name,
                config_json=step_data.config_json,
            )
            db.add(step)

    workflow.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(workflow)

    steps_result = await db.execute(
        select(WorkflowStep).where(WorkflowStep.workflow_id == workflow.id).order_by(WorkflowStep.step_order)
    )
    steps = steps_result.scalars().all()

    return WorkflowResponse(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        status=workflow.status.value,
        trigger_type=workflow.trigger_type.value,
        cron_expression=workflow.cron_expression,
        webhook_url=workflow.webhook_url,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
        steps=[WorkflowStepResponse(
            id=s.id, step_order=s.step_order, type=s.type.value if hasattr(s.type, 'value') else s.type,
            integration_slug=s.integration_slug, action_name=s.action_name,
            config_json=s.config_json,
        ) for s in steps],
    )


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a workflow."""
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    await db.delete(workflow)
    await db.commit()


@router.post("/{workflow_id}/activate")
async def activate_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Activate a workflow."""
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    workflow.status = WorkflowStatus.ACTIVE
    await db.commit()
    return {"message": "Workflow activated"}


@router.post("/{workflow_id}/pause")
async def pause_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pause a workflow."""
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    workflow.status = WorkflowStatus.PAUSED
    await db.commit()
    return {"message": "Workflow paused"}


@router.get("/{workflow_id}/executions", response_model=List[ExecutionResponse])
async def list_executions(
    workflow_id: str,
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List execution logs for a workflow."""
    # Verify ownership
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Workflow not found")

    result = await db.execute(
        select(Execution)
        .where(Execution.workflow_id == workflow_id)
        .order_by(Execution.started_at.desc())
        .limit(limit)
        .offset(offset)
    )
    executions = result.scalars().all()
    return [ExecutionResponse(
        id=e.id, workflow_id=e.workflow_id, status=e.status.value,
        started_at=e.started_at, finished_at=e.finished_at,
        error_message=e.error_message, result_payload=e.result_payload,
        retried=e.retried,
    ) for e in executions]
