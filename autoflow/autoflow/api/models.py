"""Model management API endpoints.

Endpoints:
  POST /models/fine-tune              — Start fine-tuning job
  GET  /models/jobs/{id}              — Get fine-tuning job status
  GET  /models/jobs                   — List fine-tuning jobs
  GET  /models                        — List available models
  POST /models/{id}/deploy            — Deploy model version
  POST /models/{id}/rollback          — Rollback to previous version
  DELETE /models/{id}                 — Archive model version
  GET  /models/{id}/performance       — Get performance metrics
  POST /models/register               — Register a model manually
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel, Field

from ..ml.fine_tuning import (
    FineTuningPipeline,
    TrainingConfig,
    JobStatus,
)
from ..ml.model_registry import (
    ModelRegistry,
    ModelStatus,
    ModelPerformance,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/models", tags=["models"])


# ── Request/Response Models ──


class TrainingConfigRequest(BaseModel):
    """Fine-tuning configuration request."""
    base_model: str
    dataset_id: str
    learning_rate: float = Field(0.0001, ge=1e-6, le=1.0)
    batch_size: int = Field(32, ge=1, le=1024)
    num_epochs: int = Field(3, ge=1, le=100)
    warmup_steps: int = Field(500, ge=0)
    weight_decay: float = Field(0.01, ge=0)
    max_grad_norm: float = Field(1.0, ge=0)
    eval_steps: int = Field(100, ge=1)
    save_steps: int = Field(500, ge=1)
    use_amp: bool = True
    freeze_layers: Optional[List[str]] = None
    extra_config: Optional[Dict[str, Any]] = None


class FineTuneJobResponse(BaseModel):
    """Fine-tuning job response."""
    job_id: str
    base_model: str
    status: str
    dataset_id: str
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    total_samples: int
    samples_processed: int
    current_epoch: int
    current_step: int
    best_eval_loss: Optional[float] = None
    best_eval_accuracy: Optional[float] = None
    model_checkpoint_path: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any]


class ModelMetadataResponse(BaseModel):
    """Model metadata response."""
    model_id: str
    version: str
    base_model: str
    job_id: str
    status: str
    created_at: str
    description: Optional[str] = None
    tags: List[str]
    metrics: Dict[str, float]
    parameters: Dict[str, Any]
    size_mb: float
    deployed_at: Optional[str] = None
    checkpoint_path: Optional[str] = None
    custom_metadata: Dict[str, Any]


class ModelPerformanceResponse(BaseModel):
    """Model performance metrics response."""
    model_id: str
    version: str
    timestamp: str
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    loss: Optional[float] = None
    inference_latency_ms: Optional[float] = None
    throughput: Optional[float] = None
    memory_usage_mb: Optional[float] = None


class DeploymentRequest(BaseModel):
    """Model deployment request."""
    environment: str = Field("production", regex="^(dev|staging|production)$")
    endpoint: Optional[str] = None
    rollback_from: Optional[str] = None


class RollbackRequest(BaseModel):
    """Rollback request."""
    rollback_to_model_id: str


class RegisterModelRequest(BaseModel):
    """Manual model registration request."""
    base_model: str
    job_id: str
    checkpoint_path: str
    metrics: Dict[str, float]
    parameters: Dict[str, Any]
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    parent_version: Optional[str] = None
    custom_metadata: Optional[Dict[str, Any]] = None


# ── Initialize Services ──


def get_fine_tuning_pipeline(db_url: str) -> FineTuningPipeline:
    """Get fine-tuning pipeline instance."""
    return FineTuningPipeline(db_url)


def get_model_registry(db_url: str) -> ModelRegistry:
    """Get model registry instance."""
    return ModelRegistry(db_url)


# ── Endpoints ──


@router.post("/fine-tune", response_model=FineTuneJobResponse)
async def start_fine_tune(
    request: TrainingConfigRequest,
    db_url: str = "postgresql://user:password@postgres:5432/autoflow",
):
    """Start a fine-tuning job.

    Args:
        request: Fine-tuning configuration
        db_url: Database connection string

    Returns:
        Fine-tuning job response
    """
    try:
        pipeline = get_fine_tuning_pipeline(db_url)

        # Create training config
        config = TrainingConfig(
            base_model=request.base_model,
            learning_rate=request.learning_rate,
            batch_size=request.batch_size,
            num_epochs=request.num_epochs,
            warmup_steps=request.warmup_steps,
            weight_decay=request.weight_decay,
            max_grad_norm=request.max_grad_norm,
            eval_steps=request.eval_steps,
            save_steps=request.save_steps,
            use_amp=request.use_amp,
            freeze_layers=request.freeze_layers,
            extra_config=request.extra_config or {},
        )

        # Create fine-tuning job
        job_id = pipeline.create_job(
            base_model=request.base_model,
            dataset_id=request.dataset_id,
            training_config=config,
        )

        job = pipeline.get_job(job_id)

        return FineTuneJobResponse(
            job_id=job.job_id,
            base_model=job.base_model,
            status=job.status.value,
            dataset_id=job.dataset_id,
            created_at=job.created_at.isoformat(),
            started_at=job.started_at.isoformat() if job.started_at else None,
            completed_at=job.completed_at.isoformat() if job.completed_at else None,
            total_samples=job.total_samples,
            samples_processed=job.samples_processed,
            current_epoch=job.current_epoch,
            current_step=job.current_step,
            best_eval_loss=job.best_eval_loss,
            best_eval_accuracy=job.best_eval_accuracy,
            model_checkpoint_path=job.model_checkpoint_path,
            error_message=job.error_message,
            metadata=job.metadata,
        )

    except Exception as e:
        logger.error(f"Failed to start fine-tuning: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs/{job_id}", response_model=FineTuneJobResponse)
async def get_job_status(
    job_id: str,
    db_url: str = "postgresql://user:password@postgres:5432/autoflow",
):
    """Get fine-tuning job status.

    Args:
        job_id: Job ID
        db_url: Database connection string

    Returns:
        Fine-tuning job response
    """
    try:
        pipeline = get_fine_tuning_pipeline(db_url)
        job = pipeline.get_job(job_id)

        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        return FineTuneJobResponse(
            job_id=job.job_id,
            base_model=job.base_model,
            status=job.status.value,
            dataset_id=job.dataset_id,
            created_at=job.created_at.isoformat(),
            started_at=job.started_at.isoformat() if job.started_at else None,
            completed_at=job.completed_at.isoformat() if job.completed_at else None,
            total_samples=job.total_samples,
            samples_processed=job.samples_processed,
            current_epoch=job.current_epoch,
            current_step=job.current_step,
            best_eval_loss=job.best_eval_loss,
            best_eval_accuracy=job.best_eval_accuracy,
            model_checkpoint_path=job.model_checkpoint_path,
            error_message=job.error_message,
            metadata=job.metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs", response_model=Dict[str, Any])
async def list_jobs(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db_url: str = "postgresql://user:password@postgres:5432/autoflow",
):
    """List fine-tuning jobs.

    Args:
        status: Filter by status
        limit: Number of jobs to return
        offset: Offset for pagination
        db_url: Database connection string

    Returns:
        Jobs and pagination info
    """
    try:
        pipeline = get_fine_tuning_pipeline(db_url)

        job_status = None
        if status:
            try:
                job_status = JobStatus(status)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

        jobs, total = pipeline.list_jobs(status=job_status, limit=limit, offset=offset)

        return {
            "jobs": [
                FineTuneJobResponse(
                    job_id=job.job_id,
                    base_model=job.base_model,
                    status=job.status.value,
                    dataset_id=job.dataset_id,
                    created_at=job.created_at.isoformat(),
                    started_at=job.started_at.isoformat() if job.started_at else None,
                    completed_at=job.completed_at.isoformat() if job.completed_at else None,
                    total_samples=job.total_samples,
                    samples_processed=job.samples_processed,
                    current_epoch=job.current_epoch,
                    current_step=job.current_step,
                    best_eval_loss=job.best_eval_loss,
                    best_eval_accuracy=job.best_eval_accuracy,
                    model_checkpoint_path=job.model_checkpoint_path,
                    error_message=job.error_message,
                    metadata=job.metadata,
                )
                for job in jobs
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list jobs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=Dict[str, Any])
async def list_models(
    base_model: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db_url: str = "postgresql://user:password@postgres:5432/autoflow",
):
    """List available models.

    Args:
        base_model: Filter by base model
        status: Filter by status
        tags: Comma-separated tags to filter by
        limit: Number of models to return
        offset: Offset for pagination
        db_url: Database connection string

    Returns:
        Models and pagination info
    """
    try:
        registry = get_model_registry(db_url)

        model_status = None
        if status:
            try:
                model_status = ModelStatus(status)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

        tag_list = tags.split(",") if tags else None

        models, total = registry.list_models(
            base_model=base_model,
            status=model_status,
            tags=tag_list,
            limit=limit,
            offset=offset,
        )

        return {
            "models": [
                ModelMetadataResponse(
                    model_id=model.model_id,
                    version=model.version,
                    base_model=model.base_model,
                    job_id=model.job_id,
                    status=model.status.value,
                    created_at=model.created_at.isoformat(),
                    description=model.description,
                    tags=model.tags,
                    metrics=model.metrics,
                    parameters=model.parameters,
                    size_mb=model.size_mb,
                    deployed_at=model.deployed_at.isoformat() if model.deployed_at else None,
                    checkpoint_path=model.checkpoint_path,
                    custom_metadata=model.custom_metadata,
                )
                for model in models
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register", response_model=ModelMetadataResponse)
async def register_model(
    request: RegisterModelRequest,
    db_url: str = "postgresql://user:password@postgres:5432/autoflow",
):
    """Register a model manually.

    Args:
        request: Model registration request
        db_url: Database connection string

    Returns:
        Model metadata response
    """
    try:
        registry = get_model_registry(db_url)

        model_id = registry.register_model(
            base_model=request.base_model,
            job_id=request.job_id,
            checkpoint_path=request.checkpoint_path,
            metrics=request.metrics,
            parameters=request.parameters,
            description=request.description,
            tags=request.tags,
            parent_version=request.parent_version,
            custom_metadata=request.custom_metadata,
        )

        model = registry.get_model(model_id)

        return ModelMetadataResponse(
            model_id=model.model_id,
            version=model.version,
            base_model=model.base_model,
            job_id=model.job_id,
            status=model.status.value,
            created_at=model.created_at.isoformat(),
            description=model.description,
            tags=model.tags,
            metrics=model.metrics,
            parameters=model.parameters,
            size_mb=model.size_mb,
            deployed_at=model.deployed_at.isoformat() if model.deployed_at else None,
            checkpoint_path=model.checkpoint_path,
            custom_metadata=model.custom_metadata,
        )

    except Exception as e:
        logger.error(f"Failed to register model: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{model_id}/deploy", response_model=Dict[str, Any])
async def deploy_model(
    model_id: str,
    request: DeploymentRequest,
    db_url: str = "postgresql://user:password@postgres:5432/autoflow",
):
    """Deploy a model version.

    Args:
        model_id: Model ID
        request: Deployment request
        db_url: Database connection string

    Returns:
        Deployment info
    """
    try:
        registry = get_model_registry(db_url)
        deployment_id = registry.deploy_model(
            model_id=model_id,
            environment=request.environment,
            endpoint=request.endpoint,
            rollback_from=request.rollback_from,
        )

        return {
            "deployment_id": deployment_id,
            "model_id": model_id,
            "environment": request.environment,
            "endpoint": request.endpoint,
            "status": "active",
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to deploy model: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{model_id}/rollback", response_model=Dict[str, Any])
async def rollback_model(
    model_id: str,
    request: RollbackRequest,
    db_url: str = "postgresql://user:password@postgres:5432/autoflow",
):
    """Rollback to a previous model version.

    Args:
        model_id: Current deployment ID
        request: Rollback request
        db_url: Database connection string

    Returns:
        New deployment info
    """
    try:
        registry = get_model_registry(db_url)
        new_deployment_id = registry.rollback_deployment(
            deployment_id=model_id,
            rollback_to_model_id=request.rollback_to_model_id,
        )

        return {
            "deployment_id": new_deployment_id,
            "rollback_from": model_id,
            "rollback_to": request.rollback_to_model_id,
            "status": "active",
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to rollback model: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{model_id}")
async def archive_model(
    model_id: str,
    db_url: str = "postgresql://user:password@postgres:5432/autoflow",
):
    """Archive a model version.

    Args:
        model_id: Model ID
        db_url: Database connection string

    Returns:
        Success message
    """
    try:
        registry = get_model_registry(db_url)
        registry.archive_model(model_id)

        return {"status": "archived", "model_id": model_id}

    except Exception as e:
        logger.error(f"Failed to archive model: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{model_id}/performance", response_model=Dict[str, Any])
async def get_performance_metrics(
    model_id: str,
    limit: int = Query(50, ge=1, le=500),
    db_url: str = "postgresql://user:password@postgres:5432/autoflow",
):
    """Get performance metrics for a model.

    Args:
        model_id: Model ID
        limit: Number of records to return
        db_url: Database connection string

    Returns:
        Performance metrics
    """
    try:
        registry = get_model_registry(db_url)
        metrics = registry.get_performance_history(model_id, limit=limit)

        return {
            "model_id": model_id,
            "metrics": [
                ModelPerformanceResponse(
                    model_id=metric.model_id,
                    version=metric.version,
                    timestamp=metric.timestamp.isoformat(),
                    accuracy=metric.accuracy,
                    precision=metric.precision,
                    recall=metric.recall,
                    f1_score=metric.f1_score,
                    loss=metric.loss,
                    inference_latency_ms=metric.inference_latency_ms,
                    throughput=metric.throughput,
                    memory_usage_mb=metric.memory_usage_mb,
                )
                for metric in metrics
            ],
            "total": len(metrics),
        }

    except Exception as e:
        logger.error(f"Failed to get performance metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))
