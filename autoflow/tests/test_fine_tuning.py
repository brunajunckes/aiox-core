"""Tests for fine-tuning pipeline."""

import pytest
import json
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

from autoflow.ml.fine_tuning import (
    FineTuningPipeline,
    TrainingConfig,
    FineTuneJob,
    TrainingMetrics,
    JobStatus,
)


@pytest.fixture
def db_url():
    """Database URL for testing."""
    return "postgresql://test:test@localhost:5432/test_autoflow"


@pytest.fixture
def training_config():
    """Sample training configuration."""
    return TrainingConfig(
        base_model="bert-base-uncased",
        learning_rate=0.0001,
        batch_size=32,
        num_epochs=3,
        warmup_steps=500,
        weight_decay=0.01,
        max_grad_norm=1.0,
    )


class TestTrainingConfig:
    """Test TrainingConfig."""

    def test_training_config_creation(self, training_config):
        """Test creating training configuration."""
        assert training_config.base_model == "bert-base-uncased"
        assert training_config.learning_rate == 0.0001
        assert training_config.batch_size == 32
        assert training_config.num_epochs == 3

    def test_training_config_to_dict(self, training_config):
        """Test converting config to dictionary."""
        config_dict = training_config.to_dict()
        assert isinstance(config_dict, dict)
        assert config_dict["base_model"] == "bert-base-uncased"
        assert config_dict["learning_rate"] == 0.0001


class TestFineTuneJob:
    """Test FineTuneJob."""

    def test_fine_tune_job_creation(self):
        """Test creating fine-tune job."""
        job = FineTuneJob(
            job_id="test-job-123",
            base_model="bert-base-uncased",
            status=JobStatus.PENDING,
            training_config={"batch_size": 32},
            dataset_id="dataset-123",
            created_at=datetime.utcnow(),
        )

        assert job.job_id == "test-job-123"
        assert job.status == JobStatus.PENDING
        assert job.samples_processed == 0

    def test_fine_tune_job_to_dict(self):
        """Test converting job to dictionary."""
        job = FineTuneJob(
            job_id="test-job-123",
            base_model="bert-base-uncased",
            status=JobStatus.RUNNING,
            training_config={"batch_size": 32},
            dataset_id="dataset-123",
            created_at=datetime.utcnow(),
            current_epoch=1,
            current_step=100,
        )

        job_dict = job.to_dict()
        assert job_dict["job_id"] == "test-job-123"
        assert job_dict["status"] == "running"
        assert job_dict["current_epoch"] == 1


class TestTrainingMetrics:
    """Test TrainingMetrics."""

    def test_training_metrics_creation(self):
        """Test creating training metrics."""
        metrics = TrainingMetrics(
            step=100,
            epoch=1,
            loss=0.5,
            learning_rate=0.0001,
            samples_processed=3200,
            throughput=100.0,
            eval_loss=0.48,
            eval_accuracy=0.92,
        )

        assert metrics.step == 100
        assert metrics.loss == 0.5
        assert metrics.eval_accuracy == 0.92

    def test_training_metrics_to_dict(self):
        """Test converting metrics to dictionary."""
        metrics = TrainingMetrics(
            step=100,
            epoch=1,
            loss=0.5,
            learning_rate=0.0001,
            samples_processed=3200,
            throughput=100.0,
        )

        metrics_dict = metrics.to_dict()
        assert metrics_dict["step"] == 100
        assert metrics_dict["loss"] == 0.5
        assert "timestamp" in metrics_dict


@pytest.mark.asyncio
class TestFineTuningPipeline:
    """Test FineTuningPipeline."""

    @patch("autoflow.ml.fine_tuning.psycopg.connect")
    def test_pipeline_initialization(self, mock_connect, db_url):
        """Test pipeline initialization."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_connect.return_value.__enter__.return_value = mock_conn

        pipeline = FineTuningPipeline(db_url)
        assert pipeline.db_url == db_url

    @patch("autoflow.ml.fine_tuning.psycopg.connect")
    def test_create_job(self, mock_connect, db_url, training_config):
        """Test creating a fine-tuning job."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_conn.commit = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn

        pipeline = FineTuningPipeline(db_url)
        job_id = pipeline.create_job(
            base_model="bert-base-uncased",
            dataset_id="dataset-123",
            training_config=training_config,
        )

        assert job_id is not None
        assert mock_cursor.execute.called

    @patch("autoflow.ml.fine_tuning.psycopg.connect")
    def test_update_job_status(self, mock_connect, db_url):
        """Test updating job status."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_conn.commit = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn

        pipeline = FineTuningPipeline(db_url)
        pipeline.update_job_status("job-123", JobStatus.RUNNING)

        # Verify execute was called
        assert mock_cursor.execute.called

    @patch("autoflow.ml.fine_tuning.psycopg.connect")
    def test_record_metric(self, mock_connect, db_url):
        """Test recording training metrics."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_conn.commit = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn

        pipeline = FineTuningPipeline(db_url)
        metric = TrainingMetrics(
            step=100,
            epoch=1,
            loss=0.5,
            learning_rate=0.0001,
            samples_processed=3200,
            throughput=100.0,
        )

        pipeline.record_metric("job-123", metric)
        assert mock_cursor.execute.called

    @patch("autoflow.ml.fine_tuning.psycopg.connect")
    def test_save_checkpoint(self, mock_connect, db_url, tmp_path):
        """Test saving model checkpoint."""
        # Create a test file
        checkpoint_file = tmp_path / "checkpoint.pt"
        checkpoint_file.write_text("test checkpoint data")

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_conn.commit = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn

        pipeline = FineTuningPipeline(db_url)
        checkpoint_id = pipeline.save_checkpoint(
            job_id="job-123",
            checkpoint_path=str(checkpoint_file),
            step=100,
            epoch=1,
            eval_loss=0.5,
            is_best=True,
        )

        assert checkpoint_id is not None
        assert mock_cursor.execute.called


class TestJobStatus:
    """Test JobStatus enum."""

    def test_job_status_values(self):
        """Test job status values."""
        assert JobStatus.PENDING.value == "pending"
        assert JobStatus.RUNNING.value == "running"
        assert JobStatus.COMPLETED.value == "completed"
        assert JobStatus.FAILED.value == "failed"

    def test_job_status_from_string(self):
        """Test creating job status from string."""
        status = JobStatus("running")
        assert status == JobStatus.RUNNING


class TestPipelineIntegration:
    """Integration tests for fine-tuning pipeline."""

    @patch("autoflow.ml.fine_tuning.psycopg.connect")
    def test_full_pipeline_workflow(self, mock_connect, db_url, training_config):
        """Test complete pipeline workflow."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_conn.commit = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn

        # Setup mock to return job data
        mock_cursor.fetchone.return_value = (
            "job-123",
            "bert-base-uncased",
            "running",
            {"batch_size": 32},
            "dataset-123",
            datetime.utcnow(),
            None,
            None,
            None,
            0,
            0,
            0,
            0,
            None,
            None,
            None,
            None,
            {},
        )

        pipeline = FineTuningPipeline(db_url)

        # Create job
        job_id = pipeline.create_job(
            base_model="bert-base-uncased",
            dataset_id="dataset-123",
            training_config=training_config,
        )

        # Update status
        pipeline.update_job_status(job_id, JobStatus.RUNNING)

        # Record metrics
        metric = TrainingMetrics(
            step=100,
            epoch=1,
            loss=0.5,
            learning_rate=0.0001,
            samples_processed=3200,
            throughput=100.0,
        )
        pipeline.record_metric(job_id, metric)

        assert mock_cursor.execute.call_count >= 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
