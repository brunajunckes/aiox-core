-- Migration: Create GPU Job Metrics Table
-- Version: 2
-- Date: 2026-04-11
-- Purpose: Store metrics for all GPU worker jobs (avatar, voice, matting, image, rendering)

-- ─────────────────────────────────────────────────────────────────────────────
-- GPU Job Metrics Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gpu_job_metrics (
    -- Identifiers
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL UNIQUE,

    -- Task metadata
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('avatar', 'voice', 'matting', 'image', 'rendering')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failed', 'timeout', 'submitted')),

    -- Performance metrics
    latency_ms INT NOT NULL CHECK (latency_ms >= 0),
    retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),

    -- Cost tracking
    cost_usd DECIMAL(7, 4) NOT NULL CHECK (cost_usd >= 0),

    -- Desktop state
    desktop_uptime_percent DECIMAL(5, 2) NOT NULL CHECK (desktop_uptime_percent >= 0 AND desktop_uptime_percent <= 100),

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Indexes for common queries
    INDEX idx_task_type (task_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_task_created (task_type, created_at DESC),
    INDEX idx_job_id (job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- Desktop Uptime History Table (optional, for detailed tracking)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gpu_worker_health_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('online', 'offline')),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(255),

    INDEX idx_timestamp (timestamp DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- Metrics View: Hourly aggregation (last 24 hours)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_gpu_metrics_hourly_24h AS
SELECT
    DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') AS hour,
    task_type,
    COUNT(*) AS count,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
    ROUND(100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*), 2) AS success_rate_percent,
    ROUND(AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END), 0) AS avg_latency_ms,
    ROUND(MAX(latency_ms), 0) AS max_latency_ms,
    ROUND(SUM(cost_usd), 4) AS total_cost_usd,
    ROUND(AVG(desktop_uptime_percent), 2) AS avg_desktop_uptime_percent
FROM gpu_job_metrics
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00'), task_type
ORDER BY hour DESC, task_type;

-- ─────────────────────────────────────────────────────────────────────────────
-- Metrics View: Daily aggregation (last 30 days)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW vw_gpu_metrics_daily_30d AS
SELECT
    DATE(created_at) AS date,
    task_type,
    COUNT(*) AS count,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
    ROUND(100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*), 2) AS success_rate_percent,
    ROUND(AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END), 0) AS avg_latency_ms,
    ROUND(MAX(latency_ms), 0) AS max_latency_ms,
    ROUND(SUM(cost_usd), 4) AS total_cost_usd,
    ROUND(AVG(desktop_uptime_percent), 2) AS avg_desktop_uptime_percent
FROM gpu_job_metrics
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at), task_type
ORDER BY date DESC, task_type;

-- ─────────────────────────────────────────────────────────────────────────────
-- Stored Procedure: Get current metrics summary
-- ─────────────────────────────────────────────────────────────────────────────

DELIMITER //

CREATE OR REPLACE PROCEDURE sp_gpu_metrics_summary()
BEGIN
    SELECT
        task_type,
        COUNT(*) AS total_jobs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successful_jobs,
        ROUND(100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / COUNT(*), 2) AS success_rate_percent,
        ROUND(AVG(latency_ms), 0) AS avg_latency_ms,
        ROUND(MAX(latency_ms), 0) AS max_latency_ms,
        ROUND(MIN(latency_ms), 0) AS min_latency_ms,
        ROUND(SUM(cost_usd), 4) AS total_cost_usd,
        ROUND(AVG(desktop_uptime_percent), 2) AS avg_uptime_percent
    FROM gpu_job_metrics
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    GROUP BY task_type
    ORDER BY total_jobs DESC;
END //

DELIMITER ;
