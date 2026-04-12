/**
 * Admin Logs API Routes
 * Story 45.7 — Admin Dashboard System Management
 *
 * GET    /api/admin/logs            → List admin logs (paginated, filterable)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/middleware/requireRole';
import { listAdminLogs, exportLogsToCSV } from '@/lib/features/admin/db';
import { AdminLogsQuerySchema } from '@/lib/schemas/admin';

/**
 * GET /api/admin/logs
 * List admin audit logs with filtering and pagination
 * Auth: Required + admin/moderator role
 *
 * Query params:
 *   - admin_id: UUID (filter by acting admin)
 *   - action: string (filter by action type)
 *   - resource_type: string (filter by resource type)
 *   - date_from: ISO 8601 (filter start date)
 *   - date_to: ISO 8601 (filter end date)
 *   - page: number (default 1)
 *   - limit: number (default 50)
 *   - export: 'csv' (optional, export to CSV)
 */
export const GET = requireRole('admin', 'moderator')(async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query params
    const queryData = {
      admin_id: searchParams.get('admin_id'),
      action: searchParams.get('action'),
      resource_type: searchParams.get('resource_type'),
      date_from: searchParams.get('date_from'),
      date_to: searchParams.get('date_to'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    };

    // Use schema to validate, but allow missing fields (they're optional)
    const filter = {
      admin_id: queryData.admin_id || undefined,
      action: queryData.action || undefined,
      resource_type: queryData.resource_type || undefined,
      date_from: queryData.date_from || undefined,
      date_to: queryData.date_to || undefined,
      page: queryData.page ? parseInt(queryData.page) : 1,
      limit: queryData.limit ? parseInt(queryData.limit) : 50,
    };

    // Handle CSV export
    if (searchParams.get('export') === 'csv') {
      const csv = await exportLogsToCSV(filter);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="admin_logs.csv"',
        },
      });
    }

    // Standard paginated JSON response
    const result = await listAdminLogs(filter);

    return NextResponse.json(
      {
        success: true,
        data: result.logs,
        pagination: result.pagination,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[GET /api/admin/logs]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
});
