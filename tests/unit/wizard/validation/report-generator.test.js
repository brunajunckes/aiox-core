/**
 * Unit Tests: Report Generator
 * Story 1.8 - Task 1.8.5 (QA Fix - Coverage Improvement)
 */

const { generateReport } = require('../../../../src/wizard/validation/report-generator');

describe('Report Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReport', () => {
    it('should generate report for successful validation', async () => {
      // Given
      const validationResults = {
        timestamp: new Date().toISOString(),
        components: {
          files: {
            success: true,
            checks: [
              { component: 'IDE Config', status: 'success', message: 'Created' },
            ],
            errors: [],
            warnings: [],
          },
          configs: {
            success: true,
            checks: [],
            errors: [],
            warnings: [],
          },
          mcps: {
            success: true,
            healthChecks: [],
            errors: [],
            warnings: [],
          },
          dependencies: {
            success: true,
            checks: [],
            errors: [],
            warnings: [],
          },
        },
        errors: [],
        warnings: [],
        overallStatus: 'success',
      };

      // When
      const report = await generateReport(validationResults);

      // Then
      expect(report).toContain('Installation Validation Report');
      expect(report).toContain('Overall Status');
      expect(report).toContain('SUCCESS');
    });

    it('should generate report with warnings', async () => {
      // Given
      const validationResults = {
        components: {
          files: { success: true, checks: [], errors: [], warnings: [] },
          configs: { success: true, checks: [], errors: [], warnings: [] },
          mcps: { success: true, healthChecks: [], errors: [], warnings: [] },
          dependencies: { success: true, checks: [], errors: [], warnings: [] },
        },
        errors: [],
        warnings: [
          { component: 'mcps', severity: 'medium', message: 'MCP health check timeout' },
        ],
        overallStatus: 'warning',
      };

      // When
      const report = await generateReport(validationResults);

      // Then
      expect(report).toContain('Warnings');
      expect(report).toContain('MCP health check timeout');
    });

    it('should generate report with errors', async () => {
      // Given
      const validationResults = {
        components: {
          files: { success: false, checks: [], errors: [], warnings: [] },
          configs: { success: true, checks: [], errors: [], warnings: [] },
          mcps: { success: true, healthChecks: [], errors: [], warnings: [] },
          dependencies: { success: true, checks: [], errors: [], warnings: [] },
        },
        errors: [
          { component: 'files', severity: 'critical', message: '.env file missing' },
        ],
        warnings: [],
        overallStatus: 'failed',
      };

      // When
      const report = await generateReport(validationResults);

      // Then
      expect(report).toContain('Errors');
      expect(report).toContain('.env file missing');
      expect(report).toContain('FAILED');
    });

    it('should generate report with mixed results', async () => {
      // Given
      const validationResults = {
        components: {
          files: { success: true, checks: [], errors: [], warnings: [] },
          configs: { success: false, checks: [], errors: [], warnings: [] },
          mcps: { success: true, healthChecks: [], errors: [], warnings: [] },
          dependencies: { success: true, checks: [], errors: [], warnings: [] },
        },
        errors: [
          { component: 'configs', severity: 'high', message: 'YAML parse error' },
        ],
        warnings: [
          { component: 'dependencies', severity: 'low', message: '3 vulnerabilities' },
        ],
        overallStatus: 'partial',
      };

      // When
      const report = await generateReport(validationResults);

      // Then
      expect(report).toContain('Errors');
      expect(report).toContain('Warnings');
      expect(report).toContain('YAML parse error');
      expect(report).toContain('3 vulnerabilities');
    });

    it('should format file validation results correctly', async () => {
      // Given
      const validationResults = {
        components: {
          files: {
            success: true,
            checks: [
              { component: 'IDE Config', file: '.cursor/settings.json', status: 'success', message: 'Created' },
              { component: 'Environment', file: '.env', status: 'success', message: 'Created' },
            ],
            errors: [],
            warnings: [],
          },
          configs: { success: true, checks: [], errors: [], warnings: [] },
          mcps: { success: true, healthChecks: [], errors: [], warnings: [] },
          dependencies: { success: true, checks: [], errors: [], warnings: [] },
        },
        errors: [],
        warnings: [],
        overallStatus: 'success',
      };

      // When
      const report = await generateReport(validationResults);

      // Then
      expect(report).toContain('IDE Config');
      expect(report).toContain('.cursor/settings.json');
      expect(report).toContain('Environment');
      expect(report).toContain('.env');
    });

    it('should format config validation results correctly', async () => {
      // Given
      const validationResults = {
        components: {
          files: {
            success: true,
            checks: [
              { component: 'Environment', file: '.env', status: 'success', message: 'Validated (5 variables)' },
              { component: 'Core Config', file: 'core-config.yaml', status: 'success', message: 'Valid YAML' },
            ],
            errors: [],
            warnings: [],
          },
          configs: { success: true, checks: [], errors: [], warnings: [] },
          mcps: { success: true, healthChecks: [], errors: [], warnings: [] },
          dependencies: { success: true, checks: [], errors: [], warnings: [] },
        },
        errors: [],
        warnings: [],
        overallStatus: 'success',
      };

      // When
      const report = await generateReport(validationResults);

      // Then
      expect(report).toContain('Environment Configuration');
      expect(report).toContain('Core Configuration');
      expect(report).toContain('Valid YAML');
    });

    it('should format MCP health check results correctly', async () => {
      // Given
      const validationResults = {
        components: {
          files: { success: true, checks: [], errors: [], warnings: [] },
          configs: { success: true, checks: [], errors: [], warnings: [] },
          mcps: {
            success: true,
            healthChecks: [
              { mcp: 'browser', status: 'success', message: 'Healthy', responseTime: 250 },
              { mcp: 'context7', status: 'success', message: 'Healthy', responseTime: 180 },
              { mcp: 'exa', status: 'warning', message: 'Timeout', responseTime: 5000 },
            ],
            errors: [],
            warnings: [],
          },
          dependencies: { success: true, checks: [], errors: [], warnings: [] },
        },
        errors: [],
        warnings: [],
        overallStatus: 'success',
      };

      // When
      const report = await generateReport(validationResults);

      // Then
      expect(report).toContain('browser');
      expect(report).toContain('context7');
      expect(report).toContain('exa');
      expect(report).toContain('250ms');
      expect(report).toContain('180ms');
    });

    it('should format dependency validation results correctly', async () => {
      // Given
      const validationResults = {
        components: {
          files: { success: true, checks: [], errors: [], warnings: [] },
          configs: { success: true, checks: [], errors: [], warnings: [] },
          mcps: { success: true, healthChecks: [], errors: [], warnings: [] },
          dependencies: {
            success: true,
            checks: [
              { component: 'Dependencies', status: 'success', message: '247 packages installed' },
            ],
            errors: [],
            warnings: [],
          },
        },
        errors: [],
        warnings: [],
        overallStatus: 'success',
      };

      // When
      const report = await generateReport(validationResults);

      // Then
      expect(report).toContain('Dependencies');
      expect(report).toContain('247 packages');
    });

    it('should display overall status (success/warning/partial/failed)', async () => {
      // Given - Test each status
      const statuses = ['success', 'warning', 'partial', 'failed'];

      for (const status of statuses) {
        const validationResults = {
          components: {
            files: { success: true, checks: [], errors: [], warnings: [] },
            configs: { success: true, checks: [], errors: [], warnings: [] },
            mcps: { success: true, healthChecks: [], errors: [], warnings: [] },
            dependencies: { success: true, checks: [], errors: [], warnings: [] },
          },
          errors: [],
          warnings: [],
          overallStatus: status,
        };

        // When
        const report = await generateReport(validationResults);

        // Then
        expect(report).toContain('Overall Status');
        expect(report.toLowerCase()).toContain(status.toLowerCase());
      }
    });

    it('should list warnings section when warnings present', async () => {
      // Given
      const validationResults = {
        components: {
          files: { success: true, checks: [], errors: [], warnings: [] },
          configs: { success: true, checks: [], errors: [], warnings: [] },
          mcps: { success: true, healthChecks: [], errors: [], warnings: [] },
          dependencies: { success: true, checks: [], errors: [], warnings: [] },
        },
        errors: [],
        warnings: [
          { component: 'mcps', severity: 'low', message: 'Warning 1' },
          { component: 'deps', severity: 'medium', message: 'Warning 2' },
        ],
        overallStatus: 'warning',
      };

      // When
      const report = await generateReport(validationResults);

      // Then
      expect(report).toContain('Warnings');
      expect(report).toContain('Warning 1');
      expect(report).toContain('Warning 2');
    });

    it('should list errors section when errors present', async () => {
      // Given
      const validationResults = {
        components: {
          files: { success: true, checks: [], errors: [], warnings: [] },
          configs: { success: true, checks: [], errors: [], warnings: [] },
          mcps: { success: true, healthChecks: [], errors: [], warnings: [] },
          dependencies: { success: true, checks: [], errors: [], warnings: [] },
        },
        errors: [
          { component: 'files', severity: 'critical', message: 'Error 1' },
          { component: 'configs', severity: 'high', message: 'Error 2' },
        ],
        warnings: [],
        overallStatus: 'failed',
      };

      // When
      const report = await generateReport(validationResults);

      // Then
      expect(report).toContain('Errors');
      expect(report).toContain('Error 1');
      expect(report).toContain('Error 2');
    });

    it('should display next steps section', async () => {
      // Given
      const validationResults = {
        components: {
          files: { success: true, checks: [], errors: [], warnings: [] },
          configs: { success: true, checks: [], errors: [], warnings: [] },
          mcps: { success: true, healthChecks: [], errors: [], warnings: [] },
          dependencies: { success: true, checks: [], errors: [], warnings: [] },
        },
        errors: [],
        warnings: [],
        overallStatus: 'success',
      };

      // When
      const report = await generateReport(validationResults);

      // Then
      expect(report).toContain('Next Steps');
    });

    it('should handle empty validation results', async () => {
      // Given
      const validationResults = {
        components: {},
        errors: [],
        warnings: [],
        overallStatus: 'unknown',
      };

      // When
      const report = await generateReport(validationResults);

      // Then
      expect(report).toContain('Installation Validation Report');
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
    });
  });
});
