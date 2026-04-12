/**
 * User Roles Management API Routes
 * Story 45.7 — Admin Dashboard System Management
 *
 * GET    /api/admin/users/[userId]/roles      → Get user roles
 * POST   /api/admin/users/[userId]/roles      → Assign role to user
 * DELETE /api/admin/users/[userId]/roles      → Revoke role from user
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/middleware/requireRole';
import { assignRole, revokeRole, getUserRoles, getUserRolesWithHistory, createAdminLog } from '@/lib/features/admin/db';
import { AssignRoleSchema } from '@/lib/schemas/admin';
import { UserRole } from '@/lib/auth/types';

/**
 * Helper to extract userId from path
 */
function getUserIdFromPath(pathname: string): string {
  const parts = pathname.split('/');
  const userIdIndex = parts.findIndex((p) => p === 'users');
  return userIdIndex >= 0 ? parts[userIdIndex + 1] : '';
}

/**
 * GET /api/admin/users/[userId]/roles
 * Get all active roles for a user
 * Auth: Required + admin/moderator role
 */
export const GET = requireRole('admin', 'moderator')(async (request: NextRequest, user) => {
  try {
    const userId = getUserIdFromPath(request.nextUrl.pathname);

    if (!userId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'userId is required' } },
        { status: 400 }
      );
    }

    // Get user's active roles
    const roles = await getUserRoles(userId);

    // Include role history if requested
    const includeHistory = new URL(request.url).searchParams.get('history') === 'true';
    if (includeHistory) {
      const history = await getUserRolesWithHistory(userId);
      return NextResponse.json(
        {
          success: true,
          data: {
            active_roles: roles,
            history,
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: roles,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/admin/users/[userId]/roles]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
});

/**
 * POST /api/admin/users/[userId]/roles
 * Assign a role to a user
 * Auth: Required + admin role (only admin can assign roles)
 *
 * Body:
 *   {
 *     role: UserRole,
 *     scope_type?: string,
 *     scope_id?: string
 *   }
 */
export const POST = requireRole('admin')(async (request: NextRequest, user) => {
  try {
    const userId = getUserIdFromPath(request.nextUrl.pathname);

    if (!userId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'userId is required' } },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validationResult = AssignRoleSchema.safeParse({
      user_id: userId,
      role: body.role,
      scope_type: body.scope_type,
      scope_id: body.scope_id,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validationResult.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const { role, scope_type, scope_id } = validationResult.data;

    // Assign the role
    const roleRecord = await assignRole({
      user_id: userId,
      role: role as UserRole,
      scope_type: scope_type || null,
      scope_id: scope_id || null,
      granted_by: user.userId,
    });

    // Log this action to admin_logs
    try {
      await createAdminLog({
        admin_id: user.userId,
        action: 'role_grant',
        resource_type: 'user',
        resource_id: userId,
        new_values: {
          role,
          scope_type,
          scope_id,
        },
        ip_address: request.headers.get('x-forwarded-for') || request.ip || 'unknown',
        user_agent: request.headers.get('user-agent') || '',
      });
    } catch (logError) {
      console.error('Failed to log role assignment:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json(
      {
        success: true,
        data: roleRecord,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/admin/users/[userId]/roles]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/admin/users/[userId]/roles
 * Revoke a role from a user (soft delete)
 * Auth: Required + admin role
 *
 * Query params:
 *   - role: UserRole (required)
 *   - scope_type?: string
 *   - scope_id?: string
 */
export const DELETE = requireRole('admin')(async (request: NextRequest, user) => {
  try {
    const userId = getUserIdFromPath(request.nextUrl.pathname);
    const { searchParams } = new URL(request.url);

    if (!userId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'userId is required' } },
        { status: 400 }
      );
    }

    const role = searchParams.get('role') as UserRole | null;
    const scopeType = searchParams.get('scope_type');
    const scopeId = searchParams.get('scope_id');

    if (!role) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'role query param is required' } },
        { status: 400 }
      );
    }

    // Revoke the role
    const revokedRole = await revokeRole({
      user_id: userId,
      role,
      scope_type: scopeType || null,
      scope_id: scopeId || null,
    });

    if (!revokedRole) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Role assignment not found or already revoked',
          },
        },
        { status: 404 }
      );
    }

    // Log this action to admin_logs
    try {
      await createAdminLog({
        admin_id: user.userId,
        action: 'role_revoke',
        resource_type: 'user',
        resource_id: userId,
        old_values: {
          role,
          scope_type: scopeType,
          scope_id: scopeId,
        },
        ip_address: request.headers.get('x-forwarded-for') || request.ip || 'unknown',
        user_agent: request.headers.get('user-agent') || '',
      });
    } catch (logError) {
      console.error('Failed to log role revocation:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json(
      {
        success: true,
        data: revokedRole,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[DELETE /api/admin/users/[userId]/roles]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
});
