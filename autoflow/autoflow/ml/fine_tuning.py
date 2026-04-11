"""Fine-tuning pipeline for custom model adaptation.

Features:
- Fine-tuning job creation and management
- Training data preparation and validation
- Model checkpoint management
- Training monitoring and metrics collection
- Evaluation metrics and reporting
"""

import json
import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum
from dataclasses import dataclass, asdict, field

import psycopg
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Fine-tuning job status."""
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DatasetFormat(str, Enum):
    """Training dataset format."""
    JSONL = "jsonl"
    JSON = "json"
    CSV = "csv"
    PARQUET = "parquet"


@dataclass
class TrainingConfig:
    """Configuration for fine-tuning job."""
    base_model: str
    learning_rate: float = 0.0001
    batch_size: int = 32
    num_epochs: int = 3
    warmup_steps: int = 500
    weight_decay: float = 0.01
    max_grad_norm: float = 1.0
    eval_steps: int = 100
    save_steps: int = 500
    log_steps: int = 10
    gradient_accumulation_steps: int = 1
    num_workers: int = 4
    seed: int = 42
    use_amp: bool = True  # Automatic Mixed Precision
    freeze_layers: Optional[List[str]] = None
    extra_config: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, handling None values."""
        data = asdict(self)
        return {k: v for k, v in data.items() if v is not None}


@dataclass
class FineTuneJob:
    """Fine-tuning job record."""
    job_id: str
    base_model: str
    status: JobStatus
    training_config: Dict[str, Any]
    dataset_id: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    total_samples: int = 0
    samples_processed: int = 0
    current_epoch: int = 0
    current_step: int = 0
    best_eval_loss: Optional[float] = None
    best_eval_accuracy: Optional[float] = None
    model_checkpoint_path: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dictionary."""
        data = asdict(self)
        # Convert datetime objects to ISO format strings
        for key in ['created_at', 'started_at', 'completed_at', 'cancelled_at']:
            if data[key]:
                data[key] = data[key].isoformat()
        # Convert status enum to string
        data['status'] = self.status.value
        return data


@dataclass
class TrainingMetrics:
    """Training metrics snapshot."""
    step: int
    epoch: int
    loss: float
    learning_rate: float
    samples_processed: int
    throughput: float  # samples/sec
    timestamp: datetime = field(default_factory=datetime.utcnow)
    eval_loss: Optional[float] = None
    eval_accuracy: Optional[float] = None
    eval_f1: Optional[float] = None
    gpu_memory_used: Optional[float] = None  # MB
    gpu_memory_allocated: Optional[float] = None  # MB

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data


class FineTuningPipeline:
    """Fine-tuning pipeline manager."""

    def __init__(self, db_url: str):
        """Initialize pipeline.

        Args:
            db_url: PostgreSQL connection string
        """
        self.db_url = db_url
        self._init_schema()

    def _init_schema(self) -> None:
        """Initialize database schema for fine-tuning jobs."""
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                # Create fine_tune_jobs table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS fine_tune_jobs (
                        job_id TEXT PRIMARY KEY,
                        base_model TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'pending',
                        training_config JSONB NOT NULL,
                        dataset_id TEXT NOT NULL,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        started_at TIMESTAMP,
                        completed_at TIMESTAMP,
                        cancelled_at TIMESTAMP,
                        total_samples INTEGER DEFAULT 0,
                        samples_processed INTEGER DEFAULT 0,
                        current_epoch INTEGER DEFAULT 0,
                        current_step INTEGER DEFAULT 0,
                        best_eval_loss FLOAT,
                        best_eval_accuracy FLOAT,
                        model_checkpoint_path TEXT,
                        error_message TEXT,
                        metadata JSONB DEFAULT '{}',
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                # Create training_metrics table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS training_metrics (
                        id SERIAL PRIMARY KEY,
                        job_id TEXT NOT NULL REFERENCES fine_tune_jobs(job_id) ON DELETE CASCADE,
                        step INTEGER NOT NULL,
                        epoch INTEGER NOT NULL,
                        loss FLOAT NOT NULL,
                        learning_rate FLOAT NOT NULL,
                        samples_processed INTEGER NOT NULL,
                        throughput FLOAT NOT NULL,
                        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        eval_loss FLOAT,
                        eval_accuracy FLOAT,
                        eval_f1 FLOAT,
                        gpu_memory_used FLOAT,
                        gpu_memory_allocated FLOAT
                    )
                """)

                # Create model_checkpoints table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS model_checkpoints (
                        checkpoint_id TEXT PRIMARY KEY,
                        job_id TEXT NOT NULL REFERENCES fine_tune_jobs(job_id) ON DELETE CASCADE,
                        checkpoint_path TEXT NOT NULL,
                        step INTEGER NOT NULL,
                        epoch INTEGER NOT NULL,
                        eval_loss FLOAT,
                        eval_accuracy FLOAT,
                        size_mb FLOAT,
                        is_best BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        metadata JSONB DEFAULT '{}'
                    )
                """)

                # Create training_datasets table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS training_datasets (
                        dataset_id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        format TEXT NOT NULL,
                        path TEXT NOT NULL,
                        total_samples INTEGER NOT NULL,
                        train_samples INTEGER NOT NULL,
                        val_samples INTEGER NOT NULL,
                        test_samples INTEGER NOT NULL,
                        schema JSONB,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                conn.commit()

    def create_job(
        self,
        base_model: str,
        dataset_id: str,
        training_config: TrainingConfig,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Create a new fine-tuning job.

        Args:
            base_model: Base model identifier
            dataset_id: Training dataset ID
            training_config: Training configuration
            metadata: Additional metadata

        Returns:
            Job ID
        """
        job_id = str(uuid.uuid4())

        job = FineTuneJob(
            job_id=job_id,
            base_model=base_model,
            status=JobStatus.PENDING,
            training_config=training_config.to_dict(),
            dataset_id=dataset_id,
            created_at=datetime.utcnow(),
            metadata=metadata or {},
        )

        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO fine_tune_jobs (
                        job_id, base_model, status, training_config,
                        dataset_id, created_at, metadata
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    job.job_id,
                    job.base_model,
                    job.status.value,
                    json.dumps(job.training_config),
                    job.dataset_id,
                    job.created_at,
                    json.dumps(job.metadata),
                ))
                conn.commit()

        logger.info(f"Created fine-tuning job {job_id} for {base_model}")
        return job_id

    def get_job(self, job_id: str) -> Optional[FineTuneJob]:
        """Get fine-tuning job by ID.

        Args:
            job_id: Job ID

        Returns:
            FineTuneJob or None if not found
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT job_id, base_model, status, training_config,
                           dataset_id, created_at, started_at, completed_at,
                           cancelled_at, total_samples, samples_processed,
                           current_epoch, current_step, best_eval_loss,
                           best_eval_accuracy, model_checkpoint_path,
                           error_message, metadata
                    FROM fine_tune_jobs
                    WHERE job_id = %s
                """, (job_id,))

                row = cur.fetchone()
                if not row:
                    return None

                return FineTuneJob(
                    job_id=row[0],
                    base_model=row[1],
                    status=JobStatus(row[2]),
                    training_config=row[3],
                    dataset_id=row[4],
                    created_at=row[5],
                    started_at=row[6],
                    completed_at=row[7],
                    cancelled_at=row[8],
                    total_samples=row[9],
                    samples_processed=row[10],
                    current_epoch=row[11],
                    current_step=row[12],
                    best_eval_loss=row[13],
                    best_eval_accuracy=row[14],
                    model_checkpoint_path=row[15],
                    error_message=row[16],
                    metadata=row[17] or {},
                )

    def update_job_status(
        self,
        job_id: str,
        status: JobStatus,
        error_message: Optional[str] = None,
    ) -> None:
        """Update job status.

        Args:
            job_id: Job ID
            status: New status
            error_message: Error message if failed
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                if status == JobStatus.RUNNING:
                    cur.execute("""
                        UPDATE fine_tune_jobs
                        SET status = %s, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                        WHERE job_id = %s
                    """, (status.value, job_id))
                elif status == JobStatus.COMPLETED:
                    cur.execute("""
                        UPDATE fine_tune_jobs
                        SET status = %s, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                        WHERE job_id = %s
                    """, (status.value, job_id))
                elif status == JobStatus.FAILED:
                    cur.execute("""
                        UPDATE fine_tune_jobs
                        SET status = %s, error_message = %s, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                        WHERE job_id = %s
                    """, (status.value, error_message, job_id))
                elif status == JobStatus.CANCELLED:
                    cur.execute("""
                        UPDATE fine_tune_jobs
                        SET status = %s, cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                        WHERE job_id = %s
                    """, (status.value, job_id))
                else:
                    cur.execute("""
                        UPDATE fine_tune_jobs
                        SET status = %s, updated_at = CURRENT_TIMESTAMP
                        WHERE job_id = %s
                    """, (status.value, job_id))

                conn.commit()

    def update_training_progress(
        self,
        job_id: str,
        samples_processed: int,
        current_epoch: int,
        current_step: int,
    ) -> None:
        """Update training progress.

        Args:
            job_id: Job ID
            samples_processed: Samples processed so far
            current_epoch: Current epoch number
            current_step: Current training step
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE fine_tune_jobs
                    SET samples_processed = %s,
                        current_epoch = %s,
                        current_step = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                """, (samples_processed, current_epoch, current_step, job_id))
                conn.commit()

    def record_metric(self, job_id: str, metric: TrainingMetrics) -> None:
        """Record a training metric.

        Args:
            job_id: Job ID
            metric: Training metric
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO training_metrics (
                        job_id, step, epoch, loss, learning_rate,
                        samples_processed, throughput, timestamp,
                        eval_loss, eval_accuracy, eval_f1,
                        gpu_memory_used, gpu_memory_allocated
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    job_id,
                    metric.step,
                    metric.epoch,
                    metric.loss,
                    metric.learning_rate,
                    metric.samples_processed,
                    metric.throughput,
                    metric.timestamp,
                    metric.eval_loss,
                    metric.eval_accuracy,
                    metric.eval_f1,
                    metric.gpu_memory_used,
                    metric.gpu_memory_allocated,
                ))
                conn.commit()

    def update_best_metrics(
        self,
        job_id: str,
        eval_loss: Optional[float] = None,
        eval_accuracy: Optional[float] = None,
    ) -> None:
        """Update best evaluation metrics.

        Args:
            job_id: Job ID
            eval_loss: Best evaluation loss
            eval_accuracy: Best evaluation accuracy
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                updates = []
                params = []

                if eval_loss is not None:
                    updates.append("best_eval_loss = %s")
                    params.append(eval_loss)

                if eval_accuracy is not None:
                    updates.append("best_eval_accuracy = %s")
                    params.append(eval_accuracy)

                if updates:
                    updates.append("updated_at = CURRENT_TIMESTAMP")
                    params.append(job_id)

                    query = f"""
                        UPDATE fine_tune_jobs
                        SET {', '.join(updates)}
                        WHERE job_id = %s
                    """
                    cur.execute(query, params)
                    conn.commit()

    def save_checkpoint(
        self,
        job_id: str,
        checkpoint_path: str,
        step: int,
        epoch: int,
        eval_loss: Optional[float] = None,
        eval_accuracy: Optional[float] = None,
        is_best: bool = False,
    ) -> str:
        """Save model checkpoint.

        Args:
            job_id: Job ID
            checkpoint_path: Path to checkpoint
            step: Training step
            epoch: Epoch number
            eval_loss: Evaluation loss
            eval_accuracy: Evaluation accuracy
            is_best: Whether this is the best checkpoint

        Returns:
            Checkpoint ID
        """
        checkpoint_id = str(uuid.uuid4())

        try:
            size_mb = Path(checkpoint_path).stat().st_size / (1024 * 1024)
        except:
            size_mb = 0.0

        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO model_checkpoints (
                        checkpoint_id, job_id, checkpoint_path, step, epoch,
                        eval_loss, eval_accuracy, size_mb, is_best, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                """, (
                    checkpoint_id,
                    job_id,
                    checkpoint_path,
                    step,
                    epoch,
                    eval_loss,
                    eval_accuracy,
                    size_mb,
                    is_best,
                ))

                # If this is the best checkpoint, update the job
                if is_best:
                    cur.execute("""
                        UPDATE fine_tune_jobs
                        SET model_checkpoint_path = %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE job_id = %s
                    """, (checkpoint_path, job_id))

                conn.commit()

        logger.info(f"Saved checkpoint {checkpoint_id} for job {job_id}")
        return checkpoint_id

    def get_metrics(
        self,
        job_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[TrainingMetrics], int]:
        """Get training metrics for a job.

        Args:
            job_id: Job ID
            limit: Number of metrics to return
            offset: Offset for pagination

        Returns:
            Tuple of (metrics list, total count)
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                # Get total count
                cur.execute("""
                    SELECT COUNT(*) FROM training_metrics WHERE job_id = %s
                """, (job_id,))
                total = cur.fetchone()[0]

                # Get metrics
                cur.execute("""
                    SELECT step, epoch, loss, learning_rate, samples_processed,
                           throughput, timestamp, eval_loss, eval_accuracy, eval_f1,
                           gpu_memory_used, gpu_memory_allocated
                    FROM training_metrics
                    WHERE job_id = %s
                    ORDER BY step DESC
                    LIMIT %s OFFSET %s
                """, (job_id, limit, offset))

                metrics = []
                for row in cur.fetchall():
                    metrics.append(TrainingMetrics(
                        step=row[0],
                        epoch=row[1],
                        loss=row[2],
                        learning_rate=row[3],
                        samples_processed=row[4],
                        throughput=row[5],
                        timestamp=row[6],
                        eval_loss=row[7],
                        eval_accuracy=row[8],
                        eval_f1=row[9],
                        gpu_memory_used=row[10],
                        gpu_memory_allocated=row[11],
                    ))

        return metrics, total

    def list_jobs(
        self,
        status: Optional[JobStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[FineTuneJob], int]:
        """List fine-tuning jobs.

        Args:
            status: Filter by status
            limit: Number of jobs to return
            offset: Offset for pagination

        Returns:
            Tuple of (jobs list, total count)
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                if status:
                    cur.execute("""
                        SELECT COUNT(*) FROM fine_tune_jobs WHERE status = %s
                    """, (status.value,))
                else:
                    cur.execute("""
                        SELECT COUNT(*) FROM fine_tune_jobs
                    """)
                total = cur.fetchone()[0]

                if status:
                    cur.execute("""
                        SELECT job_id, base_model, status, training_config,
                               dataset_id, created_at, started_at, completed_at,
                               cancelled_at, total_samples, samples_processed,
                               current_epoch, current_step, best_eval_loss,
                               best_eval_accuracy, model_checkpoint_path,
                               error_message, metadata
                        FROM fine_tune_jobs
                        WHERE status = %s
                        ORDER BY created_at DESC
                        LIMIT %s OFFSET %s
                    """, (status.value, limit, offset))
                else:
                    cur.execute("""
                        SELECT job_id, base_model, status, training_config,
                               dataset_id, created_at, started_at, completed_at,
                               cancelled_at, total_samples, samples_processed,
                               current_epoch, current_step, best_eval_loss,
                               best_eval_accuracy, model_checkpoint_path,
                               error_message, metadata
                        FROM fine_tune_jobs
                        ORDER BY created_at DESC
                        LIMIT %s OFFSET %s
                    """, (limit, offset))

                jobs = []
                for row in cur.fetchall():
                    jobs.append(FineTuneJob(
                        job_id=row[0],
                        base_model=row[1],
                        status=JobStatus(row[2]),
                        training_config=row[3],
                        dataset_id=row[4],
                        created_at=row[5],
                        started_at=row[6],
                        completed_at=row[7],
                        cancelled_at=row[8],
                        total_samples=row[9],
                        samples_processed=row[10],
                        current_epoch=row[11],
                        current_step=row[12],
                        best_eval_loss=row[13],
                        best_eval_accuracy=row[14],
                        model_checkpoint_path=row[15],
                        error_message=row[16],
                        metadata=row[17] or {},
                    ))

        return jobs, total

    def cancel_job(self, job_id: str) -> None:
        """Cancel a fine-tuning job.

        Args:
            job_id: Job ID
        """
        self.update_job_status(job_id, JobStatus.CANCELLED)
        logger.info(f"Cancelled job {job_id}")
