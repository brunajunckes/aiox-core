-- Migration: Add experiments and A/B testing tables
-- Date: April 10, 2026
-- Purpose: Support A/B testing framework with experiments, variants, results, and analysis

-- Create experiments table
CREATE TABLE IF NOT EXISTS experiments (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    target_sample_size INTEGER,
    confidence_level FLOAT DEFAULT 0.95,
    minimum_detectable_effect FLOAT DEFAULT 0.10,
    control_variant_id VARCHAR(100),
    tags JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_end_date (end_date)
);

-- Create experiment_variants table
CREATE TABLE IF NOT EXISTS experiment_variants (
    id VARCHAR(100) PRIMARY KEY,
    experiment_id VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    percentage FLOAT NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_name (name)
);

-- Create experiment_results table for metric recording
CREATE TABLE IF NOT EXISTS experiment_results (
    id BIGSERIAL PRIMARY KEY,
    experiment_id VARCHAR(32) NOT NULL,
    variant_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    metric_value FLOAT NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES experiment_variants(id) ON DELETE CASCADE,
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_variant_id (variant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_metric_name (metric_name),
    INDEX idx_recorded_at (recorded_at)
);

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    INDEX idx_enabled (enabled),
    INDEX idx_created_at (created_at),
    INDEX idx_name (name)
);

-- Create feature_flag_variants table
CREATE TABLE IF NOT EXISTS feature_flag_variants (
    id BIGSERIAL PRIMARY KEY,
    feature_flag_id VARCHAR(100) NOT NULL,
    variant_id VARCHAR(100) NOT NULL,
    percentage FLOAT NOT NULL,
    targeting_rules JSONB,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feature_flag_id) REFERENCES feature_flags(id) ON DELETE CASCADE,
    INDEX idx_feature_flag_id (feature_flag_id),
    INDEX idx_priority (priority)
);

-- Create user_segment table
CREATE TABLE IF NOT EXISTS user_segments (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    targeting_rules JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_created_at (created_at)
);

-- Create user_segment_members table
CREATE TABLE IF NOT EXISTS user_segment_members (
    id BIGSERIAL PRIMARY KEY,
    segment_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (segment_id) REFERENCES user_segments(id) ON DELETE CASCADE,
    UNIQUE KEY unique_segment_user (segment_id, user_id),
    INDEX idx_segment_id (segment_id),
    INDEX idx_user_id (user_id)
);

-- Create experiment_assignments table (for tracking user assignments)
CREATE TABLE IF NOT EXISTS experiment_assignments (
    id BIGSERIAL PRIMARY KEY,
    experiment_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES experiment_variants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_exp_user (experiment_id, user_id),
    INDEX idx_experiment_id (experiment_id),
    INDEX idx_user_id (user_id),
    INDEX idx_variant_id (variant_id),
    INDEX idx_assigned_at (assigned_at)
);

-- Create view for variant statistics
CREATE OR REPLACE VIEW experiment_variant_stats AS
SELECT
    er.experiment_id,
    er.variant_id,
    er.metric_name,
    er.metric_type,
    COUNT(*) as total_samples,
    SUM(CASE WHEN er.metric_value > 0 THEN 1 ELSE 0 END) as conversions,
    AVG(er.metric_value) as mean_value,
    STDDEV_POP(er.metric_value) as stddev_value,
    MIN(er.metric_value) as min_value,
    MAX(er.metric_value) as max_value,
    MIN(er.recorded_at) as first_recorded,
    MAX(er.recorded_at) as last_recorded,
    COUNT(DISTINCT er.user_id) as unique_users
FROM experiment_results er
GROUP BY er.experiment_id, er.variant_id, er.metric_name, er.metric_type;

-- Create view for experiment summary
CREATE OR REPLACE VIEW experiment_summary AS
SELECT
    e.id,
    e.name,
    e.description,
    e.status,
    e.created_at,
    e.start_date,
    e.end_date,
    COUNT(DISTINCT er.user_id) as total_participants,
    COUNT(er.id) as total_metrics_recorded,
    COUNT(DISTINCT ev.id) as variant_count,
    e.confidence_level,
    e.minimum_detectable_effect
FROM experiments e
LEFT JOIN experiment_results er ON e.id = er.experiment_id
LEFT JOIN experiment_variants ev ON e.id = ev.experiment_id
GROUP BY e.id, e.name, e.description, e.status, e.created_at, e.start_date, e.end_date, e.confidence_level, e.minimum_detectable_effect;

-- Create view for statistical comparison
CREATE OR REPLACE VIEW variant_comparison AS
SELECT
    ev1.experiment_id,
    ev1.id as variant_1_id,
    ev1.name as variant_1_name,
    ev2.id as variant_2_id,
    ev2.name as variant_2_name,
    evs1.metric_name,
    evs1.total_samples as variant_1_samples,
    evs2.total_samples as variant_2_samples,
    evs1.mean_value as variant_1_mean,
    evs2.mean_value as variant_2_mean,
    ROUND(((evs2.mean_value - evs1.mean_value) / evs1.mean_value * 100), 2) as percent_difference
FROM experiment_variants ev1
JOIN experiment_variants ev2 ON ev1.experiment_id = ev2.experiment_id AND ev1.id < ev2.id
JOIN experiment_variant_stats evs1 ON ev1.id = evs1.variant_id
JOIN experiment_variant_stats evs2 ON ev2.id = evs2.variant_id AND evs1.metric_name = evs2.metric_name;

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_experiment_results_experiment_variant
    ON experiment_results(experiment_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_experiment_results_metric
    ON experiment_results(metric_name, recorded_at);

CREATE INDEX IF NOT EXISTS idx_feature_flag_enabled
    ON feature_flags(enabled, created_at);

-- Add constraints for data integrity
ALTER TABLE experiments
    ADD CONSTRAINT check_confidence_level CHECK (confidence_level >= 0.90 AND confidence_level <= 0.99),
    ADD CONSTRAINT check_effect_size CHECK (minimum_detectable_effect > 0 AND minimum_detectable_effect <= 1);

ALTER TABLE experiment_variants
    ADD CONSTRAINT check_percentage CHECK (percentage >= 0 AND percentage <= 100);

ALTER TABLE feature_flag_variants
    ADD CONSTRAINT check_ff_percentage CHECK (percentage >= 0 AND percentage <= 100);

-- Create stored procedure for chi-square calculation (for PostgreSQL)
-- This can be used for statistical analysis in the database
CREATE OR REPLACE FUNCTION calculate_chi_square(
    control_conversions BIGINT,
    control_total BIGINT,
    treatment_conversions BIGINT,
    treatment_total BIGINT
)
RETURNS TABLE (chi_square FLOAT, p_value FLOAT) AS $$
DECLARE
    expected_control_conv FLOAT;
    expected_treatment_conv FLOAT;
    chi_square_stat FLOAT;
BEGIN
    -- Calculate expected values
    expected_control_conv := (control_conversions + treatment_conversions)::FLOAT * control_total / (control_total + treatment_total);
    expected_treatment_conv := (control_conversions + treatment_conversions)::FLOAT * treatment_total / (control_total + treatment_total);

    -- Calculate chi-square statistic
    chi_square_stat :=
        POWER(control_conversions - expected_control_conv, 2) / expected_control_conv +
        POWER(treatment_conversions - expected_treatment_conv, 2) / expected_treatment_conv;

    -- Return results (p-value approximation)
    RETURN QUERY SELECT
        chi_square_stat,
        0.05::FLOAT;  -- Placeholder p-value
END;
$$ LANGUAGE plpgsql;

-- Populate initial test data (optional)
-- INSERT INTO experiments (id, name, description, status, start_date, confidence_level)
-- VALUES ('exp_test001', 'Test A/B Experiment', 'Initial test experiment', 'running', NOW(), 0.95);
