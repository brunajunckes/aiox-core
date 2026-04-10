"""Model registry and versioning system.

Features:
- Model storage and retrieval
- Version management
- Performance tracking
- Rollback capabilities
- Model metadata management
"""

import uuid
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum
from dataclasses import dataclass, asdict, field

import psycopg

logger = logging.getLogger(__name__)


class ModelStatus(str, Enum):
    """Model version status."""
    TRAINING = "training"
    READY = "ready"
    DEPRECATED = "deprecated"
    ARCHIVED = "archived"
    FAILED = "failed"


@dataclass
class ModelMetadata:
    """Model version metadata."""
    model_id: str
    version: str
    base_model: str
    job_id: str
    status: ModelStatus
    created_at: datetime
    created_by: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    parameters: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, float] = field(default_factory=dict)
    checkpoint_path: Optional[str] = None
    size_mb: float = 0.0
    deployed_at: Optional[datetime] = None
    deployment_info: Dict[str, Any] = field(default_factory=dict)
    parent_version: Optional[str] = None
    custom_metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dictionary."""
        data = asdict(self)
        # Convert datetime to ISO format
        for key in ['created_at', 'deployed_at']:
            if data[key]:
                data[key] = data[key].isoformat()
        # Convert enums to strings
        data['status'] = self.status.value
        return data


@dataclass
class ModelPerformance:
    """Model performance metrics."""
    model_id: str
    version: str
    timestamp: datetime
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    loss: Optional[float] = None
    inference_latency_ms: Optional[float] = None
    throughput: Optional[float] = None  # samples/sec
    memory_usage_mb: Optional[float] = None
    custom_metrics: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data


class ModelRegistry:
    """Model registry and versioning system."""

    def __init__(self, db_url: str, storage_dir: str = "/tmp/models"):
        """Initialize registry.

        Args:
            db_url: PostgreSQL connection string
            storage_dir: Directory for storing model files
        """
        self.db_url = db_url
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _init_schema(self) -> None:
        """Initialize database schema for model registry."""
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                # Create models table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS models (
                        model_id TEXT PRIMARY KEY,
                        version TEXT NOT NULL,
                        base_model TEXT NOT NULL,
                        job_id TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'training',
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        created_by TEXT,
                        description TEXT,
                        tags TEXT[] DEFAULT ARRAY[]::TEXT[],
                        parameters JSONB DEFAULT '{}',
                        metrics JSONB DEFAULT '{}',
                        checkpoint_path TEXT,
                        size_mb FLOAT DEFAULT 0,
                        deployed_at TIMESTAMP,
                        deployment_info JSONB DEFAULT '{}',
                        parent_version TEXT,
                        custom_metadata JSONB DEFAULT '{}',
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                # Create model_performance table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS model_performance (
                        id SERIAL PRIMARY KEY,
                        model_id TEXT NOT NULL REFERENCES models(model_id) ON DELETE CASCADE,
                        version TEXT NOT NULL,
                        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        accuracy FLOAT,
                        precision FLOAT,
                        recall FLOAT,
                        f1_score FLOAT,
                        loss FLOAT,
                        inference_latency_ms FLOAT,
                        throughput FLOAT,
                        memory_usage_mb FLOAT,
                        custom_metrics JSONB DEFAULT '{}'
                    )
                """)

                # Create model_deployments table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS model_deployments (
                        deployment_id TEXT PRIMARY KEY,
                        model_id TEXT NOT NULL REFERENCES models(model_id) ON DELETE CASCADE,
                        version TEXT NOT NULL,
                        environment TEXT NOT NULL,
                        endpoint TEXT,
                        status TEXT NOT NULL DEFAULT 'pending',
                        deployed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        undeployed_at TIMESTAMP,
                        rollback_from TEXT,
                        metadata JSONB DEFAULT '{}',
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                # Create indexes
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_models_job_id ON models(job_id);
                    CREATE INDEX IF NOT EXISTS idx_models_base_model ON models(base_model);
                    CREATE INDEX IF NOT EXISTS idx_models_status ON models(status);
                    CREATE INDEX IF NOT EXISTS idx_model_performance_model ON model_performance(model_id);
                    CREATE INDEX IF NOT EXISTS idx_deployments_model ON model_deployments(model_id);
                """)

                conn.commit()

    def register_model(
        self,
        base_model: str,
        job_id: str,
        checkpoint_path: str,
        metrics: Dict[str, float],
        parameters: Dict[str, Any],
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        parent_version: Optional[str] = None,
        custom_metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Register a new model version.

        Args:
            base_model: Base model name
            job_id: Fine-tuning job ID
            checkpoint_path: Path to model checkpoint
            metrics: Performance metrics
            parameters: Model parameters
            description: Model description
            tags: Tags for the model
            parent_version: Parent model version ID
            custom_metadata: Custom metadata

        Returns:
            Model ID
        """
        model_id = str(uuid.uuid4())

        # Generate version string
        version = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

        # Calculate file size
        try:
            size_mb = Path(checkpoint_path).stat().st_size / (1024 * 1024)
        except:
            size_mb = 0.0

        metadata = ModelMetadata(
            model_id=model_id,
            version=version,
            base_model=base_model,
            job_id=job_id,
            status=ModelStatus.READY,
            created_at=datetime.utcnow(),
            description=description,
            tags=tags or [],
            parameters=parameters,
            metrics=metrics,
            checkpoint_path=checkpoint_path,
            size_mb=size_mb,
            parent_version=parent_version,
            custom_metadata=custom_metadata or {},
        )

        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO models (
                        model_id, version, base_model, job_id, status,
                        created_at, description, tags, parameters, metrics,
                        checkpoint_path, size_mb, parent_version, custom_metadata
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    model_id,
                    version,
                    base_model,
                    job_id,
                    metadata.status.value,
                    metadata.created_at,
                    description,
                    tags or [],
                    json.dumps(parameters),
                    json.dumps(metrics),
                    checkpoint_path,
                    size_mb,
                    parent_version,
                    json.dumps(custom_metadata or {}),
                ))
                conn.commit()

        logger.info(f"Registered model {model_id} (v{version}) from job {job_id}")
        return model_id

    def get_model(self, model_id: str) -> Optional[ModelMetadata]:
        """Get model metadata.

        Args:
            model_id: Model ID

        Returns:
            ModelMetadata or None if not found
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT model_id, version, base_model, job_id, status,
                           created_at, created_by, description, tags, parameters,
                           metrics, checkpoint_path, size_mb, deployed_at,
                           deployment_info, parent_version, custom_metadata
                    FROM models
                    WHERE model_id = %s
                """, (model_id,))

                row = cur.fetchone()
                if not row:
                    return None

                return ModelMetadata(
                    model_id=row[0],
                    version=row[1],
                    base_model=row[2],
                    job_id=row[3],
                    status=ModelStatus(row[4]),
                    created_at=row[5],
                    created_by=row[6],
                    description=row[7],
                    tags=row[8] or [],
                    parameters=row[9],
                    metrics=row[10],
                    checkpoint_path=row[11],
                    size_mb=row[12],
                    deployed_at=row[13],
                    deployment_info=row[14] or {},
                    parent_version=row[15],
                    custom_metadata=row[16] or {},
                )

    def get_best_model(self, base_model: str, metric: str = "accuracy") -> Optional[ModelMetadata]:
        """Get best model version by metric.

        Args:
            base_model: Base model name
            metric: Metric to optimize for

        Returns:
            Best ModelMetadata or None
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT model_id, version, base_model, job_id, status,
                           created_at, created_by, description, tags, parameters,
                           metrics, checkpoint_path, size_mb, deployed_at,
                           deployment_info, parent_version, custom_metadata
                    FROM models
                    WHERE base_model = %s AND status = 'ready'
                    ORDER BY (metrics->>%s)::FLOAT DESC
                    LIMIT 1
                """, (base_model, metric))

                row = cur.fetchone()
                if not row:
                    return None

                return ModelMetadata(
                    model_id=row[0],
                    version=row[1],
                    base_model=row[2],
                    job_id=row[3],
                    status=ModelStatus(row[4]),
                    created_at=row[5],
                    created_by=row[6],
                    description=row[7],
                    tags=row[8] or [],
                    parameters=row[9],
                    metrics=row[10],
                    checkpoint_path=row[11],
                    size_mb=row[12],
                    deployed_at=row[13],
                    deployment_info=row[14] or {},
                    parent_version=row[15],
                    custom_metadata=row[16] or {},
                )

    def list_models(
        self,
        base_model: Optional[str] = None,
        status: Optional[ModelStatus] = None,
        tags: Optional[List[str]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[ModelMetadata], int]:
        """List models with optional filtering.

        Args:
            base_model: Filter by base model
            status: Filter by status
            tags: Filter by tags
            limit: Number of models to return
            offset: Offset for pagination

        Returns:
            Tuple of (models list, total count)
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                query_parts = ["WHERE 1=1"]
                params = []

                if base_model:
                    query_parts.append("AND base_model = %s")
                    params.append(base_model)

                if status:
                    query_parts.append("AND status = %s")
                    params.append(status.value)

                if tags:
                    query_parts.append("AND tags && %s")
                    params.append(tags)

                where_clause = " ".join(query_parts)

                # Get count
                cur.execute(f"SELECT COUNT(*) FROM models {where_clause}", params)
                total = cur.fetchone()[0]

                # Get models
                cur.execute(f"""
                    SELECT model_id, version, base_model, job_id, status,
                           created_at, created_by, description, tags, parameters,
                           metrics, checkpoint_path, size_mb, deployed_at,
                           deployment_info, parent_version, custom_metadata
                    FROM models
                    {where_clause}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """, params + [limit, offset])

                models = []
                for row in cur.fetchall():
                    models.append(ModelMetadata(
                        model_id=row[0],
                        version=row[1],
                        base_model=row[2],
                        job_id=row[3],
                        status=ModelStatus(row[4]),
                        created_at=row[5],
                        created_by=row[6],
                        description=row[7],
                        tags=row[8] or [],
                        parameters=row[9],
                        metrics=row[10],
                        checkpoint_path=row[11],
                        size_mb=row[12],
                        deployed_at=row[13],
                        deployment_info=row[14] or {},
                        parent_version=row[15],
                        custom_metadata=row[16] or {},
                    ))

        return models, total

    def update_model_status(
        self,
        model_id: str,
        status: ModelStatus,
    ) -> None:
        """Update model status.

        Args:
            model_id: Model ID
            status: New status
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE models
                    SET status = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE model_id = %s
                """, (status.value, model_id))
                conn.commit()

    def record_performance(
        self,
        model_id: str,
        performance: ModelPerformance,
    ) -> None:
        """Record model performance metrics.

        Args:
            model_id: Model ID
            performance: Performance metrics
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO model_performance (
                        model_id, version, timestamp, accuracy, precision,
                        recall, f1_score, loss, inference_latency_ms,
                        throughput, memory_usage_mb, custom_metrics
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    performance.model_id,
                    performance.version,
                    performance.timestamp,
                    performance.accuracy,
                    performance.precision,
                    performance.recall,
                    performance.f1_score,
                    performance.loss,
                    performance.inference_latency_ms,
                    performance.throughput,
                    performance.memory_usage_mb,
                    json.dumps(performance.custom_metrics),
                ))
                conn.commit()

    def get_performance_history(
        self,
        model_id: str,
        limit: int = 50,
    ) -> List[ModelPerformance]:
        """Get performance history for a model.

        Args:
            model_id: Model ID
            limit: Number of records to return

        Returns:
            List of ModelPerformance
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT model_id, version, timestamp, accuracy, precision,
                           recall, f1_score, loss, inference_latency_ms,
                           throughput, memory_usage_mb, custom_metrics
                    FROM model_performance
                    WHERE model_id = %s
                    ORDER BY timestamp DESC
                    LIMIT %s
                """, (model_id, limit))

                performance = []
                for row in cur.fetchall():
                    performance.append(ModelPerformance(
                        model_id=row[0],
                        version=row[1],
                        timestamp=row[2],
                        accuracy=row[3],
                        precision=row[4],
                        recall=row[5],
                        f1_score=row[6],
                        loss=row[7],
                        inference_latency_ms=row[8],
                        throughput=row[9],
                        memory_usage_mb=row[10],
                        custom_metrics=row[11] or {},
                    ))

        return performance

    def deploy_model(
        self,
        model_id: str,
        environment: str,
        endpoint: Optional[str] = None,
        rollback_from: Optional[str] = None,
    ) -> str:
        """Deploy a model version.

        Args:
            model_id: Model ID
            environment: Deployment environment
            endpoint: Deployment endpoint URL
            rollback_from: Previous deployment ID to rollback from

        Returns:
            Deployment ID
        """
        deployment_id = str(uuid.uuid4())

        model = self.get_model(model_id)
        if not model:
            raise ValueError(f"Model {model_id} not found")

        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO model_deployments (
                        deployment_id, model_id, version, environment,
                        endpoint, status, deployed_at, rollback_from
                    ) VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, %s)
                """, (
                    deployment_id,
                    model_id,
                    model.version,
                    environment,
                    endpoint,
                    "active",
                    rollback_from,
                ))

                # Update model deployment info
                deployment_info = {
                    "environment": environment,
                    "endpoint": endpoint,
                    "deployment_id": deployment_id,
                    "deployed_at": datetime.utcnow().isoformat(),
                }

                cur.execute("""
                    UPDATE models
                    SET deployed_at = CURRENT_TIMESTAMP,
                        deployment_info = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE model_id = %s
                """, (json.dumps(deployment_info), model_id))

                conn.commit()

        logger.info(f"Deployed model {model_id} to {environment}")
        return deployment_id

    def rollback_deployment(
        self,
        deployment_id: str,
        rollback_to_model_id: str,
    ) -> str:
        """Rollback to a previous model version.

        Args:
            deployment_id: Current deployment ID
            rollback_to_model_id: Model ID to rollback to

        Returns:
            New deployment ID
        """
        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                # Get current deployment info
                cur.execute("""
                    SELECT environment, endpoint FROM model_deployments
                    WHERE deployment_id = %s
                """, (deployment_id,))

                row = cur.fetchone()
                if not row:
                    raise ValueError(f"Deployment {deployment_id} not found")

                environment, endpoint = row

                # Create new deployment
                new_deployment_id = str(uuid.uuid4())
                rollback_to_model = self.get_model(rollback_to_model_id)

                cur.execute("""
                    INSERT INTO model_deployments (
                        deployment_id, model_id, version, environment,
                        endpoint, status, deployed_at, rollback_from
                    ) VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, %s)
                """, (
                    new_deployment_id,
                    rollback_to_model_id,
                    rollback_to_model.version,
                    environment,
                    endpoint,
                    "active",
                    deployment_id,
                ))

                # Mark old deployment as inactive
                cur.execute("""
                    UPDATE model_deployments
                    SET status = 'inactive', undeployed_at = CURRENT_TIMESTAMP
                    WHERE deployment_id = %s
                """, (deployment_id,))

                conn.commit()

        logger.info(f"Rolled back deployment to {rollback_to_model_id}")
        return new_deployment_id

    def archive_model(self, model_id: str) -> None:
        """Archive a model version.

        Args:
            model_id: Model ID
        """
        self.update_model_status(model_id, ModelStatus.ARCHIVED)
        logger.info(f"Archived model {model_id}")
