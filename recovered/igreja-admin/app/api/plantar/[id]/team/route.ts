/**
 * Plantar Project Team API Routes
 * Story 45.5 — Plantar Project Management UI + Business Logic
 *
 * POST   /api/plantar/[id]/team       → Add team member
 * GET    /api/plantar/[id]/team       → List team members
 * DELETE /api/plantar/[id]/team/[uid] → Remove team member
 * PUT    /api/plantar/[id]/team/[uid] → Update team member role
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { AddTeamMemberSchema, UpdateTeamMemberSchema } from '@/lib/schemas/plantar';
import * as projectsDb from '@/lib/features/plantar/db/projects';
import * as teamDb from '@/lib/features/plantar/db/team';

/**
 * POST /api/plantar/[id]/team
 * Add a new team member to a project
 * Auth: Required, user must be project owner or admin
 */
export const POST = requireAuth(async (request: NextRequest, user) => {
  try {
    const pathname = request.nextUrl.pathname;
    const projectId = pathname.split('/')[3]; // /api/plantar/[id]/team

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

    // Authorization: only project owner or admin can add team members
    if (project.owner_id !== user.userId && user.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You do not have permission to manage team members for this project' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request schema
    const validationResult = AddTeamMemberSchema.safeParse({
      ...body,
      project_id: projectId,
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

    const member = await teamDb.addTeamMember(validationResult.data);

    return NextResponse.json({ success: true, data: member }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/plantar/[id]/team]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
});

/**
 * GET /api/plantar/[id]/team
 * List all team members for a project (public read)
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

    const members = await teamDb.listProjectTeam(projectId);
    const stats = await teamDb.getTeamMemberStats(projectId);

    return NextResponse.json(
      { success: true, data: members, stats },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/plantar/[id]/team]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
