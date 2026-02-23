import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.workflow import Workflow, WorkflowStep, Execution, ExecutionStatus, WorkflowStatus
from app.models.subscription import Subscription
from app.models.integration import UserIntegration, Integration
from app.services.integrations.registry import get_integration
from app.utils.encryption import decrypt_credentials
import logging

logger = logging.getLogger(__name__)


class WorkflowEngine:
    """
    Core workflow execution engine.
    Loads a workflow's steps and executes them sequentially.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def execute_workflow(self, workflow_id: str, trigger_data: dict = None) -> Execution:
        """Execute a workflow by ID."""
        # 1. Fetch workflow
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        if workflow.status != WorkflowStatus.ACTIVE:
            raise ValueError(f"Workflow {workflow_id} is not active")

        # 2. Check user quota
        sub_result = await self.db.execute(
            select(Subscription).where(Subscription.user_id == workflow.user_id)
        )
        subscription = sub_result.scalar_one_or_none()
        if subscription and not subscription.can_run_workflow:
            raise ValueError("Monthly run quota exceeded. Please upgrade your plan.")

        # 3. Create execution record
        execution = Execution(
            workflow_id=workflow.id,
            status=ExecutionStatus.RUNNING,
            result_payload={"trigger_data": trigger_data},
        )
        self.db.add(execution)
        await self.db.flush()

        try:
            # 4. Load steps in order
            steps_result = await self.db.execute(
                select(WorkflowStep)
                .where(WorkflowStep.workflow_id == workflow.id)
                .order_by(WorkflowStep.step_order)
            )
            steps = steps_result.scalars().all()

            step_results = []

            # 5. Execute each step
            for step in steps:
                logger.info(f"Executing step {step.step_order}: {step.action_name} via {step.integration_slug}")

                # Get user's credentials for this integration
                credentials = await self._get_user_credentials(
                    workflow.user_id, step.integration_slug
                )

                # Get integration instance
                integration = get_integration(step.integration_slug)

                # Execute the action
                result = await integration.execute_action(
                    action=step.action_name,
                    config=step.config_json or {},
                    credentials=credentials,
                )

                step_results.append({
                    "step": step.step_order,
                    "action": step.action_name,
                    "integration": step.integration_slug,
                    "result": result,
                })

            # 6. Mark success
            execution.status = ExecutionStatus.SUCCESS
            execution.finished_at = datetime.utcnow()
            execution.result_payload = {
                "trigger_data": trigger_data,
                "steps": step_results,
            }

            # 7. Increment runs used
            if subscription:
                subscription.runs_used += 1

        except Exception as e:
            # Mark failed
            logger.error(f"Workflow execution failed: {e}")
            execution.status = ExecutionStatus.FAILED
            execution.finished_at = datetime.utcnow()
            execution.error_message = str(e)

        await self.db.commit()
        await self.db.refresh(execution)
        return execution

    async def retry_execution(self, execution_id: str) -> Execution:
        """Retry a failed execution."""
        result = await self.db.execute(
            select(Execution).where(Execution.id == execution_id)
        )
        execution = result.scalar_one_or_none()
        if not execution:
            raise ValueError(f"Execution {execution_id} not found")

        if execution.status != ExecutionStatus.FAILED:
            raise ValueError("Can only retry failed executions")

        if execution.retried >= 3:
            raise ValueError("Maximum retry attempts (3) reached")

        # Increment retry counter
        execution.retried += 1
        await self.db.commit()

        # Re-execute the workflow
        return await self.execute_workflow(
            str(execution.workflow_id),
            trigger_data=execution.result_payload.get("trigger_data") if execution.result_payload else None,
        )

    async def _get_user_credentials(self, user_id, integration_slug: str) -> dict:
        """Get decrypted credentials for a user's integration."""
        # Find integration
        integ_result = await self.db.execute(
            select(Integration).where(Integration.slug == integration_slug)
        )
        integration = integ_result.scalar_one_or_none()
        if not integration:
            return {}

        # Find user's connection
        ui_result = await self.db.execute(
            select(UserIntegration).where(
                UserIntegration.user_id == user_id,
                UserIntegration.integration_id == integration.id,
                UserIntegration.status == "connected",
            )
        )
        user_integration = ui_result.scalar_one_or_none()
        if not user_integration:
            raise ValueError(f"Integration {integration_slug} not connected")

        # Decrypt credentials
        encrypted = user_integration.credentials.get("encrypted", "")
        if encrypted:
            return decrypt_credentials(encrypted)
        return {}
