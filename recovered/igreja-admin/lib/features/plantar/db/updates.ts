/**
 * Plantar Project Updates Database Access Layer
 * Story 45.5 — Plantar Project Management UI + Business Logic
 *
 * CRUD operations for the 'project_updates' table (timeline posts from project owners).
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export interface ProjectUpdate {
  id: string;
  project_id: string;
  author_id: string;
  title: string;
  content: string;
  images: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectUpdateInput {
  project_id: string;
  author_id: string;
  title: string;
  content: string;
  images?: string[];
  is_pinned?: boolean;
}

export interface UpdateProjectUpdateInput {
  title?: string;
  content?: string;
  images?: string[];
  is_pinned?: boolean;
}

/**
 * Create a new project update
 */
export async function createProjectUpdate(
  input: CreateProjectUpdateInput
): Promise<ProjectUpdate> {
  const { data, error } = await supabase
    .from('project_updates')
    .insert([
      {
        project_id: input.project_id,
        author_id: input.author_id,
        title: input.title,
        content: input.content,
        images: input.images || [],
        is_pinned: input.is_pinned || false,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create project update: ${error.message}`);
  }

  return data as ProjectUpdate;
}

/**
 * Get update by ID
 */
export async function getProjectUpdate(id: string): Promise<ProjectUpdate | null> {
  const { data, error } = await supabase
    .from('project_updates')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch update: ${error.message}`);
  }

  return data as ProjectUpdate | null;
}

/**
 * List updates for a project (pinned first, then by date descending)
 */
export async function listProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
  const { data, error } = await supabase
    .from('project_updates')
    .select('*')
    .eq('project_id', projectId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list updates: ${error.message}`);
  }

  return (data as ProjectUpdate[]) || [];
}

/**
 * Update project update
 */
export async function updateProjectUpdate(
  id: string,
  input: UpdateProjectUpdateInput
): Promise<ProjectUpdate> {
  const { data, error } = await supabase
    .from('project_updates')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update project update: ${error.message}`);
  }

  return data as ProjectUpdate;
}

/**
 * Delete project update
 */
export async function deleteProjectUpdate(id: string): Promise<void> {
  const { error } = await supabase
    .from('project_updates')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete project update: ${error.message}`);
  }
}

/**
 * Pin an update (set is_pinned to true)
 */
export async function pinProjectUpdate(id: string): Promise<ProjectUpdate> {
  return updateProjectUpdate(id, { is_pinned: true });
}

/**
 * Unpin an update
 */
export async function unpinProjectUpdate(id: string): Promise<ProjectUpdate> {
  return updateProjectUpdate(id, { is_pinned: false });
}
