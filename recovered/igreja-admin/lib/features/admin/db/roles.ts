/**
 * User Roles Database Access Layer
 * Story 45.7 — Admin Dashboard System Management
 *
 * RBAC role assignments per user, with optional scoping to church/community/project.
 * Supports role hierarchy and soft revocation (by setting revoked_at timestamp).
 */

import { createClient } from '@supabase/supabase-js';
import { UserRole } from '@/lib/auth/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * User role assignment record from database
 */
export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  scope_type?: string | null; // e.g., 'church', 'community', 'project'
  scope_id?: string | null; // UUID of the scoped entity
  granted_by?: string | null; // User who granted the role
  granted_at: string; // ISO 8601 timestamp
  revoked_at?: string | null; // ISO 8601 timestamp (soft delete)
}

/**
 * Input to assign a role to a user
 */
export interface AssignRoleInput {
  user_id: string;
  role: UserRole;
  scope_type?: string | null;
  scope_id?: string | null;
  granted_by?: string; // Admin user ID
}

/**
 * Input to revoke a role (soft delete by setting revoked_at)
 */
export interface RevokeRoleInput {
  user_id: string;
  role: UserRole;
  scope_type?: string | null;
  scope_id?: string | null;
}

/**
 * Role hierarchy for permission checks
 * Higher index = higher privilege
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  member: 0,
  donor: 1,
  church_admin: 2,
  moderator: 3,
  admin: 4,
};

/**
 * Check if roleA is >= roleB in hierarchy
 */
export function isRoleGreaterOrEqual(roleA: UserRole, roleB: UserRole): boolean {
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
}

/**
 * Assign a role to a user
 * If role + scope already exists and is revoked, reactivate it.
 * Otherwise create a new assignment.
 */
export async function assignRole(input: AssignRoleInput): Promise<UserRoleRecord> {
  // Try to find existing assignment (revoked or not)
  const { data: existing } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', input.user_id)
    .eq('role', input.role)
    .eq('scope_type', input.scope_type || null)
    .eq('scope_id', input.scope_id || null)
    .maybeSingle();

  if (existing) {
    // Reactivate if revoked, or just return if already active
    if (existing.revoked_at) {
      const { data, error } = await supabase
        .from('user_roles')
        .update({ revoked_at: null })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to reactivate role: ${error.message}`);
      }

      return data as UserRoleRecord;
    }

    // Already active, return as-is
    return existing as UserRoleRecord;
  }

  // Create new assignment
  const { data, error } = await supabase
    .from('user_roles')
    .insert([
      {
        user_id: input.user_id,
        role: input.role,
        scope_type: input.scope_type || null,
        scope_id: input.scope_id || null,
        granted_by: input.granted_by || null,
        granted_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to assign role: ${error.message}`);
  }

  return data as UserRoleRecord;
}

/**
 * Revoke a role from a user (soft delete: set revoked_at timestamp)
 */
export async function revokeRole(input: RevokeRoleInput): Promise<UserRoleRecord | null> {
  const { data, error } = await supabase
    .from('user_roles')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', input.user_id)
    .eq('role', input.role)
    .eq('scope_type', input.scope_type || null)
    .eq('scope_id', input.scope_id || null)
    .eq('revoked_at', null) // Only revoke if not already revoked
    .select()
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to revoke role: ${error.message}`);
  }

  return data ? (data as UserRoleRecord) : null;
}

/**
 * Get all active roles for a user (excluding revoked)
 */
export async function getUserRoles(userId: string): Promise<UserRoleRecord[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null) // Only active roles
    .order('granted_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get user roles: ${error.message}`);
  }

  return (data || []) as UserRoleRecord[];
}

/**
 * Get all roles for a user, including revoked (for audit trail)
 */
export async function getUserRolesWithHistory(userId: string): Promise<UserRoleRecord[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .order('granted_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get user role history: ${error.message}`);
  }

  return (data || []) as UserRoleRecord[];
}

/**
 * Check if user has a specific role (considering hierarchy)
 * If scopeType/scopeId provided, checks for scoped role. Otherwise checks global.
 */
export async function userHasRole(
  userId: string,
  requiredRole: UserRole,
  scopeType?: string | null,
  scopeId?: string | null
): Promise<boolean> {
  const roles = await getUserRoles(userId);

  // Check for exact role match (global or scoped)
  const match = roles.find((r) => r.role === requiredRole && r.scope_type === scopeType && r.scope_id === scopeId);
  if (match) {
    return true;
  }

  // Check for higher-privilege role (only if looking for global scope)
  if (!scopeType && !scopeId) {
    const higherRole = roles.find((r) => !r.scope_type && isRoleGreaterOrEqual(r.role, requiredRole));
    return !!higherRole;
  }

  return false;
}

/**
 * Get the highest privilege role for a user (considering hierarchy)
 */
export async function getUserHighestRole(userId: string): Promise<UserRole | null> {
  const roles = await getUserRoles(userId);

  if (roles.length === 0) {
    return null;
  }

  // Find role with highest hierarchy index
  return roles.reduce((highest, current) => {
    if (ROLE_HIERARCHY[current.role] > ROLE_HIERARCHY[highest]) {
      return current.role;
    }
    return highest;
  }, roles[0].role);
}

/**
 * List all users with a specific role (global or scoped)
 */
export async function getUsersByRole(
  role: UserRole,
  scopeType?: string | null,
  scopeId?: string | null,
  limit: number = 100
): Promise<{ user_id: string; role: UserRole; granted_at: string }[]> {
  let query = supabase.from('user_roles').select('user_id, role, granted_at').eq('role', role).is('revoked_at', null);

  if (scopeType !== undefined) {
    query = query.eq('scope_type', scopeType);
  }

  if (scopeId !== undefined) {
    query = query.eq('scope_id', scopeId);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    throw new Error(`Failed to list users by role: ${error.message}`);
  }

  return data || [];
}

/**
 * Get role assignment history for audit purposes
 */
export async function getRoleAssignmentHistory(
  userId: string,
  limit: number = 50
): Promise<UserRoleRecord[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .order('granted_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get role assignment history: ${error.message}`);
  }

  return (data || []) as UserRoleRecord[];
}

/**
 * Count users by role (for dashboard metrics)
 */
export async function countUsersByRole(): Promise<Record<UserRole, number>> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .is('revoked_at', null);

  if (error) {
    throw new Error(`Failed to count users by role: ${error.message}`);
  }

  const counts: Record<UserRole, number> = {
    admin: 0,
    moderator: 0,
    church_admin: 0,
    donor: 0,
    member: 0,
  };

  (data || []).forEach((record) => {
    const role = record.role as UserRole;
    counts[role]++;
  });

  return counts;
}
