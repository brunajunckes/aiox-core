"""Tests for model registry and versioning."""

import pytest
import json
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

from autoflow.ml.model_registry import (
    ModelRegistry,
    ModelMetadata,
    ModelPerformance,
    ModelStatus,
)


@pytest.fixture
def db_url():
    """Database URL for testing."""
    return "postgresql://test:test@localhost:5432/test_autoflow"


@pytest.fixture
def temp_checkpoint(tmp_path):
    """Temporary checkpoint file."""
    checkpoint_file = tmp_path / "checkpoint.pt"
    checkpoint_file.write_text("x" * 1000000)  # 1MB file
    return str(checkpoint_file)


class TestModelMetadata:
    """Test ModelMetadata."""

    def test_model_metadata_creation(self):
        """Test creating model metadata."""
        metadata = ModelMetadata(
            model_id="model-123",
            version="20260410_120000",
            base_model="bert-base-uncased",
            job_id="job-123",
            status=ModelStatus.READY,
            created_at=datetime.utcnow(),
        )

        assert metadata.model_id == "model-123"
        assert metadata.status == ModelStatus.READY
        assert metadata.tags == []

    def test_model_metadata_to_dict(self):
        """Test converting metadata to dictionary."""
        metadata = ModelMetadata(
            model_id="model-123",
            version="20260410_120000",
            base_model="bert-base-uncased",
            job_id="job-123",
            status=ModelStatus.READY,
            created_at=datetime.utcnow(),
            description="Test model",
            tags=["v1", "production"],
        )

        metadata_dict = metadata.to_dict()
        assert metadata_dict["model_id"] == "model-123"
        assert metadata_dict["status"] == "ready"
        assert metadata_dict["tags"] == ["v1", "production"]


class TestModelPerformance:
    """Test ModelPerformance."""

    def test_model_performance_creation(self):
        """Test creating performance metrics."""
        perf = ModelPerformance(
            model_id="model-123",
            version="20260410_120000",
            timestamp=datetime.utcnow(),
            accuracy=0.92,
            precision=0.91,
            recall=0.93,
            f1_score=0.92,
            loss=0.08,
        )

        assert perf.accuracy == 0.92
        assert perf.f1_score == 0.92

    def test_model_performance_to_dict(self):
        """Test converting performance to dictionary."""
        perf = ModelPerformance(
            model_id="model-123",
            version="20260410_120000",
            timestamp=datetime.utcnow(),
            accuracy=0.92,
            precision=0.91,
            inference_latency_ms=50.0,
        )

        perf_dict = perf.to_dict()
        assert perf_dict["accuracy"] == 0.92
        assert perf_dict["inference_latency_ms"] == 50.0


@pytest.mark.asyncio
class TestModelRegistry:
    """Test ModelRegistry."""

    @patch("autoflow.ml.model_registry.psycopg.connect")
    def test_registry_initialization(self, mock_connect, db_url):
        """Test registry initialization."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_connect.return_value.__enter__.return_value = mock_conn

        registry = ModelRegistry(db_url)
        assert registry.db_url == db_url
        assert registry.storage_dir.exists()

    @patch("autoflow.ml.model_registry.psycopg.connect")
    def test_register_model(
        self, mock_connect, db_url, temp_checkpoint
    ):
        """Test registering a model."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_conn.commit = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn

        registry = ModelRegistry(db_url)
        model_id = registry.register_model(
            base_model="bert-base-uncased",
            job_id="job-123",
            checkpoint_path=temp_checkpoint,
            metrics={"accuracy": 0.92, "f1": 0.91},
            parameters={"hidden_size": 768},
            description="Test model",
            tags=["v1", "production"],
        )

        assert model_id is not None
        assert mock_cursor.execute.called

    @patch("autoflow.ml.model_registry.psycopg.connect")
    def test_get_model(self, mock_connect, db_url):
        """Test retrieving model metadata."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_connect.return_value.__enter__.return_value = mock_conn

        # Setup mock to return model data
        mock_cursor.fetchone.return_value = (
            "model-123",
            "20260410_120000",
            "bert-base-uncased",
            "job-123",
            "ready",
            datetime.utcnow(),
            "user@example.com",
            "Test model",
            ["v1", "production"],
            {"hidden_size": 768},
            {"accuracy": 0.92},
            "/path/to/checkpoint",
            1.5,
            None,
            {},
            None,
            {},
        )

        registry = ModelRegistry(db_url)
        model = registry.get_model("model-123")

        assert model is not None
        assert model.model_id == "model-123"
        assert model.status == ModelStatus.READY

    @patch("autoflow.ml.model_registry.psycopg.connect")
    def test_get_best_model(self, mock_connect, db_url):
        """Test retrieving best model by metric."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_connect.return_value.__enter__.return_value = mock_conn

        mock_cursor.fetchone.return_value = (
            "model-best",
            "20260410_120000",
            "bert-base-uncased",
            "job-123",
            "ready",
            datetime.utcnow(),
            None,
            None,
            [],
            {},
            {"accuracy": 0.95},
            "/path/to/checkpoint",
            1.5,
            None,
            {},
            None,
            {},
        )

        registry = ModelRegistry(db_url)
        model = registry.get_best_model("bert-base-uncased", metric="accuracy")

        assert model is not None
        assert model.model_id == "model-best"

    @patch("autoflow.ml.model_registry.psycopg.connect")
    def test_update_model_status(self, mock_connect, db_url):
        """Test updating model status."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_conn.commit = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn

        registry = ModelRegistry(db_url)
        registry.update_model_status("model-123", ModelStatus.DEPRECATED)

        assert mock_cursor.execute.called

    @patch("autoflow.ml.model_registry.psycopg.connect")
    def test_record_performance(self, mock_connect, db_url):
        """Test recording performance metrics."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_conn.commit = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn

        registry = ModelRegistry(db_url)
        perf = ModelPerformance(
            model_id="model-123",
            version="20260410_120000",
            timestamp=datetime.utcnow(),
            accuracy=0.92,
            precision=0.91,
            f1_score=0.92,
        )

        registry.record_performance("model-123", perf)
        assert mock_cursor.execute.called

    @patch("autoflow.ml.model_registry.psycopg.connect")
    def test_deploy_model(self, mock_connect, db_url):
        """Test deploying a model."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_conn.commit = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn

        # Mock get_model
        mock_cursor.fetchone.return_value = (
            "model-123",
            "20260410_120000",
            "bert-base-uncased",
            "job-123",
            "ready",
            datetime.utcnow(),
            None,
            None,
            [],
            {},
            {"accuracy": 0.92},
            "/path/to/checkpoint",
            1.5,
            None,
            {},
            None,
            {},
        )

        registry = ModelRegistry(db_url)
        deployment_id = registry.deploy_model(
            model_id="model-123",
            environment="production",
            endpoint="https://api.example.com/v1/model",
        )

        assert deployment_id is not None
        assert mock_cursor.execute.called

    @patch("autoflow.ml.model_registry.psycopg.connect")
    def test_archive_model(self, mock_connect, db_url):
        """Test archiving a model."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_conn.commit = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn

        registry = ModelRegistry(db_url)
        registry.archive_model("model-123")

        assert mock_cursor.execute.called

    @patch("autoflow.ml.model_registry.psycopg.connect")
    def test_list_models(self, mock_connect, db_url):
        """Test listing models."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_connect.return_value.__enter__.return_value = mock_conn

        # Mock count query
        mock_cursor.fetchone.side_effect = [
            (5,),  # Total count
            (
                "model-1",
                "20260410_120000",
                "bert-base-uncased",
                "job-1",
                "ready",
                datetime.utcnow(),
                None,
                None,
                [],
                {},
                {"accuracy": 0.92},
                "/path/to/checkpoint",
                1.5,
                None,
                {},
                None,
                {},
            ),
        ]

        mock_cursor.fetchall.return_value = [
            (
                "model-1",
                "20260410_120000",
                "bert-base-uncased",
                "job-1",
                "ready",
                datetime.utcnow(),
                None,
                None,
                [],
                {},
                {"accuracy": 0.92},
                "/path/to/checkpoint",
                1.5,
                None,
                {},
                None,
                {},
            ),
        ]

        registry = ModelRegistry(db_url)
        models, total = registry.list_models(base_model="bert-base-uncased")

        assert len(models) >= 0
        assert total == 5


class TestModelStatus:
    """Test ModelStatus enum."""

    def test_model_status_values(self):
        """Test model status values."""
        assert ModelStatus.TRAINING.value == "training"
        assert ModelStatus.READY.value == "ready"
        assert ModelStatus.DEPRECATED.value == "deprecated"
        assert ModelStatus.ARCHIVED.value == "archived"

    def test_model_status_from_string(self):
        """Test creating status from string."""
        status = ModelStatus("ready")
        assert status == ModelStatus.READY


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
