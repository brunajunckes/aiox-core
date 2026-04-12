/**
 * Admin Dashboard Metrics API Route
 * Story 45.7 — Admin Dashboard System Management
 *
 * GET    /api/admin/dashboard                → Dashboard KPIs + metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/middleware/requireRole';
import { countUsersByRole, getSystemHealthDashboard } from '@/lib/features/admin/db';

/**
 * GET /api/admin/dashboard
 * Get dashboard KPIs and system health summary
 * Auth: Required + admin/moderator role
 */
export const GET = requireRole('admin', 'moderator')(async (request) => {
  try {
    // Get user counts by role
    const userCounts = await countUsersByRole();

    // Get system health
    const health = await getSystemHealthDashboard();

    // Calculate total users
    const totalUsers = Object.values(userCounts).reduce((sum, count) => sum + count, 0);

    // Build dashboard response
    const dashboard = {
      kpis: {
        total_users: totalUsers,
        admins: userCounts.admin,
        moderators: userCounts.moderator,
        church_admins: userCounts.church_admin,
        donors: userCounts.donor,
        members: userCounts.member,
      },
      system_health: health,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        data: dashboard,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/admin/dashboard]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
});
