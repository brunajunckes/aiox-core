# Squad 4: Quick Reference Guide

## 🚀 Quick Start

### Start a Fine-Tuning Job
```bash
curl -X POST http://localhost:8080/api/v1/models/fine-tune \
  -H "Content-Type: application/json" \
  -d '{
    "base_model": "bert-base-uncased",
    "dataset_id": "my-dataset-123",
    "learning_rate": 0.0001,
    "batch_size": 32,
    "num_epochs": 3
  }'
```

Response: `{"job_id": "abc-123", "status": "pending", ...}`

### Monitor Training
```bash
curl http://localhost:8080/api/v1/models/jobs/abc-123
```

### Deploy Best Model
```bash
# Get best model
curl "http://localhost:8080/api/v1/models?base_model=bert-base-uncased&status=ready" \
  | jq '.models[0].model_id'

# Deploy
curl -X POST http://localhost:8080/api/v1/models/{model_id}/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "production",
    "endpoint": "https://api.example.com/model"
  }'
```

## 📚 Core Classes

### FineTuningPipeline
```python
from autoflow.ml.fine_tuning import FineTuningPipeline, TrainingConfig

pipeline = FineTuningPipeline(db_url="postgresql://...")

config = TrainingConfig(
    base_model="bert-base-uncased",
    learning_rate=0.0001,
    batch_size=32,
    num_epochs=3,
)

job_id = pipeline.create_job(
    base_model="bert-base-uncased",
    dataset_id="dataset-123",
    training_config=config
)

job = pipeline.get_job(job_id)
print(job.status)  # pending, running, completed, failed
```

### ModelRegistry
```python
from autoflow.ml.model_registry import ModelRegistry

registry = ModelRegistry(db_url="postgresql://...")

# Register a trained model
model_id = registry.register_model(
    base_model="bert-base-uncased",
    job_id="job-123",
    checkpoint_path="/path/to/model.pt",
    metrics={"accuracy": 0.92, "f1": 0.91},
    parameters={"hidden_size": 768}
)

# Get best model
best = registry.get_best_model("bert-base-uncased", metric="accuracy")

# Deploy
deployment_id = registry.deploy_model(
    model_id=model_id,
    environment="production"
)

# Rollback
registry.rollback_deployment(deployment_id, "previous-model-id")
```

### TrainingOrchestrator
```python
from autoflow.ml.training import PyTorchTrainingOrchestrator

orchestrator = PyTorchTrainingOrchestrator(db_url)

# Allocate GPUs
resources = orchestrator.allocate_resources(
    distributed=True,
    num_gpus=4,
    required_memory_gb=2.0
)

# Run training
results = orchestrator.run_training(
    job_id="job-123",
    config=training_config.to_dict(),
    data_paths={"train": "...", "val": "..."}
)
```

## 🗄️ Database Tables

```sql
-- Fine-tuning jobs
SELECT * FROM fine_tune_jobs WHERE status = 'running';

-- Training metrics
SELECT step, loss, eval_accuracy FROM training_metrics 
WHERE job_id = 'job-123' ORDER BY step DESC;

-- Model versions
SELECT model_id, version, metrics FROM models 
WHERE base_model = 'bert-base-uncased' ORDER BY created_at DESC;

-- Deployments
SELECT * FROM model_deployments 
WHERE environment = 'production' AND status = 'active';
```

## 🔧 Configuration

### Environment Variables
```bash
export TRAINING_BATCH_SIZE=32
export TRAINING_NUM_EPOCHS=3
export TRAINING_LEARNING_RATE=0.0001
export CUDA_VISIBLE_DEVICES=0,1,2,3
export CHECKPOINT_DIR=/checkpoints
```

### Training Config
```python
TrainingConfig(
    base_model="bert-base-uncased",
    learning_rate=0.0001,          # 1e-4 to 1e-5 typical
    batch_size=32,                  # 16, 32, 64 typical
    num_epochs=3,                   # 2-5 typical
    warmup_steps=500,               # 10% of total steps
    weight_decay=0.01,              # L2 regularization
    max_grad_norm=1.0,              # Clip gradients
    eval_steps=100,                 # Evaluate every N steps
    save_steps=500,                 # Save checkpoint every N steps
    use_amp=True,                   # Mixed precision (faster)
    freeze_layers=["embeddings"],   # Freeze some layers
)
```

## 📊 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/models/fine-tune` | Start fine-tuning job |
| GET | `/models/jobs/{id}` | Get job status |
| GET | `/models/jobs` | List all jobs |
| GET | `/models` | List models |
| POST | `/models/register` | Register model manually |
| POST | `/models/{id}/deploy` | Deploy to environment |
| POST | `/models/{id}/rollback` | Rollback deployment |
| DELETE | `/models/{id}` | Archive model |
| GET | `/models/{id}/performance` | Get metrics |

## 🐳 Kubernetes

### Deploy Single GPU Job
```bash
kubectl create -f k8s/training-job.yml -n autoflow
```

### Monitor
```bash
kubectl get jobs -n autoflow
kubectl logs job/model-fine-tune-<job-id> -n autoflow
kubectl describe job/model-fine-tune-<job-id> -n autoflow
```

### Cleanup
```bash
kubectl delete job model-fine-tune-<job-id> -n autoflow
```

## 🧪 Testing

```bash
# Run all tests
pytest tests/test_fine_tuning.py tests/test_model_registry.py tests/test_models_api.py -v

# With coverage
pytest tests/test_*.py --cov=autoflow.ml --cov=autoflow.api.models -v

# Specific test
pytest tests/test_fine_tuning.py::TestFineTuningPipeline::test_create_job -v
```

## 🐛 Troubleshooting

### GPU Not Found
```python
from autoflow.ml.training import GPUManager

gpus = GPUManager.detect_gpus()
print(f"Available GPUs: {len(gpus)}")
for gpu in gpus:
    print(f"  GPU {gpu.gpu_id}: {gpu.name}, {gpu.free_memory}GB free")
```

### Job Stuck in Pending
```python
job = pipeline.get_job(job_id)
print(f"Status: {job.status}")
print(f"Error: {job.error_message}")

# Update status
pipeline.update_job_status(job_id, JobStatus.RUNNING)
```

### Out of Memory
```python
# Reduce batch size
config = TrainingConfig(batch_size=16)  # Was 32

# Or use gradient accumulation
config = TrainingConfig(
    batch_size=8,
    gradient_accumulation_steps=4  # Effective batch: 32
)

# Or enable AMP
config = TrainingConfig(use_amp=True)
```

## 📈 Monitoring

### Training Metrics
```python
metrics, total = pipeline.get_metrics(job_id, limit=100)

for metric in metrics:
    print(f"Step {metric.step}: loss={metric.loss:.4f}, "
          f"acc={metric.eval_accuracy:.4f}")
```

### Model Performance
```python
perf_history = registry.get_performance_history(model_id)

for perf in perf_history:
    print(f"{perf.timestamp}: accuracy={perf.accuracy}, "
          f"latency={perf.inference_latency_ms}ms")
```

## 🚀 Production Deployment

### 1. Train Model
```bash
curl -X POST http://api.example.com/models/fine-tune \
  -d '{...training config...}'
```

### 2. Monitor Training
```bash
watch 'curl http://api.example.com/models/jobs/{job_id} | jq'
```

### 3. Register & Deploy
```bash
# Model auto-registers when job completes
curl -X POST http://api.example.com/models/{model_id}/deploy \
  -d '{"environment": "production"}'
```

### 4. Monitor Deployment
```bash
curl http://api.example.com/models/{model_id}/performance
```

### 5. Rollback if Needed
```bash
curl -X POST http://api.example.com/models/{deployment_id}/rollback \
  -d '{"rollback_to_model_id": "previous-model"}'
```

## 📝 Common Patterns

### Train and Deploy
```python
# 1. Create job
job_id = pipeline.create_job(...)

# 2. Monitor until complete
while True:
    job = pipeline.get_job(job_id)
    if job.status == JobStatus.COMPLETED:
        break
    time.sleep(10)

# 3. Register and deploy
model_id = registry.register_model(
    base_model=job.base_model,
    job_id=job.job_id,
    checkpoint_path=job.model_checkpoint_path,
    metrics=job.to_dict()
)

registry.deploy_model(
    model_id=model_id,
    environment="production"
)
```

### Compare Models
```python
models = registry.list_models(
    base_model="bert-base-uncased",
    status=ModelStatus.READY
)

for model in models:
    print(f"{model.version}: "
          f"accuracy={model.metrics.get('accuracy')}")
```

### A/B Testing
```python
# Deploy model A
deployment_a = registry.deploy_model(
    model_id="model-a",
    environment="production"
)

# Deploy model B
deployment_b = registry.deploy_model(
    model_id="model-b",
    environment="production"
)

# Route traffic: 50% to A, 50% to B
# Monitor metrics...

# Scale winner
registry.rollback_deployment(deployment_b.id, deployment_a.model_id)
```

## 🎯 Next Steps

1. **Install Dependencies**: `pip install -r requirements.txt`
2. **Setup Database**: `psql -U postgres -d autoflow -f schema.sql`
3. **Start API**: `python -m uvicorn autoflow.api.server:app --reload`
4. **Create Job**: POST to `/models/fine-tune`
5. **Monitor**: GET `/models/jobs/{id}`
6. **Deploy**: POST to `/models/{id}/deploy`

---

For full documentation, see [SQUAD_4_FINE_TUNING.md](./SQUAD_4_FINE_TUNING.md)
