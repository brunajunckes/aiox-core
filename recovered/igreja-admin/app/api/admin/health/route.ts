/**
 * System Health Check API Route
 * Story 45.7 — Admin Dashboard System Management
 *
 * GET    /api/admin/health                → System health status (latest checks)
 * POST   /api/admin/health                → Record a new health check
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/middleware/requireRole';
import { recordHealthCheck, getSystemHealthDashboard, getHealthCheckStatus } from '@/lib/features/admin/db';

/**
 * GET /api/admin/health
 * Get current system health status (latest checks for all services)
 * Auth: Not required (public endpoint for monitoring)
 */
export async function GET(request: NextRequest) {
  try {
    const uptime = Math.floor(process.uptime());

    // Get latest health checks from database
    const dashboard = await getSystemHealthDashboard();

    return NextResponse.json(
      {
        success: true,
        data: {
          status: dashboard.overall_status,
          timestamp: dashboard.timestamp,
          uptime,
          checks: dashboard.checks,
        },
      },
      { status: dashboard.overall_status === 'ok' ? 200 : 503 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/admin/health]', error);
    return NextResponse.json(
      {
        success: false,
        data: {
          status: 'down',
          timestamp: new Date().toISOString(),
          uptime: Math.floor(process.uptime()),
          checks: [],
        },
        error: { code: 'HEALTH_CHECK_FAILED', message },
      },
      { status: 503 }
    );
  }
}

/**
 * POST /api/admin/health
 * Record a new health check result
 * Auth: Required + admin/moderator role
 *
 * Body:
 *   {
 *     check_name: string,
 *     status: 'ok' | 'degraded' | 'down' | 'unknown',
 *     latency_ms?: number,
 *     details?: object
 *   }
 */
export const POST = requireRole('admin', 'moderator')(async (request) => {
  try {
    const body = await request.json();

    const { check_name, status, latency_ms, details } = body;

    if (!check_name || !status) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'check_name and status are required',
          },
        },
        { status: 400 }
      );
    }

    // Record the health check
    const record = await recordHealthCheck({
      check_name,
      status,
      latency_ms: latency_ms || null,
      details: details || null,
    });

    return NextResponse.json(
      {
        success: true,
        data: record,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[POST /api/admin/health]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
});
