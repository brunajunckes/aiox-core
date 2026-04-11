-- Migration: Cost Aggregation Views & Analytics (Phase 3)
-- Version: 4
-- Date: 2026-04-11
-- Purpose: Materialized views for cost tracking across GPU jobs
-- Database: PostgreSQL 16

-- ─────────────────────────────────────────────────────────────────────────────
-- Cost Aggregation Table (Analytics Foundation)
-- ─────────────────────────────────────────────────────────────────────────────
-- Pre-computed aggregations: hourly/daily/weekly/monthly cost summaries
-- Updated automatically by scheduled events.
-- Enables fast dashboards + reporting (avoid expensive GROUP BY on large tables).

CREATE TABLE IF NOT EXISTS gpu_cost_aggregation (
    id BIGSERIAL PRIMARY KEY,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),

    -- Dimension: task type (NULL = all tasks)
    task_type VARCHAR(50),

    -- Job counts
    total_jobs INT NOT NULL DEFAULT 0,
    successful_jobs INT NOT NULL DEFAULT 0,
    failed_jobs INT NOT NULL DEFAULT 0,

    -- Cost metrics
    total_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,
    avg_cost_per_job DECIMAL(8, 4),
    cost_per_success DECIMAL(8, 4),  -- How much each successful job costs?

    -- Performance metrics
    avg_latency_ms INT,
    p95_latency_ms INT,
    p99_latency_ms INT,

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (period_start, period_type, task_type)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_gpu_cost_aggregation_period_start ON gpu_cost_aggregation(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_gpu_cost_aggregation_task_type ON gpu_cost_aggregation(task_type);
CREATE INDEX IF NOT EXISTS idx_gpu_cost_aggregation_period_type ON gpu_cost_aggregation(period_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- View: Hourly cost aggregation (from raw metrics)
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS vw_gpu_cost_hourly CASCADE;
CREATE VIEW vw_gpu_cost_hourly AS
SELECT
    DATE_TRUNC('hour', created_at) AS period_start,
    DATE_TRUNC('hour', created_at) + INTERVAL '1 hour' AS period_end,
    'hourly'::VARCHAR AS period_type,
    task_type,
    COUNT(*)::INT AS total_jobs,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::INT AS successful_jobs,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::INT AS failed_jobs,
    SUM(cost_usd) AS total_cost_usd,
    AVG(cost_usd) AS avg_cost_per_job,
    SUM(cost_usd) / NULLIF(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS cost_per_success,
    AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END)::INT AS avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::INT AS p95_latency_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::INT AS p99_latency_ms
FROM gpu_job_metrics
GROUP BY DATE_TRUNC('hour', created_at), task_type;

-- ─────────────────────────────────────────────────────────────────────────────
-- View: Daily cost aggregation
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS vw_gpu_cost_daily CASCADE;
CREATE VIEW vw_gpu_cost_daily AS
SELECT
    DATE_TRUNC('day', created_at)::DATE AS period_start,
    (DATE_TRUNC('day', created_at) + INTERVAL '1 day')::DATE AS period_end,
    'daily'::VARCHAR AS period_type,
    task_type,
    COUNT(*)::INT AS total_jobs,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::INT AS successful_jobs,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::INT AS failed_jobs,
    SUM(cost_usd) AS total_cost_usd,
    AVG(cost_usd) AS avg_cost_per_job,
    SUM(cost_usd) / NULLIF(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS cost_per_success,
    AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END)::INT AS avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::INT AS p95_latency_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::INT AS p99_latency_ms
FROM gpu_job_metrics
GROUP BY DATE_TRUNC('day', created_at), task_type;

-- ─────────────────────────────────────────────────────────────────────────────
-- View: Weekly cost aggregation
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS vw_gpu_cost_weekly CASCADE;
CREATE VIEW vw_gpu_cost_weekly AS
SELECT
    DATE_TRUNC('week', created_at)::DATE AS period_start,
    (DATE_TRUNC('week', created_at) + INTERVAL '7 days')::DATE AS period_end,
    'weekly'::VARCHAR AS period_type,
    task_type,
    COUNT(*)::INT AS total_jobs,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::INT AS successful_jobs,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::INT AS failed_jobs,
    SUM(cost_usd) AS total_cost_usd,
    AVG(cost_usd) AS avg_cost_per_job,
    SUM(cost_usd) / NULLIF(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS cost_per_success,
    AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END)::INT AS avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::INT AS p95_latency_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::INT AS p99_latency_ms
FROM gpu_job_metrics
GROUP BY DATE_TRUNC('week', created_at), task_type;

-- ─────────────────────────────────────────────────────────────────────────────
-- View: Monthly cost aggregation
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS vw_gpu_cost_monthly CASCADE;
CREATE VIEW vw_gpu_cost_monthly AS
SELECT
    DATE_TRUNC('month', created_at)::DATE AS period_start,
    (DATE_TRUNC('month', created_at) + INTERVAL '1 month')::DATE AS period_end,
    'monthly'::VARCHAR AS period_type,
    task_type,
    COUNT(*)::INT AS total_jobs,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::INT AS successful_jobs,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::INT AS failed_jobs,
    SUM(cost_usd) AS total_cost_usd,
    AVG(cost_usd) AS avg_cost_per_job,
    SUM(cost_usd) / NULLIF(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS cost_per_success,
    AVG(CASE WHEN status = 'success' THEN latency_ms ELSE NULL END)::INT AS avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::INT AS p95_latency_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms)::INT AS p99_latency_ms
FROM gpu_job_metrics
GROUP BY DATE_TRUNC('month', created_at), task_type;

-- ─────────────────────────────────────────────────────────────────────────────
-- View: Cost summary across all tasks (hourly, last 24h)
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS vw_gpu_cost_24h CASCADE;
CREATE VIEW vw_gpu_cost_24h AS
SELECT
    DATE_TRUNC('hour', created_at) AS hour,
    COUNT(*)::INT AS total_jobs,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::INT AS successful_jobs,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::INT AS failed_jobs,
    SUM(cost_usd) AS total_cost_usd,
    AVG(cost_usd) AS avg_cost_per_job,
    AVG(latency_ms)::INT AS avg_latency_ms,
    MAX(latency_ms)::INT AS max_latency_ms,
    MIN(latency_ms)::INT AS min_latency_ms
FROM gpu_job_metrics
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- Materialized View: Monthly summary (fast queries for dashboards)
-- ─────────────────────────────────────────────────────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS mv_gpu_cost_summary CASCADE;
CREATE MATERIALIZED VIEW mv_gpu_cost_summary AS
SELECT
    DATE_TRUNC('month', created_at)::DATE AS month,
    task_type,
    COUNT(*)::INT AS total_jobs,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::INT AS successful_jobs,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::INT AS failed_jobs,
    SUM(cost_usd) AS total_cost_usd,
    AVG(cost_usd) AS avg_cost_per_job,
    AVG(latency_ms)::INT AS avg_latency_ms
FROM gpu_job_metrics
GROUP BY DATE_TRUNC('month', created_at), task_type;

-- Index for materialized view performance
CREATE INDEX IF NOT EXISTS idx_mv_gpu_cost_summary_month ON mv_gpu_cost_summary(month DESC);
CREATE INDEX IF NOT EXISTS idx_mv_gpu_cost_summary_task_type ON mv_gpu_cost_summary(task_type);
