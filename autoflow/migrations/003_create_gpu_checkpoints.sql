-- Migration: GPU Job Checkpoints (Phase 3 Foundation)
-- Version: 3
-- Date: 2026-04-11
-- Purpose: Store checkpoints for GPU jobs to enable resume-on-failure
-- Database: PostgreSQL 16

-- ─────────────────────────────────────────────────────────────────────────────
-- GPU Job Checkpoints Table (BullMQ Foundation)
-- ─────────────────────────────────────────────────────────────────────────────
-- Stores intermediate state for GPU jobs so they can resume from checkpoints
-- instead of restarting from scratch (10x faster recovery).

CREATE TABLE IF NOT EXISTS gpu_job_checkpoints (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL UNIQUE,
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('avatar', 'voice', 'matting', 'image', 'rendering')),

    -- Checkpoint stage: where in the pipeline is the job?
    stage VARCHAR(100) NOT NULL,
    -- Examples: 'queued', 'preprocessing', 'processing', 'postprocessing', 'complete'

    -- Progress: 0-100%
    progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),

    -- Serialized state (JSON): intermediate results, partial outputs
    -- Allows job to resume from this exact point on recovery
    checkpoint_data JSONB,

    -- Recovery metadata
    retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    last_error VARCHAR(1024),
    next_retry_at TIMESTAMP,

    -- Lifecycle: created, updated, expires (for TTL cleanup)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP  -- TTL for artifact cleanup (24h default)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_gpu_checkpoints_task_type ON gpu_job_checkpoints(task_type);
CREATE INDEX IF NOT EXISTS idx_gpu_checkpoints_stage ON gpu_job_checkpoints(stage);
CREATE INDEX IF NOT EXISTS idx_gpu_checkpoints_expires_at ON gpu_job_checkpoints(expires_at);
CREATE INDEX IF NOT EXISTS idx_gpu_checkpoints_updated_at ON gpu_job_checkpoints(updated_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: Auto-update updated_at on checkpoint modification
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS gpu_checkpoints_update_timestamp() CASCADE;
CREATE FUNCTION gpu_checkpoints_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gpu_checkpoints_updated_at ON gpu_job_checkpoints;
CREATE TRIGGER gpu_checkpoints_updated_at
BEFORE UPDATE ON gpu_job_checkpoints
FOR EACH ROW
EXECUTE FUNCTION gpu_checkpoints_update_timestamp();

-- ─────────────────────────────────────────────────────────────────────────────
-- View: Latest checkpoint for each job
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS vw_gpu_checkpoints_latest CASCADE;
CREATE VIEW vw_gpu_checkpoints_latest AS
SELECT
    job_id,
    task_type,
    stage,
    progress_percent,
    retry_count,
    last_error,
    updated_at,
    (CURRENT_TIMESTAMP - updated_at) AS age_seconds
FROM gpu_job_checkpoints
ORDER BY updated_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- View: Failed jobs requiring attention
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS vw_gpu_checkpoints_failed CASCADE;
CREATE VIEW vw_gpu_checkpoints_failed AS
SELECT
    job_id,
    task_type,
    stage,
    retry_count,
    last_error,
    updated_at,
    next_retry_at
FROM gpu_job_checkpoints
WHERE last_error IS NOT NULL AND retry_count > 0
ORDER BY updated_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- View: Jobs stalled in processing (not updated in 5+ minutes)
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS vw_gpu_checkpoints_stalled CASCADE;
CREATE VIEW vw_gpu_checkpoints_stalled AS
SELECT
    job_id,
    task_type,
    stage,
    progress_percent,
    retry_count,
    updated_at,
    (CURRENT_TIMESTAMP - updated_at) AS stalled_duration
FROM gpu_job_checkpoints
WHERE (CURRENT_TIMESTAMP - updated_at) > INTERVAL '5 minutes'
  AND stage NOT IN ('complete', 'failed')
ORDER BY updated_at ASC;
