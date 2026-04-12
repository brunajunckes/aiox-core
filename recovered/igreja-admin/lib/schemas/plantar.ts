/**
 * Plantar (Projects) validation schemas
 * Story 45.2 — API Route Scaffolding
 */

import { z } from 'zod';

/**
 * Create project request body
 */
export const CreateProjectSchema = z.object({
  church_id: z.string().uuid('Invalid church ID'),
  owner_id: z.string().uuid('Invalid owner ID'),
  title: z.string().min(3).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().min(1),
  cover_image_url: z.string().url().optional(),
  goal_amount: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('BRL'),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).default('draft'),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
});

export type CreateProjectRequest = z.infer<typeof CreateProjectSchema>;

/**
 * Update project request body
 */
export const UpdateProjectSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  cover_image_url: z.string().url().optional().nullable(),
  goal_amount: z.number().nonnegative().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
});

export type UpdateProjectRequest = z.infer<typeof UpdateProjectSchema>;

/**
 * Create project update request body
 */
export const CreateProjectUpdateSchema = z.object({
  project_id: z.string().uuid(),
  author_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(20000),
  images: z.array(z.string().url()).optional().default([]),
  is_pinned: z.boolean().optional().default(false),
});

export type CreateProjectUpdateRequest = z.infer<typeof CreateProjectUpdateSchema>;

/**
 * Add team member request body
 */
export const AddTeamMemberSchema = z.object({
  project_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['owner', 'lead', 'member', 'viewer']).default('member'),
});

export type AddTeamMemberRequest = z.infer<typeof AddTeamMemberSchema>;

/**
 * Milestone validation schema
 */
export const CreateMilestoneSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  target_amount: z.number().nonnegative().optional(),
  due_date: z.string().date(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  sort_order: z.number().int().nonnegative().optional(),
});

export type CreateMilestoneRequest = z.infer<typeof CreateMilestoneSchema>;

export const UpdateMilestoneSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().optional().nullable(),
  target_amount: z.number().nonnegative().optional(),
  due_date: z.string().date().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  completed_at: z.string().datetime().optional().nullable(),
  sort_order: z.number().int().nonnegative().optional(),
});

export type UpdateMilestoneRequest = z.infer<typeof UpdateMilestoneSchema>;

/**
 * Update team member role request body
 */
export const UpdateTeamMemberSchema = z.object({
  role: z.enum(['owner', 'lead', 'member', 'viewer']),
});

export type UpdateTeamMemberRequest = z.infer<typeof UpdateTeamMemberSchema>;

/**
 * Project response type
 */
export interface ProjectResponse {
  id: string;
  church_id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string;
  cover_image_url?: string;
  goal_amount?: number;
  raised_amount: number;
  currency: string;
  status: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Milestone response type
 */
export interface MilestoneResponse {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  target_amount?: number;
  due_date: string;
  completed_at?: string;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Project update response type
 */
export interface ProjectUpdateResponse {
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

/**
 * Team member response type
 */
export interface TeamMemberResponse {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'lead' | 'member' | 'viewer';
  joined_at: string;
}
