"""Experiments API endpoints for A/B testing framework.

Endpoints:
  POST   /experiments                    — Create experiment
  GET    /experiments                    — List experiments
  GET    /experiments/{id}               — Get experiment details
  PUT    /experiments/{id}               — Update experiment
  DELETE /experiments/{id}               — Delete experiment
  GET    /experiments/{id}/results       — Get statistical analysis
  POST   /experiments/{id}/metric        — Record metric
  POST   /experiments/{id}/rollout       — Deploy winning variant
  GET    /experiments/{id}/variants      — Get variant assignments for user
  POST   /experiments/{id}/assign        — Get variant for user
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
import uuid

from ..features.ab_testing import (
    Experiment,
    ExperimentConfig,
    ExperimentStatus,
    Metric,
    MetricType,
    Variant,
)
from ..features.variants import FeatureFlag, FeatureFlagManager, RolloutStrategy

router = APIRouter(prefix="/api/v1/experiments", tags=["experiments"])

# In-memory storage (in production, use database)
_experiments: Dict[str, Experiment] = {}
_feature_flags: FeatureFlagManager = FeatureFlagManager()


# ── Models ──


class VariantRequest(BaseModel):
    id: str
    name: str
    percentage: float = Field(..., ge=0, le=100)
    description: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)


class CreateExperimentRequest(BaseModel):
    name: str
    description: str
    variants: List[VariantRequest]
    end_date: Optional[str] = None
    target_sample_size: Optional[int] = None
    confidence_level: float = Field(0.95, ge=0.90, le=0.99)
    minimum_detectable_effect: float = Field(0.10, ge=0.01, le=1.0)
    control_variant_id: Optional[str] = None
    tags: Dict[str, str] = Field(default_factory=dict)


class UpdateExperimentRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    end_date: Optional[str] = None


class RecordMetricRequest(BaseModel):
    user_id: str
    variant_id: str
    metric_type: str = Field(..., description="conversion, continuous, count")
    metric_name: str
    value: float
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ExperimentResponse(BaseModel):
    id: str
    name: str
    description: str
    status: str
    created_at: str
    start_date: str
    end_date: Optional[str]
    variants: List[Dict[str, Any]]
    sample_size: int
    confidence_level: float
    minimum_detectable_effect: float


class AnalysisResponse(BaseModel):
    experiment_id: str
    status: str
    total_samples: int
    variant_results: Dict[str, Any]
    comparisons: List[Dict[str, Any]]


class VariantAssignmentResponse(BaseModel):
    user_id: str
    experiment_id: str
    variant_id: str
    assigned_at: str


# ── Endpoints ──


@router.post("", response_model=ExperimentResponse)
def create_experiment(request: CreateExperimentRequest) -> ExperimentResponse:
    """Create a new A/B testing experiment."""
    experiment_id = f"exp_{uuid.uuid4().hex[:12]}"

    # Parse end date
    end_date = None
    if request.end_date:
        try:
            end_date = datetime.fromisoformat(request.end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")

    # Convert variants
    variants = [
        Variant(
            id=v.id,
            name=v.name,
            percentage=v.percentage,
            description=v.description,
            config=v.config,
        )
        for v in request.variants
    ]

    # Validate percentages sum to 100
    total_percentage = sum(v.percentage for v in variants)
    if not (99.9 <= total_percentage <= 100.1):
        raise HTTPException(
            status_code=400,
            detail=f"Variant percentages must sum to 100, got {total_percentage}"
        )

    config = ExperimentConfig(
        name=request.name,
        description=request.description,
        start_date=datetime.now(),
        end_date=end_date,
        variants=variants,
        target_sample_size=request.target_sample_size,
        confidence_level=request.confidence_level,
        minimum_detectable_effect=request.minimum_detectable_effect,
        control_variant_id=request.control_variant_id,
        tags=request.tags,
    )

    experiment = Experiment(config, experiment_id)
    experiment.status = ExperimentStatus.RUNNING
    _experiments[experiment_id] = experiment

    return ExperimentResponse(
        id=experiment_id,
        name=experiment.config.name,
        description=experiment.config.description,
        status=experiment.status.value,
        created_at=experiment.created_at.isoformat(),
        start_date=experiment.config.start_date.isoformat(),
        end_date=experiment.config.end_date.isoformat() if experiment.config.end_date else None,
        variants=[
            {
                "id": v.id,
                "name": v.name,
                "percentage": v.percentage,
                "description": v.description,
            }
            for v in experiment.config.variants
        ],
        sample_size=len(experiment.results),
        confidence_level=experiment.config.confidence_level,
        minimum_detectable_effect=experiment.config.minimum_detectable_effect,
    )


@router.get("")
def list_experiments() -> Dict[str, Any]:
    """List all experiments."""
    experiments = []
    for exp_id, experiment in _experiments.items():
        experiments.append({
            "id": exp_id,
            "name": experiment.config.name,
            "status": experiment.status.value,
            "created_at": experiment.created_at.isoformat(),
            "sample_size": len(experiment.results),
            "variant_count": len(experiment.config.variants),
        })

    return {
        "experiments": experiments,
        "total": len(experiments),
    }


@router.get("/{experiment_id}", response_model=ExperimentResponse)
def get_experiment(experiment_id: str) -> ExperimentResponse:
    """Get experiment details."""
    experiment = _experiments.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    return ExperimentResponse(
        id=experiment_id,
        name=experiment.config.name,
        description=experiment.config.description,
        status=experiment.status.value,
        created_at=experiment.created_at.isoformat(),
        start_date=experiment.config.start_date.isoformat(),
        end_date=experiment.config.end_date.isoformat() if experiment.config.end_date else None,
        variants=[
            {
                "id": v.id,
                "name": v.name,
                "percentage": v.percentage,
                "description": v.description,
            }
            for v in experiment.config.variants
        ],
        sample_size=len(experiment.results),
        confidence_level=experiment.config.confidence_level,
        minimum_detectable_effect=experiment.config.minimum_detectable_effect,
    )


@router.put("/{experiment_id}")
def update_experiment(
    experiment_id: str,
    request: UpdateExperimentRequest
) -> ExperimentResponse:
    """Update experiment."""
    experiment = _experiments.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if request.name:
        experiment.config.name = request.name
    if request.description:
        experiment.config.description = request.description
    if request.status:
        try:
            experiment.status = ExperimentStatus(request.status)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status")
    if request.end_date:
        try:
            experiment.config.end_date = datetime.fromisoformat(request.end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format")

    return ExperimentResponse(
        id=experiment_id,
        name=experiment.config.name,
        description=experiment.config.description,
        status=experiment.status.value,
        created_at=experiment.created_at.isoformat(),
        start_date=experiment.config.start_date.isoformat(),
        end_date=experiment.config.end_date.isoformat() if experiment.config.end_date else None,
        variants=[
            {
                "id": v.id,
                "name": v.name,
                "percentage": v.percentage,
                "description": v.description,
            }
            for v in experiment.config.variants
        ],
        sample_size=len(experiment.results),
        confidence_level=experiment.config.confidence_level,
        minimum_detectable_effect=experiment.config.minimum_detectable_effect,
    )


@router.delete("/{experiment_id}")
def delete_experiment(experiment_id: str) -> Dict[str, str]:
    """Delete experiment."""
    if experiment_id not in _experiments:
        raise HTTPException(status_code=404, detail="Experiment not found")

    del _experiments[experiment_id]
    return {"message": "Experiment deleted"}


@router.post("/{experiment_id}/assign", response_model=VariantAssignmentResponse)
def assign_variant(
    experiment_id: str,
    user_id: str = Body(...),
) -> VariantAssignmentResponse:
    """Get variant assignment for user."""
    experiment = _experiments.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    variant = experiment.assign_variant(user_id)

    return VariantAssignmentResponse(
        user_id=user_id,
        experiment_id=experiment_id,
        variant_id=variant.id,
        assigned_at=datetime.now().isoformat(),
    )


@router.post("/{experiment_id}/metric")
def record_metric(
    experiment_id: str,
    request: RecordMetricRequest
) -> Dict[str, str]:
    """Record metric for experiment."""
    experiment = _experiments.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    # Parse metric type
    try:
        metric_type = MetricType(request.metric_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid metric_type")

    # Create and record metric
    metric = Metric(
        user_id=request.user_id,
        variant_id=request.variant_id,
        metric_type=metric_type,
        metric_name=request.metric_name,
        value=request.value,
        metadata=request.metadata,
    )

    experiment.record_metric(metric)

    return {"message": "Metric recorded"}


@router.get("/{experiment_id}/results", response_model=AnalysisResponse)
def get_analysis(experiment_id: str) -> AnalysisResponse:
    """Get statistical analysis of experiment results."""
    experiment = _experiments.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    analysis = experiment.run_analysis()

    return AnalysisResponse(
        experiment_id=analysis["experiment_id"],
        status=analysis["status"],
        total_samples=analysis["total_samples"],
        variant_results=analysis["variant_results"],
        comparisons=analysis["comparisons"],
    )


@router.post("/{experiment_id}/rollout")
def deploy_winner(
    experiment_id: str,
    winner_variant_id: str = Body(...),
) -> Dict[str, Any]:
    """Deploy winning variant as feature flag."""
    experiment = _experiments.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    # Verify variant exists
    variant = next(
        (v for v in experiment.config.variants if v.id == winner_variant_id),
        None
    )
    if not variant:
        raise HTTPException(status_code=400, detail="Variant not found")

    # Create feature flag for winner
    flag_id = f"flag_{experiment_id}"
    flag = _feature_flags.create_flag(
        flag_id=flag_id,
        name=f"{experiment.config.name} - Winner",
        description=f"Winner from experiment {experiment_id}",
        enabled=True,
    )

    # Configure rollout to 100% for winner
    flag.rollout_strategy.add_allocation(winner_variant_id, 100.0)
    flag.enable()

    # Update experiment status
    experiment.status = ExperimentStatus.COMPLETED

    return {
        "message": "Winning variant deployed",
        "experiment_id": experiment_id,
        "winner_variant_id": winner_variant_id,
        "flag_id": flag_id,
    }


@router.get("/{experiment_id}/variants")
def get_user_variants(
    experiment_id: str,
    user_id: str,
) -> Dict[str, Any]:
    """Get variant assignments for user across experiments."""
    experiment = _experiments.get(experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    variant = experiment.assign_variant(user_id)

    return {
        "user_id": user_id,
        "experiment_id": experiment_id,
        "variant_id": variant.id,
        "variant_name": variant.name,
        "variant_config": variant.config,
    }
