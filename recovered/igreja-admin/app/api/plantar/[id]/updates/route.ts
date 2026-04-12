/**
 * Plantar Project Updates API Routes
 * Story 45.5 — Plantar Project Management UI + Business Logic
 *
 * POST   /api/plantar/[id]/updates       → Create project update
 * GET    /api/plantar/[id]/updates       → List project updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { CreateProjectUpdateSchema } from '@/lib/schemas/plantar';
import * as projectsDb from '@/lib/features/plantar/db/projects';
import * as updatesDb from '@/lib/features/plantar/db/updates';
import * as teamDb from '@/lib/features/plantar/db/team';

/**
 * POST /api/plantar/[id]/updates
 * Create a new project update
 * Auth: Required, user must be project owner or team member with lead role
 */
export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const pathname = request.nextUrl.pathname;
    const projectId = pathname.split('/')[3]; // /api/plantar/[id]/updates

    if (!projectId) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Invalid project ID' } },
        { status: 400 }
      );
    }

    const project = await projectsDb.getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Authorization: only project owner, admin, or lead team members can create updates
    const isOwner = project.owner_id === user.userId;
    const isAdmin = user.role === 'admin';
    let isTeamLead = false;

    if (!isOwner && !isAdmin) {
      const teamMember = await teamDb.getTeamMember(projectId, user.userId);
      isTeamLead = teamMember?.role === 'lead';
    }

    if (!isOwner && !isAdmin && !isTeamLead) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You do not have permission to create updates for this project' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request schema
    const validationResult = CreateProjectUpdateSchema.safeParse({
      ...body,
      project_id: projectId,
      author_id: user.userId,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validationResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const update = await updatesDb.createProjectUpdate(validationResult.data);

    return NextResponse.json({ success: true, data: update }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/plantar/[id]/updates]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
});

/**
 * GET /api/plantar/[id]/updates
 * List all updates for a project (public read)
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projectId = params.id;

    if (!projectId) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Invalid project ID' } },
        { status: 400 }
      );
    }

    const project = await projectsDb.getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    const updates = await updatesDb.listProjectUpdates(projectId);

    return NextResponse.json(
      { success: true, data: updates },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/plantar/[id]/updates]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
