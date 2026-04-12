/**
 * Plantar (Projects) API Routes
 * Story 45.5 — Plantar Project Management UI + Business Logic
 *
 * POST   /api/plantar               → Create project
 * GET    /api/plantar               → List projects
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/requireAuth';
import { requirePermission } from '@/lib/middleware/requirePermission';
import { CreateProjectSchema } from '@/lib/schemas/plantar';
import * as projectsDb from '@/lib/features/plantar/db/projects';

/**
 * POST /api/plantar
 * Create a new project
 * Auth: Required, permission: plantar:create_project
 */
export const POST = requirePermission('plantar:create_project')(
  async (request: NextRequest, user) => {
    try {
      const body = await request.json();

      // Validate request schema
      const validationResult = CreateProjectSchema.safeParse(body);
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

      const validated = validationResult.data;

      // Verify user is in the church they're creating a project for
      if (user.churchId && validated.church_id !== user.churchId && user.role !== 'admin') {
        return NextResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission to create projects for this church',
            },
          },
          { status: 403 }
        );
      }

      // Create project
      const project = await projectsDb.createProject({
        ...validated,
        owner_id: user.userId, // Owner is the authenticated user
      });

      return NextResponse.json({ success: true, data: project }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      console.error('[POST /api/plantar]', error);
      return NextResponse.json(
        {
          error: { code: 'INTERNAL_ERROR', message },
        },
        { status: 500 }
      );
    }
  }
);

/**
 * GET /api/plantar
 * List all projects (with optional filtering)
 * Auth: Not required (public read), but filtering may be restricted
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filter: Parameters<typeof projectsDb.listProjects>[0] = {
      church_id: searchParams.get('church_id') || undefined,
      status: (searchParams.get('status') as any) || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    };

    // Remove undefined values
    Object.keys(filter).forEach((key) => filter[key as keyof typeof filter] === undefined && delete filter[key as keyof typeof filter]);

    const { data, total } = await projectsDb.listProjects(filter);

    return NextResponse.json(
      {
        success: true,
        data,
        pagination: {
          page: filter.page,
          limit: filter.limit,
          total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/plantar]', error);
    return NextResponse.json(
      {
        error: { code: 'INTERNAL_ERROR', message },
      },
      { status: 500 }
    );
  }
}
