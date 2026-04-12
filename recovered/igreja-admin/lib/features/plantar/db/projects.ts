/**
 * Plantar Projects Database Access Layer
 * Story 45.5 — Plantar Project Management UI + Business Logic
 *
 * CRUD operations for the 'projects' table with filtering, sorting, and pagination.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export interface Project {
  id: string;
  church_id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string;
  cover_image_url?: string | null;
  goal_amount: number;
  raised_amount: number;
  currency: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  church_id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string;
  cover_image_url?: string | null;
  goal_amount?: number;
  currency?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  start_date?: string | null;
  end_date?: string | null;
}

export interface UpdateProjectInput {
  title?: string;
  slug?: string;
  description?: string;
  cover_image_url?: string | null;
  goal_amount?: number;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  start_date?: string | null;
  end_date?: string | null;
}

export interface ListProjectsFilter {
  church_id?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  owner_id?: string;
  page?: number;
  limit?: number;
}

/**
 * Create a new project
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert([
      {
        church_id: input.church_id,
        owner_id: input.owner_id,
        title: input.title,
        slug: input.slug,
        description: input.description,
        cover_image_url: input.cover_image_url || null,
        goal_amount: input.goal_amount || 0,
        currency: input.currency || 'BRL',
        status: input.status || 'draft',
        start_date: input.start_date || null,
        end_date: input.end_date || null,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create project: ${error.message}`);
  }

  return data as Project;
}

/**
 * Get project by ID
 */
export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = "not found"
    throw new Error(`Failed to fetch project: ${error.message}`);
  }

  return data as Project | null;
}

/**
 * List projects with optional filtering and pagination
 */
export async function listProjects(
  filter: ListProjectsFilter = {}
): Promise<{ data: Project[]; total: number }> {
  const { page = 1, limit = 20, ...filterParams } = filter;
  const offset = (page - 1) * limit;

  let query = supabase.from('projects').select('*', { count: 'exact' });

  // Apply filters
  if (filterParams.church_id) {
    query = query.eq('church_id', filterParams.church_id);
  }
  if (filterParams.status) {
    query = query.eq('status', filterParams.status);
  }
  if (filterParams.owner_id) {
    query = query.eq('owner_id', filterParams.owner_id);
  }

  // Apply sorting and pagination
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list projects: ${error.message}`);
  }

  return {
    data: (data as Project[]) || [],
    total: count || 0,
  };
}

/**
 * Update project
 */
export async function updateProject(
  id: string,
  input: UpdateProjectInput
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update project: ${error.message}`);
  }

  return data as Project;
}

/**
 * Delete (soft delete via status='cancelled') project
 */
export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }
}

/**
 * Get funding summary for a project
 * Returns goal_amount, raised_amount, and calculated progress percentage
 */
export async function getProjectFundingStatus(
  id: string
): Promise<{ goal_amount: number; raised_amount: number; progress: number }> {
  const project = await getProject(id);

  if (!project) {
    throw new Error('Project not found');
  }

  const progress =
    project.goal_amount > 0
      ? Math.round((project.raised_amount / project.goal_amount) * 100)
      : 0;

  return {
    goal_amount: project.goal_amount,
    raised_amount: project.raised_amount,
    progress,
  };
}

/**
 * Check if user is project owner
 */
export async function isProjectOwner(projectId: string, userId: string): Promise<boolean> {
  const project = await getProject(projectId);
  return project?.owner_id === userId;
}
