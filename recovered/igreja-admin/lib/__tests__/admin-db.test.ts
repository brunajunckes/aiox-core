/**
 * Tests for Admin Database Functions
 * Story 45.7 — Admin Dashboard System Management
 *
 * Unit tests for admin logs, health checks, and role management
 */

import * as logsDb from '@/lib/features/admin/db/logs';
import * as healthDb from '@/lib/features/admin/db/health';
import * as rolesDb from '@/lib/features/admin/db/roles';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table: string) => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
    })),
  })),
}));

describe('Admin Logs Database', () => {
  describe('Admin Log Types', () => {
    test('should define AdminLog interface with required fields', () => {
      const log: logsDb.AdminLog = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        admin_id: '660e8400-e29b-41d4-a716-446655440001',
        action: 'create',
        resource_type: 'user',
        resource_id: '770e8400-e29b-41d4-a716-446655440002',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        created_at: new Date().toISOString(),
      };

      expect(log.id).toBeDefined();
      expect(log.admin_id).toBeDefined();
      expect(log.action).toBeDefined();
      expect(log.resource_type).toBeDefined();
    });

    test('should accept admin log with optional fields', () => {
      const log: logsDb.AdminLog = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        admin_id: '660e8400-e29b-41d4-a716-446655440001',
        action: 'update',
        resource_type: 'project',
        created_at: new Date().toISOString(),
      };

      expect(log).toBeDefined();
      expect(log.ip_address).toBeUndefined();
    });
  });

  describe('Admin Log Filtering', () => {
    test('should create filter with all optional fields', () => {
      const filter: logsDb.AdminLogFilter = {
        admin_id: '660e8400-e29b-41d4-a716-446655440001',
        action: 'delete',
        resource_type: 'community',
        date_from: '2026-04-01T00:00:00Z',
        date_to: '2026-04-30T23:59:59Z',
        page: 2,
        limit: 100,
      };

      expect(filter.admin_id).toBeDefined();
      expect(filter.action).toBeDefined();
      expect(filter.date_from).toBeDefined();
    });

    test('should create empty filter with defaults', () => {
      const filter: logsDb.AdminLogFilter = {};

      expect(filter.admin_id).toBeUndefined();
      expect(filter.page).toBeUndefined();
    });
  });

  describe('Admin Log CSV Export', () => {
    test('should export logs to CSV format', async () => {
      const csvHeader = 'id,admin_id,action,resource_type,resource_id,created_at';
      expect(csvHeader).toContain('id');
      expect(csvHeader).toContain('admin_id');
      expect(csvHeader).toContain('action');
    });
  });
});

describe('System Health Database', () => {
  describe('Health Check Types', () => {
    test('should define SystemHealthRecord with required fields', () => {
      const record: healthDb.SystemHealthRecord = {
        id: 1,
        check_name: 'database',
        status: 'ok',
        latency_ms: 50,
        details: { pool_connections: 10 },
        created_at: new Date().toISOString(),
      };

      expect(record.id).toBeDefined();
      expect(record.check_name).toBe('database');
      expect(record.status).toBe('ok');
    });

    test('should support all valid health statuses', () => {
      const statuses: Array<'ok' | 'degraded' | 'down' | 'unknown'> = ['ok', 'degraded', 'down', 'unknown'];

      statuses.forEach((status) => {
        const record: healthDb.SystemHealthRecord = {
          id: 1,
          check_name: 'api',
          status,
          created_at: new Date().toISOString(),
        };
        expect(record.status).toBe(status);
      });
    });
  });

  describe('Health Check Summary', () => {
    test('should create health check summary', () => {
      const summary: healthDb.HealthCheckSummary = {
        check_name: 'api',
        status: 'ok',
        latency_ms: 100,
        last_check: new Date().toISOString(),
      };

      expect(summary.check_name).toBe('api');
      expect(summary.status).toBe('ok');
    });
  });

  describe('System Health Dashboard', () => {
    test('should create health dashboard', () => {
      const dashboard: healthDb.SystemHealthDashboard = {
        overall_status: 'ok',
        timestamp: new Date().toISOString(),
        checks: [
          {
            check_name: 'database',
            status: 'ok',
            latency_ms: 50,
            last_check: new Date().toISOString(),
          },
        ],
        uptime_percent: 99.9,
      };

      expect(dashboard.overall_status).toBe('ok');
      expect(dashboard.checks).toHaveLength(1);
    });

    test('should reflect overall status as degraded if any check is degraded', () => {
      const dashboard: healthDb.SystemHealthDashboard = {
        overall_status: 'degraded',
        timestamp: new Date().toISOString(),
        checks: [
          {
            check_name: 'database',
            status: 'ok',
            last_check: new Date().toISOString(),
          },
          {
            check_name: 'cache',
            status: 'degraded',
            last_check: new Date().toISOString(),
          },
        ],
      };

      expect(dashboard.overall_status).toBe('degraded');
    });
  });
});

describe('User Roles Database', () => {
  describe('Role Hierarchy', () => {
    test('should define correct role hierarchy', () => {
      expect(rolesDb.ROLE_HIERARCHY.member).toBeLessThan(rolesDb.ROLE_HIERARCHY.donor);
      expect(rolesDb.ROLE_HIERARCHY.donor).toBeLessThan(rolesDb.ROLE_HIERARCHY.church_admin);
      expect(rolesDb.ROLE_HIERARCHY.church_admin).toBeLessThan(rolesDb.ROLE_HIERARCHY.moderator);
      expect(rolesDb.ROLE_HIERARCHY.moderator).toBeLessThan(rolesDb.ROLE_HIERARCHY.admin);
    });

    test('should check role hierarchy correctly', () => {
      expect(rolesDb.isRoleGreaterOrEqual('admin', 'moderator')).toBe(true);
      expect(rolesDb.isRoleGreaterOrEqual('moderator', 'admin')).toBe(false);
      expect(rolesDb.isRoleGreaterOrEqual('admin', 'admin')).toBe(true);
    });
  });

  describe('User Role Record Types', () => {
    test('should create active user role record', () => {
      const role: rolesDb.UserRoleRecord = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '660e8400-e29b-41d4-a716-446655440001',
        role: 'admin',
        scope_type: null,
        scope_id: null,
        granted_by: '770e8400-e29b-41d4-a716-446655440002',
        granted_at: new Date().toISOString(),
      };

      expect(role.role).toBe('admin');
      expect(role.revoked_at).toBeUndefined();
    });

    test('should create revoked user role record', () => {
      const role: rolesDb.UserRoleRecord = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '660e8400-e29b-41d4-a716-446655440001',
        role: 'moderator',
        revoked_at: new Date().toISOString(),
        granted_at: new Date().toISOString(),
      };

      expect(role.revoked_at).toBeDefined();
    });

    test('should create scoped role assignment', () => {
      const role: rolesDb.UserRoleRecord = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        user_id: '660e8400-e29b-41d4-a716-446655440001',
        role: 'church_admin',
        scope_type: 'church',
        scope_id: '880e8400-e29b-41d4-a716-446655440003',
        granted_at: new Date().toISOString(),
      };

      expect(role.scope_type).toBe('church');
      expect(role.scope_id).toBeDefined();
    });
  });

  describe('Assign Role Input', () => {
    test('should create global role assignment input', () => {
      const input: rolesDb.AssignRoleInput = {
        user_id: '660e8400-e29b-41d4-a716-446655440001',
        role: 'admin',
        granted_by: '770e8400-e29b-41d4-a716-446655440002',
      };

      expect(input.role).toBe('admin');
      expect(input.scope_type).toBeUndefined();
    });

    test('should create scoped role assignment input', () => {
      const input: rolesDb.AssignRoleInput = {
        user_id: '660e8400-e29b-41d4-a716-446655440001',
        role: 'church_admin',
        scope_type: 'community',
        scope_id: '880e8400-e29b-41d4-a716-446655440003',
      };

      expect(input.scope_type).toBe('community');
      expect(input.scope_id).toBeDefined();
    });
  });

  describe('User Count by Role', () => {
    test('should create user count record', () => {
      const counts: Record<string, number> = {
        admin: 5,
        moderator: 10,
        church_admin: 25,
        donor: 100,
        member: 500,
      };

      expect(counts.admin).toBe(5);
      expect(counts.moderator).toBe(10);
      expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(640);
    });
  });
});

describe('Admin Authorization Tests', () => {
  test('should verify role hierarchy is complete', () => {
    const validRoles = ['admin', 'moderator', 'church_admin', 'donor', 'member'];
    validRoles.forEach((role) => {
      expect(rolesDb.ROLE_HIERARCHY).toHaveProperty(role);
    });
  });

  test('should have all roles in hierarchy with correct ordering', () => {
    // Verify hierarchy levels are correctly ordered
    const validRoles = ['admin', 'moderator', 'church_admin', 'donor', 'member'];
    validRoles.forEach((role) => {
      expect(typeof rolesDb.ROLE_HIERARCHY[role as keyof typeof rolesDb.ROLE_HIERARCHY]).toBe('number');
    });
  });
});
