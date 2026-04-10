"""Tests for model management API."""

import pytest
import json
from datetime import datetime
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from autoflow.api.models import router
from fastapi import FastAPI


@pytest.fixture
def client():
    """FastAPI test client."""
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.fixture
def mock_db_url():
    """Mock database URL."""
    return "postgresql://test:test@localhost:5432/test_autoflow"


class TestFineTuneEndpoints:
    """Test fine-tuning endpoints."""

    @patch("autoflow.api.models.get_fine_tuning_pipeline")
    def test_start_fine_tune(self, mock_get_pipeline, client, mock_db_url):
        """Test starting a fine-tuning job."""
        mock_pipeline = MagicMock()
        mock_pipeline.create_job.return_value = "job-123"

        job_mock = MagicMock()
        job_mock.job_id = "job-123"
        job_mock.base_model = "bert-base-uncased"
        job_mock.status.value = "pending"
        job_mock.dataset_id = "dataset-123"
        job_mock.created_at = datetime.utcnow()
        job_mock.started_at = None
        job_mock.completed_at = None
        job_mock.total_samples = 0
        job_mock.samples_processed = 0
        job_mock.current_epoch = 0
        job_mock.current_step = 0
        job_mock.best_eval_loss = None
        job_mock.best_eval_accuracy = None
        job_mock.model_checkpoint_path = None
        job_mock.error_message = None
        job_mock.metadata = {}

        mock_pipeline.get_job.return_value = job_mock
        mock_get_pipeline.return_value = mock_pipeline

        response = client.post(
            "/api/v1/models/fine-tune",
            json={
                "base_model": "bert-base-uncased",
                "dataset_id": "dataset-123",
                "learning_rate": 0.0001,
                "batch_size": 32,
                "num_epochs": 3,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == "job-123"
        assert data["base_model"] == "bert-base-uncased"

    @patch("autoflow.api.models.get_fine_tuning_pipeline")
    def test_get_job_status(self, mock_get_pipeline, client, mock_db_url):
        """Test getting job status."""
        mock_pipeline = MagicMock()

        job_mock = MagicMock()
        job_mock.job_id = "job-123"
        job_mock.base_model = "bert-base-uncased"
        job_mock.status.value = "running"
        job_mock.dataset_id = "dataset-123"
        job_mock.created_at = datetime.utcnow()
        job_mock.started_at = datetime.utcnow()
        job_mock.completed_at = None
        job_mock.total_samples = 5000
        job_mock.samples_processed = 2000
        job_mock.current_epoch = 1
        job_mock.current_step = 100
        job_mock.best_eval_loss = 0.5
        job_mock.best_eval_accuracy = 0.92
        job_mock.model_checkpoint_path = "/checkpoints/model-123"
        job_mock.error_message = None
        job_mock.metadata = {}

        mock_pipeline.get_job.return_value = job_mock
        mock_get_pipeline.return_value = mock_pipeline

        response = client.get("/api/v1/models/jobs/job-123")

        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == "job-123"
        assert data["status"] == "running"
        assert data["samples_processed"] == 2000

    @patch("autoflow.api.models.get_fine_tuning_pipeline")
    def test_list_jobs(self, mock_get_pipeline, client, mock_db_url):
        """Test listing jobs."""
        mock_pipeline = MagicMock()

        job_mock = MagicMock()
        job_mock.job_id = "job-123"
        job_mock.base_model = "bert-base-uncased"
        job_mock.status.value = "completed"
        job_mock.dataset_id = "dataset-123"
        job_mock.created_at = datetime.utcnow()
        job_mock.started_at = datetime.utcnow()
        job_mock.completed_at = datetime.utcnow()
        job_mock.total_samples = 5000
        job_mock.samples_processed = 5000
        job_mock.current_epoch = 3
        job_mock.current_step = 468
        job_mock.best_eval_loss = 0.08
        job_mock.best_eval_accuracy = 0.94
        job_mock.model_checkpoint_path = "/checkpoints/model-123"
        job_mock.error_message = None
        job_mock.metadata = {}

        mock_pipeline.list_jobs.return_value = ([job_mock], 1)
        mock_get_pipeline.return_value = mock_pipeline

        response = client.get("/api/v1/models/jobs")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["jobs"]) == 1

    @patch("autoflow.api.models.get_fine_tuning_pipeline")
    def test_get_job_not_found(self, mock_get_pipeline, client, mock_db_url):
        """Test getting non-existent job."""
        mock_pipeline = MagicMock()
        mock_pipeline.get_job.return_value = None
        mock_get_pipeline.return_value = mock_pipeline

        response = client.get("/api/v1/models/jobs/nonexistent")

        assert response.status_code == 404


class TestModelEndpoints:
    """Test model management endpoints."""

    @patch("autoflow.api.models.get_model_registry")
    def test_list_models(self, mock_get_registry, client, mock_db_url):
        """Test listing models."""
        mock_registry = MagicMock()

        model_mock = MagicMock()
        model_mock.model_id = "model-123"
        model_mock.version = "20260410_120000"
        model_mock.base_model = "bert-base-uncased"
        model_mock.job_id = "job-123"
        model_mock.status.value = "ready"
        model_mock.created_at = datetime.utcnow()
        model_mock.description = "Test model"
        model_mock.tags = ["v1", "production"]
        model_mock.metrics = {"accuracy": 0.92}
        model_mock.parameters = {"hidden_size": 768}
        model_mock.size_mb = 1.5
        model_mock.deployed_at = None
        model_mock.checkpoint_path = "/checkpoints/model-123"
        model_mock.custom_metadata = {}

        mock_registry.list_models.return_value = ([model_mock], 1)
        mock_get_registry.return_value = mock_registry

        response = client.get("/api/v1/models")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["models"]) == 1
        assert data["models"][0]["model_id"] == "model-123"

    @patch("autoflow.api.models.get_model_registry")
    def test_register_model(self, mock_get_registry, client, mock_db_url, tmp_path):
        """Test registering a model."""
        # Create a test checkpoint file
        checkpoint_file = tmp_path / "checkpoint.pt"
        checkpoint_file.write_text("test data")

        mock_registry = MagicMock()
        mock_registry.register_model.return_value = "model-123"

        model_mock = MagicMock()
        model_mock.model_id = "model-123"
        model_mock.version = "20260410_120000"
        model_mock.base_model = "bert-base-uncased"
        model_mock.job_id = "job-123"
        model_mock.status.value = "ready"
        model_mock.created_at = datetime.utcnow()
        model_mock.description = "Test model"
        model_mock.tags = ["v1"]
        model_mock.metrics = {"accuracy": 0.92}
        model_mock.parameters = {"hidden_size": 768}
        model_mock.size_mb = 1.5
        model_mock.deployed_at = None
        model_mock.checkpoint_path = str(checkpoint_file)
        model_mock.custom_metadata = {}

        mock_registry.get_model.return_value = model_mock
        mock_get_registry.return_value = mock_registry

        response = client.post(
            "/api/v1/models/register",
            json={
                "base_model": "bert-base-uncased",
                "job_id": "job-123",
                "checkpoint_path": str(checkpoint_file),
                "metrics": {"accuracy": 0.92},
                "parameters": {"hidden_size": 768},
                "description": "Test model",
                "tags": ["v1"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["model_id"] == "model-123"

    @patch("autoflow.api.models.get_model_registry")
    def test_deploy_model(self, mock_get_registry, client, mock_db_url):
        """Test deploying a model."""
        mock_registry = MagicMock()
        mock_registry.deploy_model.return_value = "deployment-123"
        mock_get_registry.return_value = mock_registry

        response = client.post(
            "/api/v1/models/model-123/deploy",
            json={
                "environment": "production",
                "endpoint": "https://api.example.com/v1/model",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["deployment_id"] == "deployment-123"
        assert data["environment"] == "production"

    @patch("autoflow.api.models.get_model_registry")
    def test_rollback_model(self, mock_get_registry, client, mock_db_url):
        """Test rolling back a model."""
        mock_registry = MagicMock()
        mock_registry.rollback_deployment.return_value = "deployment-124"
        mock_get_registry.return_value = mock_registry

        response = client.post(
            "/api/v1/models/deployment-123/rollback",
            json={"rollback_to_model_id": "model-122"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["deployment_id"] == "deployment-124"

    @patch("autoflow.api.models.get_model_registry")
    def test_archive_model(self, mock_get_registry, client, mock_db_url):
        """Test archiving a model."""
        mock_registry = MagicMock()
        mock_get_registry.return_value = mock_registry

        response = client.delete("/api/v1/models/model-123")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "archived"

    @patch("autoflow.api.models.get_model_registry")
    def test_get_performance_metrics(self, mock_get_registry, client, mock_db_url):
        """Test getting model performance metrics."""
        mock_registry = MagicMock()

        perf_mock = MagicMock()
        perf_mock.model_id = "model-123"
        perf_mock.version = "20260410_120000"
        perf_mock.timestamp = datetime.utcnow()
        perf_mock.accuracy = 0.92
        perf_mock.precision = 0.91
        perf_mock.recall = 0.93
        perf_mock.f1_score = 0.92
        perf_mock.loss = 0.08
        perf_mock.inference_latency_ms = 50.0
        perf_mock.throughput = 100.0
        perf_mock.memory_usage_mb = 256.0

        mock_registry.get_performance_history.return_value = [perf_mock]
        mock_get_registry.return_value = mock_registry

        response = client.get("/api/v1/models/model-123/performance")

        assert response.status_code == 200
        data = response.json()
        assert data["model_id"] == "model-123"
        assert len(data["metrics"]) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
