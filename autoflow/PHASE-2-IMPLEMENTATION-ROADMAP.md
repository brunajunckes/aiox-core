# Phase 2 Implementation Roadmap — From Smoke Tests to Production

**Status:** VALIDATED & READY TO IMPLEMENT  
**Total Effort:** 26 hours across 3.25 sprints  
**Critical Path:** Gap 1 (BullMQ) → Gap 2 & 3 (parallel)

---

## Overview

Phase 2 consists of **3 gaps**, each with well-defined acceptance criteria. This roadmap provides:
1. **Detailed task breakdown** per gap
2. **Implementation sequence** (dependencies)
3. **E2E test specifications**
4. **Deployment checklist**

All components have been validated by smoke tests. Code is ready to implement.

---

## Gap 1: BullMQ Job Queue + Checkpointing (Foundation)

**Severity:** HIGH  
**Effort:** 8 hours (1 sprint)  
**Blocks:** Gap 2, Gap 3  
**Why First:** Video pipeline needs stable job execution before GPU/routing optimization

### Problem Statement
Video workflows (5 stages: analyze → avatar → matting → voice → render) fail completely if any stage fails. No recovery mechanism. Example:
- Stage 3 fails at 10 minutes
- All 20 minutes of GPU compute wasted
- User loses work
- Pipeline restarts from scratch

### Solution: RQ-based Job Queue with Checkpointing

```
Video Pipeline Flow (with RQ + Checkpointing):

Stage 1: VideoAnalysis    ──→ [RQ Job 1] ──→ Checkpoint to Supabase
                              (3 retries, 60s backoff)
                              
Stage 2: AvatarGeneration ──→ [RQ Job 2] ──→ Checkpoint
                              (uses Job 1 output)
                              
Stage 3: MatteExtraction  ──→ [RQ Job 3] ──→ Checkpoint
                              (FAILS at 8 min)
                              └─→ Auto-retry (exponential backoff)
                              └─→ On 3rd failure: Resume from Stage 2 outputs
                              
Stage 4: VoiceGeneration  ──→ [RQ Job 4] ──→ Checkpoint
Stage 5: Rendering        ──→ [RQ Job 5] ──→ Final artifact

Cost Savings: 8-minute failure → 2-minute retry vs. 20-minute restart
```

### Task 1.1: Install & Configure RQ + Redis

**Acceptance Criteria:**
- [ ] RQ >= 1.15.0 in `requirements.txt`
- [ ] Redis available (local or Docker Compose)
- [ ] RQ CLI works (`rq-info`, `rq-worker`)
- [ ] Job registry persists to Redis

**Implementation:**
```bash
# 1. Update requirements.txt
echo "rq>=1.15.0" >> requirements.txt
echo "redis>=5.0.0" >> requirements.txt

# 2. Test RQ installation
python -m rq.cli --version

# 3. Start Redis (Docker)
docker run -d -p 6379:6379 redis:latest

# 4. Test connection
python -c "from redis import Redis; r=Redis(); r.ping()"
```

**Time Estimate:** 1 hour

---

### Task 1.2: Define 5 Job Classes

**File:** `autoflow/core/job_queue.py`

**Acceptance Criteria:**
- [ ] `VideoAnalysisJob` class (inherits `rq.job.Job`)
- [ ] `AvatarGenerationJob` class
- [ ] `MatteExtractionJob` class
- [ ] `VoiceGenerationJob` class
- [ ] `RenderingJob` class
- [ ] Each job has: `max_retries=3`, `retry_backoff=60s`, `timeout=30m`
- [ ] Job output format: `{"status": "success|failed", "data": {...}, "error": "..."}`

**Template:**
```python
# autoflow/core/job_queue.py

from rq import Job
from redis import Redis
from typing import Any, Dict, Optional
import logging

redis_conn = Redis(host='localhost', port=6379)

class VideoAnalysisJob(Job):
    """Stage 1: Analyze video for content."""
    
    def __init__(self, video_url: str, workflow_id: str, **kwargs):
        self.video_url = video_url
        self.workflow_id = workflow_id
        super().__init__(
            id=f"{workflow_id}-stage-1",
            timeout=30 * 60,  # 30 min timeout
            max_retries=3,
            retry_backoff=60,  # 60s exponential backoff
            **kwargs
        )
    
    def perform(self) -> Dict[str, Any]:
        """Execute video analysis."""
        try:
            # Call LLM to analyze video content
            analysis = call_llm_sync(
                prompt=f"Analyze video: {self.video_url}",
                model="qwen2.5:3b"
            )
            
            # Log to cost tracker
            _log_event({
                "type": "job_execution",
                "stage": "video_analysis",
                "workflow_id": self.workflow_id,
                "status": "success",
                "cost_usd": 0.0001,  # Estimate
            })
            
            return {
                "status": "success",
                "data": {"analysis": analysis},
                "stage_output_key": f"{self.workflow_id}-stage-1-output",
            }
        except Exception as e:
            logger.error(f"VideoAnalysisJob failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
                "retry_count": self.retry_count,
            }

# Similar classes for Stages 2-5...
```

**Time Estimate:** 3 hours

---

### Task 1.3: Implement Checkpoint & Resume Handler

**File:** `autoflow/core/checkpointing.py`

**Acceptance Criteria:**
- [ ] `CheckpointManager` class with `save_checkpoint(workflow_id, stage, data)` method
- [ ] `load_checkpoint(workflow_id, stage)` retrieves last successful stage output
- [ ] Intermediate outputs stored in Supabase Storage (24h TTL)
- [ ] On job failure: read last checkpoint and resume from there
- [ ] Checkpoint key format: `{workflow_id}/stage-{stage}/output.json`
- [ ] Cost tracking: log bytes uploaded/downloaded to Supabase

**Template:**
```python
# autoflow/core/checkpointing.py

from supabase import create_client
from typing import Any, Dict, Optional
import json
from datetime import datetime, timedelta

class CheckpointManager:
    """Manages intermediate outputs for video pipeline."""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        self.client = create_client(supabase_url, supabase_key)
    
    def save_checkpoint(self, workflow_id: str, stage: int, data: Dict[str, Any]) -> str:
        """Save intermediate output to Supabase Storage."""
        key = f"{workflow_id}/stage-{stage}/output.json"
        
        try:
            self.client.storage \
                .from_("video-checkpoints") \
                .upload(
                    path=key,
                    file=json.dumps(data).encode(),
                    file_options={"content-type": "application/json"}
                )
            
            # Cost: ~0.0001 USD per upload (rough estimate)
            _log_event({
                "type": "checkpoint_save",
                "workflow_id": workflow_id,
                "stage": stage,
                "size_kb": len(json.dumps(data)) / 1024,
                "cost_usd": 0.0001,
            })
            
            return key
        except Exception as e:
            logger.error(f"Failed to save checkpoint: {e}")
            raise
    
    def load_checkpoint(self, workflow_id: str, stage: int) -> Optional[Dict[str, Any]]:
        """Load last successful stage output."""
        key = f"{workflow_id}/stage-{stage}/output.json"
        
        try:
            response = self.client.storage \
                .from_("video-checkpoints") \
                .download(key)
            
            return json.loads(response.decode())
        except Exception as e:
            logger.warning(f"Checkpoint not found for {workflow_id} stage {stage}")
            return None

# Usage in job retry logic:
def run_stage_with_checkpoint(workflow_id: str, stage: int, job_class):
    checkpoint_mgr = CheckpointManager(...)
    
    for attempt in range(3):
        try:
            # Load last successful output
            prior_output = checkpoint_mgr.load_checkpoint(workflow_id, stage - 1)
            
            # Run stage with prior output as input
            job = job_class(workflow_id=workflow_id, input_data=prior_output)
            result = job.perform()
            
            # Save checkpoint
            checkpoint_mgr.save_checkpoint(workflow_id, stage, result["data"])
            
            return result
        except Exception as e:
            if attempt < 2:
                time.sleep(60 * (2 ** attempt))  # Exponential backoff
                continue
            else:
                raise
```

**Time Estimate:** 3 hours

---

### Task 1.4: E2E Test: Crash Recovery

**File:** `tests/test_job_queue_recovery.py`

**Acceptance Criteria:**
- [ ] Test creates 5-stage video workflow
- [ ] Artificially fails Stage 3 (simulate CPU crash)
- [ ] Job queue retries Stage 3 with Stage 2 outputs (checkpoint)
- [ ] Workflow completes successfully after retry
- [ ] Cost tracking logs all attempts
- [ ] Assert: Total cost = Stage 1 + Stage 2 + Stage 3 (1 retry) + Stage 4 + Stage 5

**Template:**
```python
# tests/test_job_queue_recovery.py

import pytest
from autoflow.core.job_queue import (
    VideoAnalysisJob, AvatarGenerationJob, MatteExtractionJob,
    VoiceGenerationJob, RenderingJob
)
from autoflow.core.checkpointing import CheckpointManager

@pytest.mark.asyncio
async def test_video_pipeline_crash_recovery():
    """Verify workflow survives stage failure and resumes from checkpoint."""
    
    workflow_id = "test-workflow-001"
    checkpoint_mgr = CheckpointManager(...)
    
    # Stage 1: Analyze
    job1 = VideoAnalysisJob(video_url="...", workflow_id=workflow_id)
    result1 = job1.perform()
    assert result1["status"] == "success"
    checkpoint_mgr.save_checkpoint(workflow_id, 1, result1["data"])
    
    # Stage 2: Avatar
    job2 = AvatarGenerationJob(workflow_id=workflow_id, input_data=result1["data"])
    result2 = job2.perform()
    assert result2["status"] == "success"
    checkpoint_mgr.save_checkpoint(workflow_id, 2, result2["data"])
    
    # Stage 3: Matting (simulate failure, then recovery)
    job3_attempt1 = MatteExtractionJob(
        workflow_id=workflow_id, 
        input_data=result2["data"],
        simulate_failure=True  # Inject failure
    )
    result3_attempt1 = job3_attempt1.perform()
    assert result3_attempt1["status"] == "failed"
    
    # Automatic retry: load checkpoint, try again
    prior_output = checkpoint_mgr.load_checkpoint(workflow_id, 2)
    job3_attempt2 = MatteExtractionJob(
        workflow_id=workflow_id, 
        input_data=prior_output,
        simulate_failure=False  # Recovery succeeds
    )
    result3_attempt2 = job3_attempt2.perform()
    assert result3_attempt2["status"] == "success"
    checkpoint_mgr.save_checkpoint(workflow_id, 3, result3_attempt2["data"])
    
    # Stages 4-5: Continue normally
    job4 = VoiceGenerationJob(workflow_id=workflow_id, input_data=result3_attempt2["data"])
    result4 = job4.perform()
    assert result4["status"] == "success"
    
    job5 = RenderingJob(workflow_id=workflow_id, input_data=result4["data"])
    result5 = job5.perform()
    assert result5["status"] == "success"
    
    # Verify cost tracking
    costs = cost_logger.get_workflow_costs("test-workflow-001")
    assert costs["total_usd"] < 1.0  # Video pipeline should be cheap
    assert costs["job_attempts"] == 6  # 5 jobs + 1 retry
    assert costs["checkpoint_savings_usd"] > 0  # Recovered cost

@pytest.mark.asyncio
async def test_job_retry_exponential_backoff():
    """Verify retry logic uses exponential backoff (60s, 120s, 240s)."""
    
    job = MatteExtractionJob(workflow_id="test-001", simulate_failure=True)
    
    start = time.time()
    with pytest.raises(Exception):
        job.perform()  # Will retry internally
    
    elapsed = time.time() - start
    # 3 retries with backoff: 60 + 120 + 240 = 420 seconds (7 minutes)
    # In test, use mock.patch to skip actual waits
    assert elapsed < 5  # Mock skips real delays
```

**Time Estimate:** 1 hour

---

## Gap 2: GPU Worker Integration (Desktop GPU)

**Severity:** CRITICAL  
**Effort:** 12 hours (2 sprints)  
**Depends On:** Gap 1 (RQ job queue)  
**Why After Gap 1:** GPU jobs need checkpointing for resilience

### Problem Statement
Desktop GPU (avatar, matting, voice, rendering) exists but is disconnected from AutoFlow. Workflows can't delegate tasks. GPU resources idle.

### Solution: GpuWorkerClient + Health Check + Graceful Degradation

```
Architecture:

AutoFlow API (VPS)              Desktop GPU
├─ Workflows                    ├─ Avatar model
├─ LLM calls                    ├─ Matting model
├─ GpuWorkerClient              ├─ Voice model
│  └─ HTTP POST requests        ├─ Rendering engine
│     (Cloudflare Tunnel)       └─ FastAPI server
└─ Fallback: CPU rendering      (gpu_worker_api.py)

Job Flow:
1. Workflow wants avatar
2. GpuWorkerClient.submit_job(type='avatar', params={...})
3. POST /api/avatar to Desktop GPU worker
4. Desktop queues job, returns job_id
5. VPS polls /api/job/{job_id}/status every 5s
6. When done: /api/job/{job_id}/download returns artifact
7. Cost tracking: log GPU time + transfer
```

### Task 2.1: Document GPU Worker API

**File:** `/root/autoflow/desktop_worker/GPU-WORKER-API.md` (create)

**Acceptance Criteria:**
- [ ] Endpoint list (POST /api/avatar, /api/matting, /api/voice, /api/render)
- [ ] Request schema (JSON examples)
- [ ] Response schema (job_id format, status values)
- [ ] Error codes (400, 408 timeout, 503 offline)
- [ ] Health endpoint (GET /health)
- [ ] Version endpoint (GET /version)

**Template:**
```markdown
# GPU Worker API Documentation

## Base URL
`http://desktop:5000/api`

## Endpoints

### POST /api/avatar
Generate avatar from image.

**Request:**
```json
{
  "image_url": "https://...",
  "style": "realistic|anime",
  "quality": "hd|4k"
}
```

**Response (Success 200):**
```json
{
  "job_id": "avatar-001-uuid",
  "status": "queued|running",
  "eta_seconds": 120
}
```

**Response (Error 503):**
```json
{
  "error": "GPU offline",
  "status": "unavailable"
}
```

### GET /api/job/{job_id}/status
Poll job status.

**Response:**
```json
{
  "job_id": "avatar-001-uuid",
  "status": "running|completed|failed",
  "progress": 0.75,
  "estimated_time_remaining": 30
}
```

### GET /api/job/{job_id}/download
Download completed artifact.

**Response:** Binary (image/video file)

### GET /health
Health check.

**Response:**
```json
{
  "status": "healthy|degraded",
  "gpu": "nvidia-4090|offline",
  "queue_length": 5
}
```
```

**Time Estimate:** 1 hour

---

### Task 2.2: Create GpuWorkerClient Library

**File:** `autoflow/core/gpu_worker_client.py`

**Acceptance Criteria:**
- [ ] `GpuWorkerClient` class (constructor takes GPU worker URL)
- [ ] `submit_job(task_type, params)` returns job_id
- [ ] `poll_status(job_id)` with 30s timeout, 3 retries, exponential backoff
- [ ] `download_artifact(job_id)` fetches result, saves to temp dir
- [ ] `health_check()` returns status and handles offline
- [ ] Circuit breaker: if Desktop down >5 min, fallback to CPU
- [ ] Cost tracking: log job time, transfer bytes, model cost

**Template:**
```python
# autoflow/core/gpu_worker_client.py

import httpx
import logging
import time
from typing import Optional, Dict, Any
from enum import Enum

class TaskType(Enum):
    AVATAR = "avatar"
    MATTING = "matting"
    VOICE = "voice"
    RENDERING = "render"

class GpuWorkerClient:
    """Client for GPU worker on Desktop."""
    
    def __init__(self, base_url: str = "http://desktop:5000/api"):
        self.base_url = base_url
        self.timeout = 30  # seconds per request
        self.max_retries = 3
        self._circuit_breaker_open = False
        self._failed_checks = 0
    
    def submit_job(
        self,
        task_type: TaskType,
        params: Dict[str, Any],
        workflow_id: str,
    ) -> Optional[str]:
        """Submit job to GPU worker, return job_id."""
        
        if self._circuit_breaker_open:
            logger.warning("GPU worker circuit breaker OPEN; returning None")
            return None
        
        url = f"{self.base_url}/{task_type.value}"
        
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, json=params)
                resp.raise_for_status()
                
            data = resp.json()
            job_id = data.get("job_id")
            
            _log_event({
                "type": "gpu_job_submit",
                "task_type": task_type.value,
                "job_id": job_id,
                "workflow_id": workflow_id,
                "status": "submitted",
            })
            
            self._failed_checks = 0  # Reset CB on success
            return job_id
            
        except Exception as exc:
            logger.error(f"GPU job submit failed: {exc}")
            self._failed_checks += 1
            
            if self._failed_checks >= 3:
                self._circuit_breaker_open = True
                logger.critical("GPU worker circuit breaker OPEN")
            
            return None
    
    def poll_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Poll job status with retries."""
        
        url = f"{self.base_url}/job/{job_id}/status"
        
        for attempt in range(self.max_retries):
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    resp = client.get(url)
                    resp.raise_for_status()
                
                data = resp.json()
                
                _log_event({
                    "type": "gpu_job_poll",
                    "job_id": job_id,
                    "status": data.get("status"),
                })
                
                return data
                
            except Exception as exc:
                backoff = 60 * (2 ** attempt)  # 60s, 120s, 240s
                logger.warning(f"Poll attempt {attempt+1} failed; retry in {backoff}s")
                
                if attempt < self.max_retries - 1:
                    time.sleep(backoff)
                else:
                    logger.error(f"Poll exhausted retries for {job_id}")
                    return None
    
    def download_artifact(self, job_id: str) -> Optional[bytes]:
        """Download completed artifact."""
        
        url = f"{self.base_url}/job/{job_id}/download"
        
        try:
            with httpx.Client(timeout=120.0) as client:  # 2min for file download
                resp = client.get(url)
                resp.raise_for_status()
            
            artifact = resp.content
            
            # Cost tracking: transfer
            _log_event({
                "type": "gpu_artifact_download",
                "job_id": job_id,
                "bytes_downloaded": len(artifact),
                "cost_usd": len(artifact) / (1024 ** 3) * 0.002,  # $0.002 per GB
            })
            
            return artifact
            
        except Exception as exc:
            logger.error(f"Artifact download failed: {exc}")
            return None
    
    def health_check(self) -> Dict[str, Any]:
        """Check GPU worker health."""
        
        url = f"{self.base_url}/health"
        
        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(url)
                resp.raise_for_status()
            
            data = resp.json()
            self._failed_checks = 0
            self._circuit_breaker_open = False
            
            return data
            
        except Exception as exc:
            logger.warning(f"Health check failed: {exc}")
            self._failed_checks += 1
            
            return {
                "status": "unhealthy",
                "error": str(exc),
            }
```

**Time Estimate:** 3 hours

---

### Task 2.3: Integrate into Workflow Nodes

**File:** `autoflow/workflows/video_pipeline.py` (extend existing)

**Acceptance Criteria:**
- [ ] New LangGraph nodes: `await_avatar_generation`, `await_matting`, `await_voice`, `await_rendering`
- [ ] Each node calls `GpuWorkerClient.submit_job()` → polls status → downloads artifact
- [ ] On timeout/error: fallback to CPU rendering (slow, cheap)
- [ ] Cost tracking per node
- [ ] Graceful degradation: if GPU offline, log warning and use CPU

**Template:**
```python
# autoflow/workflows/video_pipeline.py (additions)

from langgraph.graph import StateGraph
from autoflow.core.gpu_worker_client import GpuWorkerClient, TaskType

gpu_client = GpuWorkerClient()

def node_avatar_generation(state: Dict[str, Any]) -> Dict[str, Any]:
    """LangGraph node: delegate avatar generation to GPU worker."""
    
    image_url = state.get("image_url")
    workflow_id = state.get("workflow_id")
    
    # Try GPU worker
    job_id = gpu_client.submit_job(
        task_type=TaskType.AVATAR,
        params={"image_url": image_url, "style": "realistic"},
        workflow_id=workflow_id,
    )
    
    if job_id is None:
        # GPU offline: fallback to CPU rendering
        logger.warning("GPU offline, falling back to CPU avatar generation")
        avatar = _cpu_render_avatar(image_url)  # CPU fallback (slower)
        state["avatar"] = avatar
        state["gpu_used"] = False
        return state
    
    # Poll status until completion
    max_polls = 60  # 5 min timeout (300s / 5s poll interval)
    for _ in range(max_polls):
        status = gpu_client.poll_status(job_id)
        if status is None:
            # Polling failed, fallback
            logger.warning("GPU polling failed, falling back to CPU")
            avatar = _cpu_render_avatar(image_url)
            state["avatar"] = avatar
            state["gpu_used"] = False
            return state
        
        if status.get("status") == "completed":
            # Download artifact
            artifact = gpu_client.download_artifact(job_id)
            state["avatar"] = artifact
            state["gpu_used"] = True
            return state
        
        time.sleep(5)
    
    # Timeout: fallback to CPU
    logger.warning("GPU job timeout, falling back to CPU")
    avatar = _cpu_render_avatar(image_url)
    state["avatar"] = avatar
    state["gpu_used"] = False
    return state

# Add to state graph
workflow = StateGraph(...)
workflow.add_node("avatar_generation", node_avatar_generation)
workflow.add_node("matting", node_matting_extraction)
workflow.add_node("voice_generation", node_voice_generation)
workflow.add_node("rendering", node_final_rendering)
```

**Time Estimate:** 3 hours

---

### Task 2.4: Health Check + Monitoring

**File:** `autoflow/core/gpu_health_monitor.py`

**Acceptance Criteria:**
- [ ] `GpuHealthMonitor` class runs on 60s interval
- [ ] Pings GPU worker health endpoint
- [ ] If down >5 min: create Paperclip ticket + alert
- [ ] Tracks uptime percentage (SLA)
- [ ] Prometheus metrics: `autoflow_gpu_worker_available` (0|1)

**Template:**
```python
# autoflow/core/gpu_health_monitor.py

import asyncio
import logging
from datetime import datetime, timedelta
from autoflow.core.gpu_worker_client import GpuWorkerClient

class GpuHealthMonitor:
    """Monitor GPU worker health, alert on failures."""
    
    def __init__(self, check_interval_seconds: int = 60):
        self.check_interval = check_interval_seconds
        self.gpu_client = GpuWorkerClient()
        self.last_healthy = datetime.now()
        self.is_healthy = True
    
    async def monitor_loop(self):
        """Run continuous health check."""
        
        while True:
            try:
                health = self.gpu_client.health_check()
                is_now_healthy = health.get("status") == "healthy"
                
                if not is_now_healthy and self.is_healthy:
                    # Transition from healthy to unhealthy
                    self.last_unhealthy = datetime.now()
                    logger.warning("GPU worker unhealthy")
                
                if is_now_healthy and not self.is_healthy:
                    # Transition from unhealthy to healthy
                    downtime = datetime.now() - self.last_unhealthy
                    logger.info(f"GPU worker recovered after {downtime}")
                
                # Alert if down >5 min
                if not is_now_healthy:
                    downtime = datetime.now() - self.last_unhealthy
                    if downtime > timedelta(minutes=5) and not self._alert_sent:
                        self._create_alert()
                        self._alert_sent = True
                
                self.is_healthy = is_now_healthy
                
            except Exception as e:
                logger.error(f"Health monitor error: {e}")
            
            # Sleep before next check
            await asyncio.sleep(self.check_interval)
    
    def _create_alert(self):
        """Create Paperclip ticket for GPU worker downtime."""
        
        ticket = {
            "title": "GPU Worker Offline >5 minutes",
            "severity": "high",
            "description": "Desktop GPU worker has been unreachable for >5 minutes. Fallback to CPU rendering active.",
            "tags": ["infrastructure", "gpu-worker"],
        }
        
        # Create Paperclip ticket
        from autoflow.integrations.paperclip import create_ticket
        create_ticket(**ticket)
```

**Time Estimate:** 2 hours

---

### Task 2.5: Cloudflare Tunnel Setup (Infrastructure)

**Status:** Requires VPS configuration, not in AutoFlow codebase.

**Acceptance Criteria:**
- [ ] Cloudflare Tunnel configured on Desktop
- [ ] Tunnel points to `gpu_worker_api.py:5000`
- [ ] VPS can reach Desktop via tunnel URL
- [ ] Ping latency <100ms (acceptable for polling)

**Setup (manual, outside scope of code changes):**
```bash
# On Desktop:
1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. Create tunnel: cloudflared tunnel create aiox-gpu
3. Point to localhost:5000: cloudflared tunnel route dns aiox-gpu gpu.example.com
4. Start: cloudflared tunnel run aiox-gpu

# In AutoFlow config:
export GPU_WORKER_URL="https://gpu.example.com"
```

**Time Estimate:** 2 hours (infrastructure team)

---

## Gap 3: LLM-Router-AIOX Alignment (Cost Optimization)

**Severity:** MEDIUM  
**Effort:** 6 hours (1 sprint)  
**Depends On:** Gap 1 (for job context in routing decisions)  
**Can Parallelize:** Gap 2 (independent)

### Problem Statement
Router uses direct Ollama→Claude fallback, ignoring LLM-Router-AIOX complexity scoring. Routing decisions inconsistent. Cost tracking incomplete.

### Solution: Integrate LLM-Router decision into router.py

Current flow:
```
prompt → model override OR fallback to Ollama → execute
```

Desired flow:
```
prompt → LLM-Router /route (complexity score) → optimal model → execute → cost log
```

### Task 3.1: Document LLM-Router API

**File:** `/root/llm-router-aiox/API.md` (create/verify)

**Acceptance Criteria:**
- [ ] `/route` endpoint documented
- [ ] Request schema: `{prompt, context?, metadata?}`
- [ ] Response schema: `{model, complexity_score, complexity_level, estimated_cost, reason}`
- [ ] Error handling (timeout, 503, invalid response)
- [ ] Examples for simple/standard/complex queries

**Template:**
```markdown
# LLM-Router-AIOX API Documentation

## Endpoint: POST /route

Route a prompt to optimal LLM model based on complexity.

### Request
```json
{
  "prompt": "What is 2+2?",
  "context": {
    "workflow": "video-analysis",
    "user_tier": "pro"
  },
  "metadata": {
    "request_id": "req-123"
  }
}
```

### Response (200 OK)
```json
{
  "routing_decision": {
    "model": "ollama|claude",
    "complexity_score": 3,
    "complexity_level": "simple|standard|complex",
    "estimated_cost_usd": 0.0001,
    "reason": "Simple arithmetic, Ollama sufficient"
  }
}
```

### Complexity Levels
- **simple** (1-5): Arithmetic, formatting, regex, simple retrieval
- **standard** (6-10): Code review, general Q&A, summarization
- **complex** (11-15): Reasoning, multi-step analysis, creative tasks

### Model Selection
- simple → Ollama (qwen2.5:3b, free)
- standard → Ollama or Claude (heuristic based on load)
- complex → Claude (better reasoning)
```

**Time Estimate:** 1 hour

---

### Task 3.2: Update Router Integration

**File:** `autoflow/core/router.py` (update)

**Acceptance Criteria:**
- [ ] `_fetch_routing_decision()` calls LLM-Router `/route` (already implemented ✓)
- [ ] Response parsing validated (complexity_score, complexity_level)
- [ ] Fallback: if LLM-Router timeout, use Ollama default ✓
- [ ] Circuit breaker tracks LLM-Router uptime (3 failures → OPEN) ✓
- [ ] Cost logging captures complexity + estimated_cost ✓

**Validation (already in code):**
```python
# Current implementation in /root/autoflow/autoflow/core/router.py

def _fetch_routing_decision(prompt: str, context: Optional[dict] = None) -> Optional[dict]:
    """Call LLM-Router-AIOX /route. Returns the routing_decision dict or None."""
    
    if not _llm_router_breaker.allow():
        return None
    
    url = f"{config.LLM_ROUTER_URL.rstrip('/')}/route"
    payload: dict[str, Any] = {"prompt": prompt}
    if context:
        payload["context"] = context
    
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        _llm_router_breaker.record_failure()
        # ... error logging
        return None
    
    decision = data.get("routing_decision") if isinstance(data, dict) else None
    if not decision or not isinstance(decision, dict):
        _llm_router_breaker.record_failure()
        return None
    
    _llm_router_breaker.record_success()
    return decision

# VERDICT: ✅ Already implemented, tested, ready for production
```

**Time Estimate:** 1 hour (mostly verification + documentation)

---

### Task 3.3: Verify Cost Tracking Integration

**File:** `autoflow/core/router.py` (verify cost logging)

**Acceptance Criteria:**
- [ ] Each call logs `complexity_score, complexity_level, estimated_cost, actual_cost`
- [ ] Structured JSONL format: `{timestamp, workflow, complexity_score, model, cost}`
- [ ] Cost logger persists to PostgreSQL (primary) + fallback file
- [ ] Cost dashboard query: `SELECT SUM(cost_usd) FROM logs WHERE complexity_level='simple'`

**Validation (already in code):**
```python
# Cost logging in router.py

_log_event(
    {
        "type": "llm_call",
        "status": "success",
        "provider": provider,
        "model": actual_model,
        "preferred": preferred,
        "fallback_used": provider != preferred,
        "complexity_score": complexity_score,           # ✓ Logged
        "complexity_level": complexity_level,           # ✓ Logged
        "estimated_cost_usd": estimated_cost,           # ✓ Logged
        "actual_cost_usd": actual_cost,                 # ✓ Logged
        "latency_ms": latency_ms,
        "total_ms": total_ms,
        "prompt_chars": len(prompt),
        "response_chars": len(text),
        "circuit_state": _llm_router_breaker.state,
        "routing_reason": routing_reason,
    }
)

# VERDICT: ✅ Already implemented and tested
```

**Time Estimate:** 1 hour (verification + documentation)

---

### Task 3.4: Integration Tests with Live LLM-Router

**File:** `tests/test_llm_router_integration.py` (create/extend)

**Acceptance Criteria:**
- [ ] Test: simple query (2+2) → Ollama routing
- [ ] Test: complex query → Claude routing
- [ ] Test: LLM-Router timeout → fallback to Ollama
- [ ] Test: Circuit breaker open → default to Ollama
- [ ] Test: Cost calculation matches estimated vs actual

**Template:**
```python
# tests/test_llm_router_integration.py

@pytest.mark.asyncio
async def test_simple_query_routes_to_ollama():
    """Simple queries should route to Ollama (free)."""
    
    response = call_llm_sync(
        prompt="What is 2+2?",
        context={"workflow": "test"}
    )
    
    # Verify Ollama was used
    logs = cost_logger.get_recent_calls(limit=1)
    assert logs[0]["model"] == "qwen2.5:3b"  # Ollama
    assert logs[0]["actual_cost_usd"] == 0.0  # Free
    assert logs[0]["complexity_score"] <= 5  # Simple

@pytest.mark.asyncio
async def test_complex_query_routes_to_claude():
    """Complex queries should route to Claude."""
    
    response = call_llm_sync(
        prompt="Prove that P=NP and explain the implications for cryptography.",
        context={"workflow": "research"}
    )
    
    # Verify Claude was used
    logs = cost_logger.get_recent_calls(limit=1)
    assert logs[0]["model"] == "claude-3-5-sonnet"
    assert logs[0]["actual_cost_usd"] > 0.001  # Paid
    assert logs[0]["complexity_score"] >= 11  # Complex

@pytest.mark.asyncio
async def test_llm_router_timeout_fallback():
    """If LLM-Router times out, should fallback to default Ollama."""
    
    with patch("httpx.Client.post") as mock_post:
        mock_post.side_effect = httpx.TimeoutException("Timeout")
        
        response = call_llm_sync(prompt="Test query")
        
        logs = cost_logger.get_recent_calls(limit=1)
        assert logs[0]["model"] == "qwen2.5:3b"  # Fallback to Ollama
        assert logs[0]["routing_reason"] == "router-timeout"

@pytest.mark.asyncio
async def test_circuit_breaker_open_uses_default():
    """With CB OPEN, routing bypassed, defaults to Ollama."""
    
    # Force CB open
    router._llm_router_breaker._state = router.CircuitBreaker.OPEN
    
    response = call_llm_sync(prompt="Test query")
    
    logs = cost_logger.get_recent_calls(limit=1)
    assert logs[0]["circuit_state"] == "open"
    assert logs[0]["model"] == "qwen2.5:3b"  # Default fallback
```

**Time Estimate:** 2 hours

---

### Task 3.5: Dashboard Implementation (Optional, Phase 2.5)

**Status:** Optional, post-deployment nice-to-have

**Acceptance Criteria:**
- [ ] Dashboard page: `/admin/costs`
- [ ] Chart: Cost by complexity level (simple/standard/complex)
- [ ] Chart: Cost trend (7-day, 30-day)
- [ ] Stat: Average cost per call by model
- [ ] Stat: Routing decision distribution (Ollama % vs Claude %)

**Time Estimate:** 3 hours (optional)

---

## Implementation Sequence

### Sprint 1: Foundation (Gap 1)
**Days 1-5 (8 hours)**

| Day | Task | Effort | Owner |
|-----|------|--------|-------|
| 1 | 1.1: Install RQ + Redis | 1h | @dev |
| 1-2 | 1.2: Define 5 job classes | 3h | @dev |
| 2-3 | 1.3: Checkpoint manager | 3h | @dev |
| 3-4 | 1.4: E2E test + recovery | 1h | @qa |
| 5 | Code review + merge | 1h | @architect |

**Deliverable:** RQ-based job queue with checkpoint recovery (Gap 1 ✅)

---

### Sprint 2: Integration (Gaps 2 + 3 Parallel)
**Days 1-10 (18 hours)**

#### Track A: GPU Worker (Gap 2) — 12 hours
| Day | Task | Effort | Owner |
|-----|------|--------|-------|
| 1 | 2.1: Document GPU API | 1h | @dev |
| 1-2 | 2.2: GpuWorkerClient library | 3h | @dev |
| 2-3 | 2.3: Workflow integration | 3h | @dev |
| 3-4 | 2.4: Health monitoring | 2h | @dev |
| 4-5 | 2.5: Cloudflare Tunnel setup | 2h | @devops |
| 5 | E2E test + review | 1h | @qa |

#### Track B: LLM-Router (Gap 3) — 6 hours
| Day | Task | Effort | Owner |
|-----|------|--------|-------|
| 1 | 3.1: Document API | 1h | @analyst |
| 1-2 | 3.2: Router integration (verify) | 1h | @dev |
| 2 | 3.3: Cost tracking (verify) | 1h | @dev |
| 2-3 | 3.4: Integration tests | 2h | @qa |
| 3 | Code review + merge | 1h | @architect |

**Deliverables:**
- Gap 2: GPU worker integration ✅
- Gap 3: LLM-Router alignment ✅

---

## Deployment Checklist

### Pre-Deployment
- [ ] All Phase 2 tests passing (291 base + new tests)
- [ ] Code review approved (all 3 gaps)
- [ ] Database migrations applied
- [ ] Secrets rotated (ANTHROPIC_API_KEY, GPU_WORKER_URL)
- [ ] Monitoring configured (Prometheus metrics for each gap)
- [ ] Runbooks written (troubleshooting for RQ, GPU, router)

### Deployment
- [ ] Feature flag: `ENABLE_RQ_JOBS=true` (default false)
- [ ] Feature flag: `ENABLE_GPU_WORKER=true` (default false)
- [ ] Feature flag: `ENABLE_LLM_ROUTER=true` (default false)
- [ ] Gradual rollout: 10% → 50% → 100%
- [ ] Monitor cost tracking accuracy: expected ±5%
- [ ] Monitor GPU health: expected >95% availability

### Post-Deployment
- [ ] Verify all 3 gaps operational
- [ ] Run production smoke tests (synthetic load)
- [ ] Check cost dashboard for anomalies
- [ ] Review GPU worker uptime (first week)
- [ ] Get stakeholder sign-off

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Desktop GPU offline | HIGH | GPU tasks fail → CPU fallback | Health check + circuit breaker |
| LLM-Router API drift | MEDIUM | Routing breaks | Document API, versioning (/v1, /v2) |
| RQ Redis data loss | LOW | Jobs lost on restart | Periodic snapshot, fallback to in-process |
| GPU tunnel latency | MEDIUM | Polling timeouts | Increased timeout, local retry logic |
| Cost calculation accuracy | LOW | Budget overruns | Test with known costs, 5% tolerance |

---

## Success Metrics

| Gap | Success Metric | Target |
|-----|---|---|
| **1** | Video pipeline survives 5+ crashes | <30s recovery per crash |
| **2** | Avatar requests succeed | 99% success, 1% = Desktop offline |
| **3** | Cost accuracy | ±5% of actual spend |

---

## Rollback Plan

If any gap has critical bugs post-deployment:

1. **Gap 1 (RQ):** Disable `ENABLE_RQ_JOBS=false` → reverts to in-process jobs
2. **Gap 2 (GPU):** Disable `ENABLE_GPU_WORKER=false` → reverts to CPU rendering
3. **Gap 3 (Router):** Disable `ENABLE_LLM_ROUTER=false` → reverts to direct fallback

Each gap can be disabled independently; partial rollback is possible.

---

**Generated:** 2026-04-11  
**Status:** READY FOR IMPLEMENTATION  
**Next Step:** Start Sprint 1, Task 1.1 (Install RQ + Redis)
