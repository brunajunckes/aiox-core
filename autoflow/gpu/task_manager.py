"""GPU Task Manager — Priority queue, resource pooling, and graceful degradation.

Manages GPU job submission with:
- Priority scheduling (avatar/matting=high, voice/image=medium, rendering=low)
- Resource pooling (max 4 concurrent GPU tasks)
- Graceful degradation (fallback when GPU offline >30s)
- Job checkpointing (resume from GPU stages in video pipeline)
- Cost tracking integration with cost_logger

Task Types & Timeouts:
- Avatar generation: 60-120s (high priority)
- Voice synthesis: 5-15s (medium priority)
- Video matting: 30-60s (high priority)
- Image generation: 10-30s (medium priority)
- Final rendering: 20-60s (low priority, GPU required)

Resource Pool:
- Max 4 concurrent GPU tasks (Desktop NVIDIA GPU constraint)
- Queue depth tracked for health monitoring
- Fallback to Ollama or CPU alternatives when pooled

Cost Tracking:
- Per-task cost: avatar $0.50, voice $0.10, matting $0.30, image $0.15, rendering $0.20
- Recorded in PostgreSQL gpu_job_metrics table
"""

import asyncio
import logging
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from uuid import uuid4
import json

logger = logging.getLogger(__name__)


class TaskPriority(int, Enum):
    """Task priority levels (higher = process sooner)."""
    LOW = 1
    MEDIUM = 2
    HIGH = 3


class TaskStatus(str, Enum):
    """Task lifecycle status."""
    PENDING = "pending"           # Queued, waiting for GPU availability
    PROCESSING = "processing"      # Currently executing on GPU
    CHECKPOINTED = "checkpointed"  # GPU part done, resumable from checkpoint
    COMPLETED = "completed"        # Successfully finished
    FAILED = "failed"             # Error occurred
    DEGRADED = "degraded"         # CPU fallback (GPU offline)


@dataclass
class GpuTask:
    """GPU task with metadata and checkpointing.

    Attributes:
        task_id: Unique task identifier (UUID)
        task_type: "avatar", "voice", "matting", "image", "rendering"
        priority: TaskPriority enum
        payload: Task-specific payload (dict)
        status: Current TaskStatus
        created_at: Submission timestamp
        started_at: GPU processing start time
        completed_at: Completion time
        checkpoint_data: Data for resuming (GPU matting/rendering stage)
        cost_usd: Task cost in USD
        retry_count: Number of retries attempted
        error_message: Error description if failed
    """
    task_id: str
    task_type: str
    priority: TaskPriority
    payload: Dict[str, Any]
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    checkpoint_data: Optional[Dict[str, Any]] = None
    cost_usd: float = 0.0
    retry_count: int = 0
    error_message: Optional[str] = None

    def elapsed_seconds(self) -> float:
        """Calculate elapsed time since creation."""
        return (datetime.utcnow() - self.created_at).total_seconds()

    def processing_seconds(self) -> float:
        """Calculate GPU processing time."""
        if not self.started_at:
            return 0.0
        end_time = self.completed_at or datetime.utcnow()
        return (end_time - self.started_at).total_seconds()

    def to_dict(self) -> Dict[str, Any]:
        """Serialize task to dict for metrics/logging."""
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "priority": self.priority.name,
            "status": self.status.value,
            "cost_usd": self.cost_usd,
            "retry_count": self.retry_count,
            "elapsed_seconds": self.elapsed_seconds(),
            "processing_seconds": self.processing_seconds(),
            "error": self.error_message,
        }


class GpuTaskManager:
    """Manage GPU task queue, scheduling, and resource pooling.

    Maintains a priority queue of GPU tasks with resource constraints:
    - Max 4 concurrent GPU tasks (per Desktop GPU worker capacity)
    - Priority scheduling (HIGH → MEDIUM → LOW)
    - Graceful degradation (fallback when GPU offline >30s)
    - Job checkpointing (resume from GPU stages in video pipeline)
    """

    # Per-task cost (USD)
    TASK_COSTS = {
        "avatar": 0.50,
        "voice": 0.10,
        "matting": 0.30,
        "image": 0.15,
        "rendering": 0.20,
    }

    # Default priorities by task type
    TASK_PRIORITIES = {
        "avatar": TaskPriority.HIGH,
        "matting": TaskPriority.HIGH,
        "voice": TaskPriority.MEDIUM,
        "image": TaskPriority.MEDIUM,
        "rendering": TaskPriority.LOW,
    }

    # Default timeouts (seconds)
    TASK_TIMEOUTS = {
        "avatar": 120.0,
        "voice": 15.0,
        "matting": 60.0,
        "image": 30.0,
        "rendering": 60.0,
    }

    def __init__(self, max_concurrent_tasks: int = 4):
        """Initialize GPU task manager.

        Args:
            max_concurrent_tasks: Max concurrent GPU tasks (default: 4)
        """
        self.max_concurrent_tasks = max_concurrent_tasks
        self.queue: List[GpuTask] = []
        self.active_tasks: Dict[str, GpuTask] = {}
        self.completed_tasks: Dict[str, GpuTask] = {}
        self.failed_tasks: Dict[str, GpuTask] = {}

    def submit_task(
        self,
        task_type: str,
        payload: Dict[str, Any],
        priority: Optional[TaskPriority] = None,
    ) -> GpuTask:
        """Submit a GPU task to the queue.

        Args:
            task_type: "avatar", "voice", "matting", "image", "rendering"
            payload: Task-specific payload
            priority: Override default priority

        Returns:
            GpuTask (queued, not yet processing)
        """
        task_id = str(uuid4())
        priority = priority or self.TASK_PRIORITIES.get(task_type, TaskPriority.MEDIUM)
        cost_usd = self.TASK_COSTS.get(task_type, 0.0)

        task = GpuTask(
            task_id=task_id,
            task_type=task_type,
            priority=priority,
            payload=payload,
            cost_usd=cost_usd,
        )

        self.queue.append(task)
        self._sort_queue()

        logger.info(
            f"Task submitted: {task_id} ({task_type}, priority={priority.name}, cost=${cost_usd})"
        )
        return task

    def get_next_task(self) -> Optional[GpuTask]:
        """Get next task from queue (highest priority).

        Returns:
            GpuTask if queue not empty, else None
        """
        if not self.queue:
            return None

        # Queue is sorted by priority (highest first)
        task = self.queue.pop(0)
        task.started_at = datetime.utcnow()
        task.status = TaskStatus.PROCESSING
        self.active_tasks[task.task_id] = task

        logger.info(f"Task dequeued: {task.task_id} (type={task.task_type})")
        return task

    def mark_completed(self, task_id: str, checkpoint_data: Optional[Dict] = None) -> None:
        """Mark task as completed.

        Args:
            task_id: Task UUID
            checkpoint_data: Optional checkpoint for resuming in video pipeline
        """
        if task_id not in self.active_tasks:
            logger.warning(f"Task not found in active_tasks: {task_id}")
            return

        task = self.active_tasks.pop(task_id)
        task.completed_at = datetime.utcnow()
        task.status = TaskStatus.COMPLETED if not checkpoint_data else TaskStatus.CHECKPOINTED
        task.checkpoint_data = checkpoint_data
        self.completed_tasks[task_id] = task

        logger.info(
            f"Task completed: {task_id} (type={task.task_type}, "
            f"duration={task.processing_seconds():.1f}s)"
        )

    def mark_failed(self, task_id: str, error: str, retry: bool = False) -> bool:
        """Mark task as failed.

        Args:
            task_id: Task UUID
            error: Error message
            retry: If True, requeue for retry (max 3 retries)

        Returns:
            True if retried, False if final failure
        """
        if task_id not in self.active_tasks:
            logger.warning(f"Task not found in active_tasks: {task_id}")
            return False

        task = self.active_tasks.pop(task_id)
        task.completed_at = datetime.utcnow()
        task.error_message = error
        task.retry_count += 1

        if retry and task.retry_count < 3:
            task.status = TaskStatus.PENDING
            task.started_at = None
            self.queue.append(task)
            self._sort_queue()
            logger.warning(
                f"Task failed (retry {task.retry_count}/3): {task_id} - {error}"
            )
            return True
        else:
            task.status = TaskStatus.FAILED
            self.failed_tasks[task_id] = task
            logger.error(
                f"Task failed (final): {task_id} (type={task.task_type}, "
                f"retries={task.retry_count}) - {error}"
            )
            return False

    def mark_degraded(self, task_id: str, fallback_status: str) -> None:
        """Mark task as using CPU fallback (GPU offline).

        Args:
            task_id: Task UUID
            fallback_status: Fallback status (e.g., "using_cpu_tts")
        """
        if task_id not in self.active_tasks:
            logger.warning(f"Task not found in active_tasks: {task_id}")
            return

        task = self.active_tasks.pop(task_id)
        task.completed_at = datetime.utcnow()
        task.status = TaskStatus.DEGRADED
        task.error_message = fallback_status
        self.completed_tasks[task_id] = task

        logger.info(
            f"Task degraded (CPU fallback): {task_id} (type={task.task_type}) - {fallback_status}"
        )

    def queue_depth(self) -> int:
        """Return number of pending tasks."""
        return len(self.queue)

    def active_count(self) -> int:
        """Return number of active (processing) tasks."""
        return len(self.active_tasks)

    def is_pool_full(self) -> bool:
        """Return True if max concurrent tasks reached."""
        return self.active_count() >= self.max_concurrent_tasks

    def get_queue_status(self) -> Dict[str, Any]:
        """Get status of entire task queue.

        Returns:
            Dict with queue_depth, active_count, pool_utilization, etc.
        """
        return {
            "queue_depth": self.queue_depth(),
            "active_count": self.active_count(),
            "pool_utilization_percent": (self.active_count() / self.max_concurrent_tasks) * 100,
            "max_concurrent": self.max_concurrent_tasks,
            "pending_high_priority": sum(
                1 for t in self.queue if t.priority == TaskPriority.HIGH
            ),
            "pending_medium_priority": sum(
                1 for t in self.queue if t.priority == TaskPriority.MEDIUM
            ),
            "pending_low_priority": sum(
                1 for t in self.queue if t.priority == TaskPriority.LOW
            ),
            "completed_count": len(self.completed_tasks),
            "failed_count": len(self.failed_tasks),
        }

    def get_task_metrics(self) -> Dict[str, float]:
        """Calculate aggregate metrics for all completed tasks.

        Returns:
            Dict with total_cost_usd, avg_latency_seconds, success_rate, etc.
        """
        all_completed = list(self.completed_tasks.values()) + list(self.failed_tasks.values())

        if not all_completed:
            return {
                "total_cost_usd": 0.0,
                "avg_latency_seconds": 0.0,
                "success_rate_percent": 100.0,
                "total_tasks": 0,
            }

        succeeded = len(self.completed_tasks)
        failed = len(self.failed_tasks)
        total = succeeded + failed

        total_cost = sum(t.cost_usd for t in all_completed)
        avg_latency = sum(t.elapsed_seconds() for t in all_completed) / total

        return {
            "total_cost_usd": total_cost,
            "avg_latency_seconds": avg_latency,
            "success_rate_percent": (succeeded / total * 100) if total > 0 else 100.0,
            "total_tasks": total,
            "succeeded": succeeded,
            "failed": failed,
        }

    def get_task(self, task_id: str) -> Optional[GpuTask]:
        """Look up task by ID across all collections.

        Returns:
            GpuTask if found, else None
        """
        if task_id in self.active_tasks:
            return self.active_tasks[task_id]
        if task_id in self.completed_tasks:
            return self.completed_tasks[task_id]
        if task_id in self.failed_tasks:
            return self.failed_tasks[task_id]
        # Check queue
        for task in self.queue:
            if task.task_id == task_id:
                return task
        return None

    def _sort_queue(self) -> None:
        """Sort queue by priority (highest first, then by submission time)."""
        self.queue.sort(key=lambda t: (-t.priority.value, t.created_at))

    def clear_history(self) -> None:
        """Clear completed and failed task history (useful for testing)."""
        self.completed_tasks.clear()
        self.failed_tasks.clear()
        logger.info("Task history cleared")

    def __repr__(self) -> str:
        """String representation."""
        return (
            f"GpuTaskManager("
            f"queue_depth={self.queue_depth()}, "
            f"active={self.active_count()}/{self.max_concurrent_tasks}, "
            f"completed={len(self.completed_tasks)}, "
            f"failed={len(self.failed_tasks)})"
        )
