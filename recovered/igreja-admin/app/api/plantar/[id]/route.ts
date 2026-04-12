/**
 * Plantar (Projects) Single Resource Routes
 * Story 45.5 — Plantar Project Management UI + Business Logic
 *
 * GET    /api/plantar/[id]           → Get project details
 * PUT    /api/plantar/[id]           → Update project
 * DELETE /api/plantar/[id]           → Delete/archive project
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { UpdateProjectSchema } from '@/lib/schemas/plantar';
import * as projectsDb from '@/lib/features/plantar/db/projects';

/**
 * GET /api/plantar/[id]
 * Get project details by ID (public read)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id || id === 'updates' || id === 'team' || id === 'milestones' || id === 'funding') {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Invalid project ID' } },
        { status: 400 }
      );
    }

    const project = await projectsDb.getProject(id);

    if (!project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: project }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/plantar/[id]]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/plantar/[id]
 * Update project details
 * Auth: Required, user must be project owner or admin
 */
export const PUT = requireAuth(async (request: NextRequest, user) => {
  try {
    const pathname = request.nextUrl.pathname;
    const parts = pathname.split('/');
    const id = parts[3]; // /api/plantar/[id]

    if (!id || id === 'updates' || id === 'team' || id === 'milestones') {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Invalid project ID' } },
        { status: 400 }
      );
    }

    const project = await projectsDb.getProject(id);
    if (!project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Authorization: only owner or admin can update
    if (project.owner_id !== user.userId && user.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You do not have permission to update this project' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request schema
    const validationResult = UpdateProjectSchema.safeParse(body);
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

    const updated = await projectsDb.updateProject(id, validationResult.data);

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[PUT /api/plantar/[id]]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/plantar/[id]
 * Delete/archive project
 * Auth: Required, user must be project owner or admin
 */
export const DELETE = requireAuth(async (request: NextRequest, user) => {
  try {
    const pathname = request.nextUrl.pathname;
    const parts = pathname.split('/');
    const id = parts[3]; // /api/plantar/[id]

    if (!id) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Invalid project ID' } },
        { status: 400 }
      );
    }

    const project = await projectsDb.getProject(id);
    if (!project) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      );
    }

    // Authorization: only owner or admin can delete
    if (project.owner_id !== user.userId && user.role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You do not have permission to delete this project' } },
        { status: 403 }
      );
    }

    await projectsDb.deleteProject(id);

    return NextResponse.json({ success: true, message: 'Project deleted' }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[DELETE /api/plantar/[id]]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
});
