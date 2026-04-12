/**
 * Plantar Project Milestones Database Access Layer
 * Story 45.5 — Plantar Project Management UI + Business Logic
 *
 * CRUD operations for the 'project_milestones' table with ordering and filtering.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  target_amount?: number | null;
  due_date: string;
  completed_at?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMilestoneInput {
  project_id: string;
  title: string;
  description?: string | null;
  target_amount?: number | null;
  due_date: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  sort_order?: number;
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string | null;
  target_amount?: number | null;
  due_date?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completed_at?: string | null;
  sort_order?: number;
}

/**
 * Create a new milestone
 */
export async function createMilestone(input: CreateMilestoneInput): Promise<Milestone> {
  // Get the next sort order for this project
  const { data: lastMilestone } = await supabase
    .from('project_milestones')
    .select('sort_order')
    .eq('project_id', input.project_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const nextSort = ((lastMilestone?.sort_order as number) || 0) + 1;

  const { data, error } = await supabase
    .from('project_milestones')
    .insert([
      {
        project_id: input.project_id,
        title: input.title,
        description: input.description || null,
        target_amount: input.target_amount || null,
        due_date: input.due_date,
        status: input.status || 'pending',
        sort_order: input.sort_order ?? nextSort,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create milestone: ${error.message}`);
  }

  return data as Milestone;
}

/**
 * Get milestone by ID
 */
export async function getMilestone(id: string): Promise<Milestone | null> {
  const { data, error } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch milestone: ${error.message}`);
  }

  return data as Milestone | null;
}

/**
 * List milestones for a project, sorted by due_date
 */
export async function listProjectMilestones(projectId: string): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from('project_milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to list milestones: ${error.message}`);
  }

  return (data as Milestone[]) || [];
}

/**
 * Update milestone
 */
export async function updateMilestone(
  id: string,
  input: UpdateMilestoneInput
): Promise<Milestone> {
  // If status is being changed to 'completed', set completed_at timestamp
  const updateData = { ...input };
  if (input.status === 'completed' && !input.completed_at) {
    updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('project_milestones')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update milestone: ${error.message}`);
  }

  return data as Milestone;
}

/**
 * Delete milestone
 */
export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabase
    .from('project_milestones')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete milestone: ${error.message}`);
  }
}

/**
 * Get milestone completion percentage (completed / total)
 */
export async function getMilestoneProgress(projectId: string): Promise<{
  completed: number;
  total: number;
  percentage: number;
}> {
  const milestones = await listProjectMilestones(projectId);

  const completed = milestones.filter((m) => m.status === 'completed').length;
  const total = milestones.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, total, percentage };
}
