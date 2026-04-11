-- Multi-tenant support database schema
-- Adds tenant isolation to existing tables and creates new tenant management tables

-- ============================================================================
-- Tenant Configuration Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- Tenant API Keys Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_api_keys (
    api_key_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    api_key VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant_id ON tenant_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_api_key ON tenant_api_keys(api_key);

-- ============================================================================
-- Tenant Configuration & Quotas Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_config (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    max_requests_per_hour INTEGER DEFAULT 1000,
    max_concurrent_workflows INTEGER DEFAULT 10,
    max_jobs_per_day INTEGER DEFAULT 500,
    storage_quota_gb DECIMAL(10, 2) DEFAULT 100.00,
    features JSONB DEFAULT '{
        "advanced_analytics": false,
        "custom_models": false,
        "api_access": true,
        "batch_processing": false,
        "webhook_integrations": false,
        "priority_support": false
    }'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_config_tenant_id ON tenant_config(tenant_id);

-- ============================================================================
-- Tenant Usage Tracking Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_usage (
    usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    usage_date DATE DEFAULT CURRENT_DATE,
    requests_count INTEGER DEFAULT 0,
    concurrent_workflows INTEGER DEFAULT 0,
    jobs_count INTEGER DEFAULT 0,
    storage_used_gb DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant_id ON tenant_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_date ON tenant_usage(usage_date);

-- ============================================================================
-- Tenant Request Audit Log Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10),
    status_code INTEGER,
    client_ip VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_tenant_id ON tenant_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_log_created_at ON tenant_audit_log(created_at);

-- ============================================================================
-- Add Tenant Support to Workflows Table
-- ============================================================================
ALTER TABLE IF EXISTS workflows
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_workflows_tenant_id ON workflows(tenant_id);

-- Set tenant_id to a default for existing rows (if any)
UPDATE workflows SET tenant_id = (SELECT tenant_id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;

-- Make tenant_id NOT NULL after populating
ALTER TABLE workflows
ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================================
-- Add Tenant Support to Jobs Table
-- ============================================================================
ALTER TABLE IF EXISTS jobs
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_id ON jobs(tenant_id);

-- Set tenant_id to a default for existing rows (if any)
UPDATE jobs SET tenant_id = (SELECT tenant_id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;

-- Make tenant_id NOT NULL after populating
ALTER TABLE jobs
ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================================
-- Row-Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tenant-aware tables
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workflows
CREATE POLICY IF NOT EXISTS workflows_tenant_isolation ON workflows
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY IF NOT EXISTS workflows_tenant_isolation_insert ON workflows
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Create RLS policies for jobs
CREATE POLICY IF NOT EXISTS jobs_tenant_isolation ON jobs
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY IF NOT EXISTS jobs_tenant_isolation_insert ON jobs
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Create RLS policies for tenant_config
CREATE POLICY IF NOT EXISTS tenant_config_isolation ON tenant_config
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Create RLS policies for tenant_usage
CREATE POLICY IF NOT EXISTS tenant_usage_isolation ON tenant_usage
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Create RLS policies for tenant_audit_log
CREATE POLICY IF NOT EXISTS tenant_audit_log_isolation ON tenant_audit_log
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Create RLS policies for tenant_api_keys
CREATE POLICY IF NOT EXISTS tenant_api_keys_isolation ON tenant_api_keys
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- Tenant-Aware Composite Indexes
-- ============================================================================

-- Efficient queries filtering by tenant and other fields
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_status ON workflows(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_created ON workflows(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status ON jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_workflow ON jobs(tenant_id, workflow_id);

-- ============================================================================
-- Functions for Tenant Isolation
-- ============================================================================

-- Function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id UUID) RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_id::text, false);
END;
$$ LANGUAGE plpgsql;

-- Function to get current tenant context
CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id')::uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to create tenant
CREATE OR REPLACE FUNCTION create_tenant(
    p_name VARCHAR(255),
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    INSERT INTO tenants (name, metadata)
    VALUES (p_name, p_metadata)
    RETURNING tenant_id INTO v_tenant_id;

    INSERT INTO tenant_config (tenant_id)
    VALUES (v_tenant_id);

    INSERT INTO tenant_usage (tenant_id)
    VALUES (v_tenant_id);

    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger for updating timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_tenants_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_tenant_config_updated_at
BEFORE UPDATE ON tenant_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_tenant_usage_updated_at
BEFORE UPDATE ON tenant_usage
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Initialize default tenant
-- ============================================================================

-- Insert a default tenant if none exist
INSERT INTO tenants (name, metadata)
SELECT 'default', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM tenants LIMIT 1);

-- Insert config for default tenant if needed
INSERT INTO tenant_config (tenant_id)
SELECT tenant_id FROM tenants WHERE name = 'default'
ON CONFLICT (tenant_id) DO NOTHING;

-- Insert usage for default tenant if needed
INSERT INTO tenant_usage (tenant_id)
SELECT tenant_id FROM tenants WHERE name = 'default'
ON CONFLICT (tenant_id, usage_date) DO NOTHING;
