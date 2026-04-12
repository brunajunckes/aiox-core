/**
 * System Health Database Access Layer
 * Story 45.7 — Admin Dashboard System Management
 *
 * Rolling health-check samples for monitoring system status.
 * Stores latest health check for each check_name for dashboard display.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Health check record from database
 */
export interface SystemHealthRecord {
  id: number;
  check_name: string;
  status: 'ok' | 'degraded' | 'down' | 'unknown';
  latency_ms?: number | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Input to create/record a health check
 */
export interface RecordHealthCheckInput {
  check_name: string;
  status: 'ok' | 'degraded' | 'down' | 'unknown';
  latency_ms?: number | null;
  details?: Record<string, unknown> | null;
}

/**
 * Latest health status per check_name (for dashboard summary)
 */
export interface HealthCheckSummary {
  check_name: string;
  status: 'ok' | 'degraded' | 'down' | 'unknown';
  latency_ms?: number | null;
  last_check: string;
}

/**
 * Overall system health dashboard
 */
export interface SystemHealthDashboard {
  overall_status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  checks: HealthCheckSummary[];
  uptime_percent?: number;
}

/**
 * Record a health check result (append-only, rolling)
 */
export async function recordHealthCheck(input: RecordHealthCheckInput): Promise<SystemHealthRecord> {
  const { data, error } = await supabase
    .from('system_health')
    .insert([
      {
        check_name: input.check_name,
        status: input.status,
        latency_ms: input.latency_ms || null,
        details: input.details || {},
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to record health check: ${error.message}`);
  }

  return data as SystemHealthRecord;
}

/**
 * Get latest health status for all checks
 */
export async function getLatestHealthChecks(): Promise<HealthCheckSummary[]> {
  // Get the most recent check for each unique check_name
  const { data, error } = await supabase
    .from('system_health')
    .select('*')
    .order('check_name', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get health checks: ${error.message}`);
  }

  const records = (data || []) as SystemHealthRecord[];

  // Group by check_name and take the first (most recent) for each
  const latestByName: Record<string, HealthCheckSummary> = {};

  records.forEach((record) => {
    if (!latestByName[record.check_name]) {
      latestByName[record.check_name] = {
        check_name: record.check_name,
        status: record.status,
        latency_ms: record.latency_ms || undefined,
        last_check: record.created_at,
      };
    }
  });

  return Object.values(latestByName);
}

/**
 * Get health status for a specific check_name
 */
export async function getHealthCheckStatus(checkName: string): Promise<HealthCheckSummary | null> {
  const { data, error } = await supabase
    .from('system_health')
    .select('*')
    .eq('check_name', checkName)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get health check: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const record = data as SystemHealthRecord;
  return {
    check_name: record.check_name,
    status: record.status,
    latency_ms: record.latency_ms || undefined,
    last_check: record.created_at,
  };
}

/**
 * Get health check history for a specific check_name (rolling samples)
 */
export async function getHealthCheckHistory(
  checkName: string,
  limit: number = 20
): Promise<SystemHealthRecord[]> {
  const { data, error } = await supabase
    .from('system_health')
    .select('*')
    .eq('check_name', checkName)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get health check history: ${error.message}`);
  }

  return (data || []) as SystemHealthRecord[];
}

/**
 * Get overall system health dashboard
 */
export async function getSystemHealthDashboard(): Promise<SystemHealthDashboard> {
  const checks = await getLatestHealthChecks();

  // Determine overall status: if any check is 'down', overall is 'down'
  // If any is 'degraded', overall is 'degraded'. Otherwise 'ok'.
  let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';
  if (checks.some((c) => c.status === 'down')) {
    overallStatus = 'down';
  } else if (checks.some((c) => c.status === 'degraded')) {
    overallStatus = 'degraded';
  }

  return {
    overall_status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  };
}

/**
 * Get uptime percentage (basic: % of 'ok' checks in past N hours)
 * Note: More sophisticated monitoring would track continuous uptime.
 * This gives a quick view of recent health.
 */
export async function calculateUptimePercent(hoursBack: number = 1): Promise<number> {
  const since = new Date();
  since.setHours(since.getHours() - hoursBack);

  const { data, error } = await supabase
    .from('system_health')
    .select('status')
    .gte('created_at', since.toISOString());

  if (error || !data || data.length === 0) {
    return 100;
  }

  const okCount = (data as SystemHealthRecord[]).filter((r) => r.status === 'ok').length;
  return Math.round((okCount / data.length) * 100);
}

/**
 * Clean up old health records (retention beyond N days)
 * This is a manual maintenance function, not called automatically.
 */
export async function cleanupOldHealthRecords(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const { count, error } = await supabase
    .from('system_health')
    .delete()
    .lt('created_at', cutoffDate.toISOString());

  if (error) {
    throw new Error(`Failed to clean up health records: ${error.message}`);
  }

  return count || 0;
}
