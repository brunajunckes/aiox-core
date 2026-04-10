-- ============================================================================
-- Migration: Add Cost Tracking and Billing Tables
-- Created: 2026-04-10
-- Purpose: Enable cost tracking, budget management, and billing analytics
-- ============================================================================

-- Create cost_tracking table
-- Stores cost data for every request processed through AutoFlow
CREATE TABLE IF NOT EXISTS cost_tracking (
    request_id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    workflow_type VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    gpu_seconds FLOAT DEFAULT 0.0,
    duration_ms INTEGER NOT NULL,
    cost_usd DECIMAL(10, 6) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Indexes for common queries
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_workflow_type (workflow_type),
    INDEX idx_model (model),
    INDEX idx_created_at (created_at),
    INDEX idx_tenant_created (tenant_id, created_at),
    INDEX idx_workflow_tenant (workflow_type, tenant_id, created_at)
);

-- Create budget_limits table
-- Stores budget configuration per tenant
CREATE TABLE IF NOT EXISTS budget_limits (
    tenant_id VARCHAR(100) PRIMARY KEY,
    monthly_budget_usd DECIMAL(12, 2) NOT NULL,
    alert_threshold_percent FLOAT DEFAULT 80.0,
    hard_limit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_updated_at (updated_at)
);

-- Create cost_aggregation view for daily costs by tenant
CREATE VIEW IF NOT EXISTS v_daily_costs_by_tenant AS
SELECT
    tenant_id,
    DATE(created_at) as cost_date,
    SUM(cost_usd) as total_cost,
    COUNT(*) as request_count,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    AVG(cost_usd) as avg_cost,
    MAX(cost_usd) as max_cost,
    MIN(cost_usd) as min_cost
FROM cost_tracking
WHERE status = 'completed'
GROUP BY tenant_id, DATE(created_at)
ORDER BY tenant_id, cost_date DESC;

-- Create cost_aggregation view for daily costs by workflow
CREATE VIEW IF NOT EXISTS v_daily_costs_by_workflow AS
SELECT
    tenant_id,
    workflow_type,
    DATE(created_at) as cost_date,
    SUM(cost_usd) as total_cost,
    COUNT(*) as request_count,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    AVG(cost_usd) as avg_cost
FROM cost_tracking
WHERE status = 'completed'
GROUP BY tenant_id, workflow_type, DATE(created_at)
ORDER BY tenant_id, workflow_type, cost_date DESC;

-- Create view for monthly costs by tenant
CREATE VIEW IF NOT EXISTS v_monthly_costs_by_tenant AS
SELECT
    tenant_id,
    YEAR(created_at) as year,
    MONTH(created_at) as month,
    DATE_TRUNC('month', created_at)::DATE as month_date,
    SUM(cost_usd) as total_cost,
    COUNT(*) as request_count,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    AVG(cost_usd) as avg_cost,
    MAX(cost_usd) as max_cost,
    MIN(cost_usd) as min_cost
FROM cost_tracking
WHERE status = 'completed'
GROUP BY tenant_id, YEAR(created_at), MONTH(created_at), DATE_TRUNC('month', created_at)
ORDER BY tenant_id, year DESC, month DESC;

-- Create view for cost by model
CREATE VIEW IF NOT EXISTS v_costs_by_model AS
SELECT
    tenant_id,
    model,
    SUM(cost_usd) as total_cost,
    COUNT(*) as request_count,
    AVG(cost_usd) as avg_cost,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    MIN(created_at) as first_use,
    MAX(created_at) as last_use
FROM cost_tracking
WHERE status = 'completed'
GROUP BY tenant_id, model
ORDER BY tenant_id, total_cost DESC;

-- Create view for budget status
CREATE VIEW IF NOT EXISTS v_budget_status AS
SELECT
    b.tenant_id,
    b.monthly_budget_usd,
    b.alert_threshold_percent,
    b.hard_limit,
    COALESCE(SUM(c.cost_usd), 0) as current_month_cost,
    COALESCE(SUM(c.cost_usd), 0) / b.monthly_budget_usd * 100 as percent_used,
    b.monthly_budget_usd - COALESCE(SUM(c.cost_usd), 0) as remaining_budget,
    CASE
        WHEN COALESCE(SUM(c.cost_usd), 0) >= b.monthly_budget_usd THEN 'EXCEEDED'
        WHEN COALESCE(SUM(c.cost_usd), 0) >= (b.monthly_budget_usd * b.alert_threshold_percent / 100) THEN 'WARNING'
        ELSE 'OK'
    END as status
FROM budget_limits b
LEFT JOIN cost_tracking c ON b.tenant_id = c.tenant_id
    AND YEAR(c.created_at) = YEAR(CURRENT_DATE)
    AND MONTH(c.created_at) = MONTH(CURRENT_DATE)
    AND c.status = 'completed'
GROUP BY b.tenant_id, b.monthly_budget_usd, b.alert_threshold_percent, b.hard_limit;

-- Create view for cost anomalies (costs > 2 std devs from mean)
CREATE VIEW IF NOT EXISTS v_cost_anomalies AS
SELECT
    request_id,
    tenant_id,
    workflow_type,
    cost_usd,
    created_at,
    (
        SELECT
            STDDEV_POP(cost_usd) OVER (PARTITION BY tenant_id)
        FROM cost_tracking
        WHERE status = 'completed'
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        LIMIT 1
    ) as std_dev,
    (
        SELECT
            AVG(cost_usd) OVER (PARTITION BY tenant_id)
        FROM cost_tracking
        WHERE status = 'completed'
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        LIMIT 1
    ) as avg_cost,
    CASE
        WHEN ABS(cost_usd - (SELECT AVG(cost_usd) FROM cost_tracking WHERE tenant_id = cost_tracking.tenant_id AND created_at >= CURRENT_DATE - INTERVAL '30 days' AND status = 'completed')) > 2 * (SELECT STDDEV_POP(cost_usd) FROM cost_tracking WHERE tenant_id = cost_tracking.tenant_id AND created_at >= CURRENT_DATE - INTERVAL '30 days' AND status = 'completed')
        THEN 'CRITICAL'
        WHEN ABS(cost_usd - (SELECT AVG(cost_usd) FROM cost_tracking WHERE tenant_id = cost_tracking.tenant_id AND created_at >= CURRENT_DATE - INTERVAL '30 days' AND status = 'completed')) > 1.5 * (SELECT STDDEV_POP(cost_usd) FROM cost_tracking WHERE tenant_id = cost_tracking.tenant_id AND created_at >= CURRENT_DATE - INTERVAL '30 days' AND status = 'completed')
        THEN 'WARNING'
        ELSE 'NORMAL'
    END as severity
FROM cost_tracking
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    AND status = 'completed';

-- Create stored procedure to calculate monthly costs
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS get_monthly_costs(
    IN p_tenant_id VARCHAR(100),
    IN p_year INT,
    IN p_month INT
)
BEGIN
    SELECT
        DATE_TRUNC('month', created_at)::DATE as month_date,
        SUM(cost_usd) as total_cost,
        COUNT(*) as request_count,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        AVG(cost_usd) as avg_cost,
        MAX(cost_usd) as max_cost,
        MIN(cost_usd) as min_cost
    FROM cost_tracking
    WHERE tenant_id = p_tenant_id
        AND YEAR(created_at) = p_year
        AND MONTH(created_at) = p_month
        AND status = 'completed'
    GROUP BY DATE_TRUNC('month', created_at);
END$$
DELIMITER ;

-- Create stored procedure to get budget alerts
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS get_budget_alerts()
BEGIN
    SELECT
        b.tenant_id,
        b.monthly_budget_usd,
        COALESCE(SUM(c.cost_usd), 0) as current_month_cost,
        CASE
            WHEN COALESCE(SUM(c.cost_usd), 0) >= b.monthly_budget_usd THEN 'BUDGET_EXCEEDED'
            WHEN COALESCE(SUM(c.cost_usd), 0) >= (b.monthly_budget_usd * b.alert_threshold_percent / 100) THEN 'BUDGET_WARNING'
            ELSE NULL
        END as alert_level,
        b.updated_at
    FROM budget_limits b
    LEFT JOIN cost_tracking c ON b.tenant_id = c.tenant_id
        AND YEAR(c.created_at) = YEAR(CURRENT_DATE)
        AND MONTH(c.created_at) = MONTH(CURRENT_DATE)
        AND c.status = 'completed'
    GROUP BY b.tenant_id, b.monthly_budget_usd, b.alert_threshold_percent, b.updated_at
    HAVING COALESCE(SUM(c.cost_usd), 0) >= (b.monthly_budget_usd * b.alert_threshold_percent / 100);
END$$
DELIMITER ;

-- Create trigger to update cost_tracking updated_at
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS trg_cost_tracking_updated_at
BEFORE UPDATE ON cost_tracking
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$
DELIMITER ;

-- Create trigger to update budget_limits updated_at
DELIMITER $$
CREATE TRIGGER IF NOT EXISTS trg_budget_limits_updated_at
BEFORE UPDATE ON budget_limits
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$
DELIMITER ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cost_tracking_tenant_date ON cost_tracking(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_workflow_date ON cost_tracking(workflow_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_model_date ON cost_tracking(model, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_status ON cost_tracking(status, created_at DESC);

-- Create index for budget status checks
CREATE INDEX IF NOT EXISTS idx_budget_limits_tenant ON budget_limits(tenant_id);

-- ============================================================================
-- End of Migration
-- ============================================================================
