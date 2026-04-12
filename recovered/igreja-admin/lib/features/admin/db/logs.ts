/**
 * Admin Logs Database Access Layer
 * Story 45.7 — Admin Dashboard System Management
 *
 * Immutable audit trail of all admin actions.
 * Entries are inserted only (never updated), and optionally deleted only after retention period.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Admin log record from database
 */
export interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

/**
 * Input to create an admin log entry
 */
export interface CreateAdminLogInput {
  admin_id: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

/**
 * Filter options for listing admin logs
 */
export interface AdminLogFilter {
  admin_id?: string;
  action?: string;
  resource_type?: string;
  resource_id?: string;
  date_from?: string; // ISO 8601 date
  date_to?: string; // ISO 8601 date
  page?: number;
  limit?: number;
}

/**
 * Paginated response for admin logs
 */
export interface AdminLogPage {
  logs: AdminLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Create a new admin log entry (immutable append-only)
 */
export async function createAdminLog(input: CreateAdminLogInput): Promise<AdminLog> {
  const { data, error } = await supabase
    .from('admin_logs')
    .insert([
      {
        admin_id: input.admin_id,
        action: input.action,
        resource_type: input.resource_type,
        resource_id: input.resource_id || null,
        old_values: input.old_values || null,
        new_values: input.new_values || null,
        ip_address: input.ip_address || null,
        user_agent: input.user_agent || null,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create admin log: ${error.message}`);
  }

  return data as AdminLog;
}

/**
 * List admin logs with filtering and pagination
 */
export async function listAdminLogs(filter: AdminLogFilter): Promise<AdminLogPage> {
  const page = filter.page || 1;
  const limit = filter.limit || 50;
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase.from('admin_logs').select('*', { count: 'exact' });

  if (filter.admin_id) {
    query = query.eq('admin_id', filter.admin_id);
  }

  if (filter.action) {
    query = query.eq('action', filter.action);
  }

  if (filter.resource_type) {
    query = query.eq('resource_type', filter.resource_type);
  }

  if (filter.resource_id) {
    query = query.eq('resource_id', filter.resource_id);
  }

  if (filter.date_from) {
    query = query.gte('created_at', filter.date_from);
  }

  if (filter.date_to) {
    query = query.lte('created_at', filter.date_to);
  }

  // Order by most recent first, then paginate
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list admin logs: ${error.message}`);
  }

  const total = count || 0;
  const pages = Math.ceil(total / limit);

  return {
    logs: (data || []) as AdminLog[],
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  };
}

/**
 * Get a single admin log by ID
 */
export async function getAdminLog(id: string): Promise<AdminLog | null> {
  const { data, error } = await supabase
    .from('admin_logs')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (not an error)
    throw new Error(`Failed to get admin log: ${error.message}`);
  }

  return data ? (data as AdminLog) : null;
}

/**
 * Get admin activity summary (total actions by admin in time range)
 */
export async function getAdminActivitySummary(
  adminId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{
  total_actions: number;
  actions_by_type: Record<string, number>;
  recent_actions: AdminLog[];
}> {
  let query = supabase.from('admin_logs').select('*').eq('admin_id', adminId);

  if (dateFrom) {
    query = query.gte('created_at', dateFrom);
  }

  if (dateTo) {
    query = query.lte('created_at', dateTo);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(100);

  if (error) {
    throw new Error(`Failed to get admin activity summary: ${error.message}`);
  }

  const logs = (data || []) as AdminLog[];
  const actionCounts: Record<string, number> = {};

  logs.forEach((log) => {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
  });

  return {
    total_actions: logs.length,
    actions_by_type: actionCounts,
    recent_actions: logs.slice(0, 10),
  };
}

/**
 * Export logs to CSV format (string)
 */
export async function exportLogsToCSV(filter: AdminLogFilter): Promise<string> {
  const { logs } = await listAdminLogs({ ...filter, limit: 10000 });

  if (logs.length === 0) {
    return 'id,admin_id,action,resource_type,resource_id,created_at\n';
  }

  const headers = ['id', 'admin_id', 'action', 'resource_type', 'resource_id', 'created_at'];
  const rows = logs.map((log) =>
    [
      log.id,
      log.admin_id,
      log.action,
      log.resource_type,
      log.resource_id || '',
      log.created_at,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`) // CSV escape
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
