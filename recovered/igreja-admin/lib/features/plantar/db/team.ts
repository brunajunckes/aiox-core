/**
 * Plantar Project Team Management Database Access Layer
 * Story 45.5 — Plantar Project Management UI + Business Logic
 *
 * CRUD operations for the 'project_team' table (M:N relationship between projects and team members).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export interface TeamMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'lead' | 'member' | 'viewer';
  joined_at: string;
}

export interface TeamMemberWithProfile extends TeamMember {
  user_name?: string;
  user_email?: string;
}

export interface AddTeamMemberInput {
  project_id: string;
  user_id: string;
  role?: 'owner' | 'lead' | 'member' | 'viewer';
}

export interface UpdateTeamMemberInput {
  role?: 'owner' | 'lead' | 'member' | 'viewer';
}

/**
 * Add a team member to a project
 */
export async function addTeamMember(input: AddTeamMemberInput): Promise<TeamMember> {
  // Check if user is already on the team
  const existing = await getTeamMember(input.project_id, input.user_id);
  if (existing) {
    throw new Error('User is already a team member of this project');
  }

  const { data, error } = await supabase
    .from('project_team')
    .insert([
      {
        project_id: input.project_id,
        user_id: input.user_id,
        role: input.role || 'member',
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add team member: ${error.message}`);
  }

  return data as TeamMember;
}

/**
 * Get a specific team member
 */
export async function getTeamMember(
  projectId: string,
  userId: string
): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('project_team')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch team member: ${error.message}`);
  }

  return data as TeamMember | null;
}

/**
 * List all team members for a project
 */
export async function listProjectTeam(projectId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('project_team')
    .select('*')
    .eq('project_id', projectId)
    .order('role', { ascending: true });

  if (error) {
    throw new Error(`Failed to list team members: ${error.message}`);
  }

  return (data as TeamMember[]) || [];
}

/**
 * List team members with role filter
 */
export async function listProjectTeamByRole(
  projectId: string,
  role: 'owner' | 'lead' | 'member' | 'viewer'
): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('project_team')
    .select('*')
    .eq('project_id', projectId)
    .eq('role', role);

  if (error) {
    throw new Error(`Failed to list team members by role: ${error.message}`);
  }

  return (data as TeamMember[]) || [];
}

/**
 * Update team member role
 */
export async function updateTeamMember(
  projectId: string,
  userId: string,
  input: UpdateTeamMemberInput
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('project_team')
    .update(input)
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update team member: ${error.message}`);
  }

  return data as TeamMember;
}

/**
 * Remove a team member from a project
 */
export async function removeTeamMember(projectId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('project_team')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to remove team member: ${error.message}`);
  }
}

/**
 * Check if user has specific role on the project
 */
export async function userHasRole(
  projectId: string,
  userId: string,
  role: 'owner' | 'lead' | 'member' | 'viewer'
): Promise<boolean> {
  const member = await getTeamMember(projectId, userId);
  return member?.role === role;
}

/**
 * Check if user is at least a specific role level
 * Role hierarchy: owner > lead > member > viewer
 */
export function hasMinimumTeamRole(
  userRole: 'owner' | 'lead' | 'member' | 'viewer' | null | undefined,
  minimumRole: 'owner' | 'lead' | 'member' | 'viewer'
): boolean {
  const roleHierarchy = { owner: 4, lead: 3, member: 2, viewer: 1 } as const;
  const userLevel = userRole ? roleHierarchy[userRole] : 0;
  const minimumLevel = roleHierarchy[minimumRole];
  return userLevel >= minimumLevel;
}

/**
 * Get team member count by role
 */
export async function getTeamMemberStats(projectId: string): Promise<Record<string, number>> {
  const team = await listProjectTeam(projectId);
  const stats = {
    owner: team.filter((m) => m.role === 'owner').length,
    lead: team.filter((m) => m.role === 'lead').length,
    member: team.filter((m) => m.role === 'member').length,
    viewer: team.filter((m) => m.role === 'viewer').length,
    total: team.length,
  };
  return stats;
}
