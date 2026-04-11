"""Training orchestration module.

Features:
- Training loop management
- GPU resource allocation
- Distributed training support
- Training interruption handling
- Model versioning
"""

import os
import logging
import json
from datetime import datetime
from typing import Optional, Dict, Any, Callable, List
from abc import ABC, abstractmethod
from pathlib import Path
from dataclasses import dataclass
import subprocess
import signal
import time

import psycopg
from pydantic import BaseModel

logger = logging.getLogger(__name__)


@dataclass
class GPUResource:
    """GPU resource information."""
    gpu_id: int
    name: str
    total_memory: float  # GB
    free_memory: float  # GB
    utilization: float  # 0-100
    temperature: float  # Celsius

    @property
    def available_memory(self) -> float:
        """Available memory in GB."""
        return self.free_memory

    @property
    def is_available(self) -> bool:
        """Check if GPU is available for training."""
        return self.utilization < 80 and self.free_memory > 2  # At least 2GB free


class GPUManager:
    """GPU resource manager."""

    @staticmethod
    def detect_gpus() -> List[GPUResource]:
        """Detect available GPUs.

        Returns:
            List of GPU resources
        """
        gpus = []

        try:
            # Try to detect NVIDIA GPUs
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=index,name,memory.total,memory.free,utilization.gpu,temperature.gpu",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=5,
            )

            if result.returncode == 0:
                for line in result.stdout.strip().split("\n"):
                    if not line:
                        continue
                    parts = [p.strip() for p in line.split(",")]
                    gpus.append(GPUResource(
                        gpu_id=int(parts[0]),
                        name=parts[1],
                        total_memory=float(parts[2]),
                        free_memory=float(parts[3]),
                        utilization=float(parts[4]),
                        temperature=float(parts[5]),
                    ))
        except (FileNotFoundError, subprocess.TimeoutExpired, Exception) as e:
            logger.warning(f"Could not detect GPUs: {e}")

        return gpus

    @staticmethod
    def allocate_gpu(required_memory_gb: float = 2.0) -> Optional[GPUResource]:
        """Allocate a GPU with sufficient free memory.

        Args:
            required_memory_gb: Required free memory in GB

        Returns:
            GPU resource or None if not available
        """
        gpus = GPUManager.detect_gpus()

        # Find best available GPU (most free memory)
        available = [
            gpu for gpu in gpus
            if gpu.free_memory >= required_memory_gb and gpu.is_available
        ]

        if available:
            best_gpu = max(available, key=lambda g: g.free_memory)
            logger.info(f"Allocated GPU {best_gpu.gpu_id} ({best_gpu.name})")
            return best_gpu

        logger.warning(f"No GPU available with {required_memory_gb}GB free memory")
        return None


@dataclass
class TrainingState:
    """Training state for resumption."""
    job_id: str
    model_path: str
    optimizer_state: Dict[str, Any]
    current_epoch: int
    current_step: int
    best_loss: float
    timestamp: datetime


class TrainingOrchestrator(ABC):
    """Abstract base class for training orchestration."""

    def __init__(self, db_url: str, checkpoint_dir: str = "/tmp/checkpoints"):
        """Initialize orchestrator.

        Args:
            db_url: PostgreSQL connection string
            checkpoint_dir: Directory for saving checkpoints
        """
        self.db_url = db_url
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self._training_process: Optional[subprocess.Popen] = None
        self._interrupted = False

    @abstractmethod
    def prepare_training_data(
        self,
        dataset_id: str,
        output_dir: str,
    ) -> Dict[str, str]:
        """Prepare training data.

        Args:
            dataset_id: Training dataset ID
            output_dir: Output directory for prepared data

        Returns:
            Dictionary with data paths (train, val, test)
        """
        pass

    @abstractmethod
    def run_training(
        self,
        job_id: str,
        config: Dict[str, Any],
        data_paths: Dict[str, str],
        on_progress: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_checkpoint: Optional[Callable[[str], None]] = None,
    ) -> Dict[str, Any]:
        """Run training loop.

        Args:
            job_id: Job ID
            config: Training configuration
            data_paths: Paths to training data
            on_progress: Callback for progress updates
            on_checkpoint: Callback for checkpoint saving

        Returns:
            Training results dictionary
        """
        pass

    def setup_signal_handlers(self) -> None:
        """Setup signal handlers for graceful interruption."""

        def handle_interrupt(signum, frame):
            logger.info("Received interrupt signal, stopping training gracefully...")
            self._interrupted = True
            if self._training_process:
                self._training_process.terminate()

        signal.signal(signal.SIGINT, handle_interrupt)
        signal.signal(signal.SIGTERM, handle_interrupt)

    def save_training_state(
        self,
        job_id: str,
        model_path: str,
        optimizer_state: Dict[str, Any],
        current_epoch: int,
        current_step: int,
        best_loss: float,
    ) -> str:
        """Save training state for resumption.

        Args:
            job_id: Job ID
            model_path: Path to model checkpoint
            optimizer_state: Optimizer state
            current_epoch: Current epoch
            current_step: Current step
            best_loss: Best loss so far

        Returns:
            Path to saved state
        """
        state = TrainingState(
            job_id=job_id,
            model_path=model_path,
            optimizer_state=optimizer_state,
            current_epoch=current_epoch,
            current_step=current_step,
            best_loss=best_loss,
            timestamp=datetime.utcnow(),
        )

        state_path = self.checkpoint_dir / f"{job_id}_state.json"
        with open(state_path, "w") as f:
            json.dump({
                "job_id": state.job_id,
                "model_path": state.model_path,
                "optimizer_state": state.optimizer_state,
                "current_epoch": state.current_epoch,
                "current_step": state.current_step,
                "best_loss": state.best_loss,
                "timestamp": state.timestamp.isoformat(),
            }, f)

        logger.info(f"Saved training state to {state_path}")
        return str(state_path)

    def load_training_state(self, job_id: str) -> Optional[TrainingState]:
        """Load training state.

        Args:
            job_id: Job ID

        Returns:
            TrainingState or None if not found
        """
        state_path = self.checkpoint_dir / f"{job_id}_state.json"
        if not state_path.exists():
            return None

        try:
            with open(state_path, "r") as f:
                data = json.load(f)

            return TrainingState(
                job_id=data["job_id"],
                model_path=data["model_path"],
                optimizer_state=data["optimizer_state"],
                current_epoch=data["current_epoch"],
                current_step=data["current_step"],
                best_loss=data["best_loss"],
                timestamp=datetime.fromisoformat(data["timestamp"]),
            )
        except Exception as e:
            logger.error(f"Failed to load training state: {e}")
            return None

    def allocate_resources(
        self,
        distributed: bool = False,
        num_gpus: int = 1,
        required_memory_gb: float = 2.0,
    ) -> Dict[str, Any]:
        """Allocate training resources.

        Args:
            distributed: Whether to use distributed training
            num_gpus: Number of GPUs to use
            required_memory_gb: Required memory per GPU

        Returns:
            Resource allocation details
        """
        allocation = {
            "distributed": distributed,
            "num_gpus": 0,
            "gpus": [],
            "cuda_visible_devices": "",
        }

        if distributed or num_gpus > 0:
            gpus = GPUManager.detect_gpus()
            logger.info(f"Detected {len(gpus)} GPUs")

            # Allocate GPUs
            allocated = []
            for gpu in gpus:
                if len(allocated) >= num_gpus:
                    break
                if gpu.free_memory >= required_memory_gb and gpu.is_available:
                    allocated.append(gpu)

            if allocated:
                allocation["num_gpus"] = len(allocated)
                allocation["gpus"] = [
                    {
                        "id": gpu.gpu_id,
                        "name": gpu.name,
                        "free_memory": gpu.free_memory,
                    }
                    for gpu in allocated
                ]
                allocation["cuda_visible_devices"] = ",".join(
                    str(gpu.gpu_id) for gpu in allocated
                )

                logger.info(f"Allocated {len(allocated)} GPUs: {allocation['cuda_visible_devices']}")

        return allocation

    def should_stop_training(self) -> bool:
        """Check if training should be stopped.

        Returns:
            True if training should stop
        """
        return self._interrupted or (
            self._training_process and self._training_process.poll() is not None
        )

    def cleanup(self) -> None:
        """Cleanup training resources."""
        if self._training_process:
            self._training_process.terminate()
            try:
                self._training_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._training_process.kill()

        logger.info("Training orchestrator cleanup complete")


class PyTorchTrainingOrchestrator(TrainingOrchestrator):
    """PyTorch training orchestrator."""

    def prepare_training_data(
        self,
        dataset_id: str,
        output_dir: str,
    ) -> Dict[str, str]:
        """Prepare training data.

        Args:
            dataset_id: Training dataset ID
            output_dir: Output directory

        Returns:
            Dictionary with data paths
        """
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        # In real implementation, this would load data from database
        # and prepare it for training
        logger.info(f"Prepared training data from dataset {dataset_id}")

        return {
            "train": os.path.join(output_dir, "train.jsonl"),
            "val": os.path.join(output_dir, "val.jsonl"),
            "test": os.path.join(output_dir, "test.jsonl"),
        }

    def run_training(
        self,
        job_id: str,
        config: Dict[str, Any],
        data_paths: Dict[str, str],
        on_progress: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_checkpoint: Optional[Callable[[str], None]] = None,
    ) -> Dict[str, Any]:
        """Run PyTorch training.

        Args:
            job_id: Job ID
            config: Training configuration
            data_paths: Paths to training data
            on_progress: Progress callback
            on_checkpoint: Checkpoint callback

        Returns:
            Training results
        """
        self.setup_signal_handlers()

        # Allocate resources
        resources = self.allocate_resources(
            distributed=config.get("distributed", False),
            num_gpus=config.get("num_gpus", 1),
        )

        # Set CUDA environment
        if resources["cuda_visible_devices"]:
            os.environ["CUDA_VISIBLE_DEVICES"] = resources["cuda_visible_devices"]

        # Create training script
        training_script = self._create_training_script(
            job_id=job_id,
            config=config,
            data_paths=data_paths,
        )

        # Run training
        env = os.environ.copy()
        env["CUDA_VISIBLE_DEVICES"] = resources["cuda_visible_devices"]

        try:
            self._training_process = subprocess.Popen(
                ["python", training_script],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            # Monitor training
            results = self._monitor_training(
                job_id=job_id,
                on_progress=on_progress,
                on_checkpoint=on_checkpoint,
            )

            return results

        finally:
            self.cleanup()

    def _create_training_script(
        self,
        job_id: str,
        config: Dict[str, Any],
        data_paths: Dict[str, str],
    ) -> str:
        """Create training script.

        Args:
            job_id: Job ID
            config: Training configuration
            data_paths: Data paths

        Returns:
            Path to training script
        """
        script_path = self.checkpoint_dir / f"{job_id}_train.py"

        script = f'''
import json
import torch

# Training configuration
config = {json.dumps(config)}
data_paths = {json.dumps(data_paths)}

# Mock training loop
print(f"Starting training for {{config['base_model']}}")
print(f"Batch size: {{config['batch_size']}}")
print(f"Epochs: {{config['num_epochs']}}")

for epoch in range(config['num_epochs']):
    for step in range(10):
        loss = 1.0 - (epoch * 10 + step) * 0.001
        print(f"Epoch {{epoch}} Step {{step}} Loss {{loss:.4f}}")

print("Training complete")
'''

        with open(script_path, "w") as f:
            f.write(script)

        return str(script_path)

    def _monitor_training(
        self,
        job_id: str,
        on_progress: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_checkpoint: Optional[Callable[[str], None]] = None,
    ) -> Dict[str, Any]:
        """Monitor training process.

        Args:
            job_id: Job ID
            on_progress: Progress callback
            on_checkpoint: Checkpoint callback

        Returns:
            Training results
        """
        results = {
            "job_id": job_id,
            "status": "completed",
            "final_loss": 0.0,
            "checkpoints": [],
        }

        if self._training_process:
            stdout, stderr = self._training_process.communicate()

            if self._training_process.returncode != 0:
                results["status"] = "failed"
                results["error"] = stderr

            # Parse training output and update results
            logger.info(f"Training process exited with code {self._training_process.returncode}")

        return results
