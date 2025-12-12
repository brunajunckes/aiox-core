const path = require('path');
const fs = require('fs-extra');
const toolResolver = require('../../common/utils/tool-resolver'); // Singleton instance
const ToolHelperExecutor = require('../../common/utils/tool-helper-executor');
const ToolValidationHelper = require('../../common/utils/tool-validation-helper');

describe('Tools System Integration', () => {
  let testToolsDir;
  let testExpansionDir;

  beforeAll(async () => {
    // Create test directories
    testToolsDir = path.join(__dirname, '../fixtures/integration-tools');
    testExpansionDir = path.join(__dirname, '../fixtures/integration-expansion-packs');

    await fs.ensureDir(testToolsDir);
    await fs.ensureDir(testExpansionDir);
    await fs.ensureDir(path.join(testExpansionDir, 'test-pack/tools'));
  });

  afterAll(async () => {
    // Cleanup
    await fs.remove(testToolsDir);
    await fs.remove(testExpansionDir);
  });

  describe('End-to-End Tool Resolution → Validation → Execution', () => {
    test('should resolve, validate, and execute a complete tool workflow', async () => {
      // 1. Create a v2.0 tool with validator and helper
      const toolDef = {
        id: 'create_task',
        type: 'local',
        name: 'create_task',
        version: '1.0.0',
        schema_version: 2.0,
        description: 'Creates a task with validation',
        executable_knowledge: {
          validators: [
            {
              id: 'create_task_validator',
              validates: 'create_task',
              language: 'javascript',
              checks: ['required_fields'],
              function: `
                (function() {
                  const errors = [];
                  if (!args.args.title) errors.push('Title is required');
                  if (!args.args.priority || args.args.priority < 1 || args.args.priority > 4) {
                    errors.push('Priority must be between 1 and 4');
                  }
                  return { valid: errors.length === 0, errors };
                })();
              `,
            },
          ],
          helpers: [
            {
              id: 'format_task',
              language: 'javascript',
              function: `
                (function() {
                  return {
                    title: args.title.toUpperCase(),
                    priority: args.priority,
                    status: 'pending',
                    created: new Date().toISOString()
                  };
                })();
              `,
            },
          ],
        },
      };

      await fs.writeJSON(path.join(testToolsDir, 'create_task.yaml'), toolDef);

      // 2. Resolve the tool
      toolResolver.clearCache();
      toolResolver.setSearchPaths([testToolsDir]);

      const tool = await toolResolver.resolveTool('create_task');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('create_task');
      expect(tool.executable_knowledge.validators).toHaveLength(1);
      expect(tool.executable_knowledge.helpers).toHaveLength(1);

      // 3. Validate command arguments
      const validator = new ToolValidationHelper(tool.executable_knowledge.validators);

      const validResult = await validator.validate('create_task', {
        title: 'Test Task',
        priority: 2,
      });
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toEqual([]);

      const invalidResult = await validator.validate('create_task', {
        title: 'Test Task',
        priority: 5, // Invalid priority
      });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Priority must be between 1 and 4');

      // 4. Execute helper function
      const executor = new ToolHelperExecutor(tool.executable_knowledge.helpers);

      const result = await executor.execute('format_task', {
        title: 'integration test',
        priority: 3,
      });

      expect(result).toMatchObject({
        title: 'INTEGRATION TEST',
        priority: 3,
        status: 'pending',
      });
      expect(result.created).toBeDefined();
    });

    test('should handle validation failure preventing execution', async () => {
      const toolDef = {
        id: 'update_item',
        type: 'local',
        name: 'update_item',
        version: '1.0.0',
        schema_version: 2.0,
        description: 'Updates an item with validation',
        executable_knowledge: {
          validators: [
            {
              id: 'update_validator',
              validates: 'update_item',
              language: 'javascript',
              function: `
                (function() {
                  if (!args.args.id) {
                    return { valid: false, errors: ['ID is required'] };
                  }
                  return { valid: true, errors: [] };
                })();
              `,
            },
          ],
          helpers: [
            {
              id: 'update_helper',
              language: 'javascript',
              function: `
                (function() {
                  return { id: args.id, updated: true };
                })();
              `,
            },
          ],
        },
      };

      await fs.writeJSON(path.join(testToolsDir, 'update_item.yaml'), toolDef);

      const tool = await toolResolver.resolveTool('update_item');

      // Validation should fail
      const validator = new ToolValidationHelper(tool.executable_knowledge.validators);
      const validation = await validator.validate('update_item', { name: 'test' }); // Missing id

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('ID is required');

      // In real implementation, we would NOT execute if validation fails
      // This test demonstrates the validation gate working correctly
    });
  });

  describe('Expansion Pack Tool Priority', () => {
    test('should prioritize expansion pack tools over core tools', async () => {
      // 1. Create core version of tool
      const coreTool = {
        id: 'shared_tool',
        type: 'local',
        name: 'shared_tool',
        version: '1.0.0',
        schema_version: 2.0,
        description: 'Core version',
        executable_knowledge: {
          helpers: [
            {
              id: 'shared_helper',
              language: 'javascript',
              function: `
                (function() {
                  return { version: 'core', value: args.value };
                })();
              `,
            },
          ],
        },
      };

      await fs.writeJSON(path.join(testToolsDir, 'shared_tool.yaml'), coreTool);

      // 2. Create expansion pack version of same tool
      const expansionTool = {
        id: 'shared_tool',
        type: 'local',
        name: 'shared_tool',
        version: '1.0.0',
        schema_version: 2.0,
        description: 'Expansion pack version',
        executable_knowledge: {
          helpers: [
            {
              id: 'shared_helper',
              language: 'javascript',
              function: `
                (function() {
                  return { version: 'expansion', value: args.value * 2 };
                })();
              `,
            },
          ],
        },
      };

      await fs.writeJSON(
        path.join(testExpansionDir, 'test-pack/tools/shared_tool.yaml'),
        expansionTool,
      );

      // 3. Configure resolver with expansion pack first (higher priority)
      toolResolver.clearCache();
      toolResolver.setSearchPaths([
        path.join(testExpansionDir, 'test-pack/tools'),
        testToolsDir,
      ]);

      // 4. Resolve tool - should get expansion pack version
      const tool = await toolResolver.resolveTool('shared_tool');
      expect(tool).toBeDefined();
      expect(tool.description).toBe('Expansion pack version');

      // 5. Execute helper - should use expansion pack logic
      const executor = new ToolHelperExecutor(tool.executable_knowledge.helpers);
      const result = await executor.execute('shared_helper', { value: 10 });

      expect(result.version).toBe('expansion');
      expect(result.value).toBe(20); // Expansion pack doubles the value
    });

    test('should fall back to core tool if expansion pack version not found', async () => {
      const coreTool = {
        id: 'core_only_tool',
        type: 'local',
        name: 'core_only_tool',
        version: '1.0.0',
        schema_version: 2.0,
        description: 'Core only',
        executable_knowledge: {
          helpers: [
            {
              id: 'core_helper',
              language: 'javascript',
              function: '(function() { return { source: \'core\' }; })();',
            },
          ],
        },
      };

      await fs.writeJSON(path.join(testToolsDir, 'core_only_tool.yaml'), coreTool);

      toolResolver.clearCache();
      toolResolver.setSearchPaths([
        path.join(testExpansionDir, 'test-pack/tools'), // No tool here
        testToolsDir, // Tool exists here
      ]);

      const tool = await toolResolver.resolveTool('core_only_tool');
      expect(tool).toBeDefined();
      expect(tool.description).toBe('Core only');

      const executor = new ToolHelperExecutor(tool.executable_knowledge.helpers);
      const result = await executor.execute('core_helper', {});
      expect(result.source).toBe('core');
    });
  });

  describe('Agent Tool Dependencies Loading', () => {
    test('should load and initialize all tools from agent dependencies', async () => {
      // 1. Create multiple tools
      const tool1 = {
        id: 'create_item',
        type: 'local',
        name: 'create_item',
        version: '1.0.0',
        schema_version: 2.0,
        description: 'Create items',
        executable_knowledge: {
          validators: [
            {
              id: 'create_validator',
              validates: 'create_item',
              language: 'javascript',
              function: `
                (function() {
                  if (!args.args.name) {
                    return { valid: false, errors: ['Name required'] };
                  }
                  return { valid: true, errors: [] };
                })();
              `,
            },
          ],
        },
      };

      const tool2 = {
        id: 'update_item',
        type: 'local',
        name: 'update_item',
        version: '1.0.0',
        schema_version: 2.0,
        description: 'Update items',
        executable_knowledge: {
          helpers: [
            {
              id: 'update_helper',
              language: 'javascript',
              function: '(function() { return { updated: true }; })();',
            },
          ],
        },
      };

      await fs.writeJSON(path.join(testToolsDir, 'create_item.yaml'), tool1);
      await fs.writeJSON(path.join(testToolsDir, 'update_item.yaml'), tool2);

      // 2. Simulate agent dependencies
      const agentDependencies = ['create_item', 'update_item'];

      // 3. Load all tools
      toolResolver.clearCache();
      toolResolver.setSearchPaths([testToolsDir]);

      const loadedTools = [];
      for (const toolName of agentDependencies) {
        const tool = await toolResolver.resolveTool(toolName);
        loadedTools.push(tool);
      }

      expect(loadedTools).toHaveLength(2);
      expect(loadedTools[0].name).toBe('create_item');
      expect(loadedTools[1].name).toBe('update_item');

      // 4. Initialize validators and helpers for each tool
      const validators = new Map();
      const helpers = new Map();

      for (const tool of loadedTools) {
        if (tool.executable_knowledge?.validators) {
          validators.set(tool.name, new ToolValidationHelper(tool.executable_knowledge.validators));
        }
        if (tool.executable_knowledge?.helpers) {
          helpers.set(tool.name, new ToolHelperExecutor(tool.executable_knowledge.helpers));
        }
      }

      expect(validators.has('create_item')).toBe(true);
      expect(helpers.has('update_item')).toBe(true);

      // 5. Verify validators work
      const createValidator = validators.get('create_item');
      const validationResult = await createValidator.validate('create_item', { name: 'test' });
      expect(validationResult.valid).toBe(true);

      // 6. Verify helpers work
      const updateExecutor = helpers.get('update_item');
      const helperResult = await updateExecutor.execute('update_helper', {});
      expect(helperResult.updated).toBe(true);
    });

    test('should handle missing tool dependencies gracefully', async () => {
      toolResolver.clearCache();
      toolResolver.setSearchPaths([testToolsDir]);

      // Try to load non-existent tool
      await expect(toolResolver.resolveTool('nonexistent_tool'))
        .rejects
        .toThrow(/Tool 'nonexistent_tool' not found/);
    });
  });

  describe('Complex Workflow Scenarios', () => {
    test('should handle tool with multiple validators and helpers', async () => {
      const complexTool = {
        id: 'complex_operation',
        type: 'local',
        name: 'complex_operation',
        version: '1.0.0',
        schema_version: 2.0,
        description: 'Complex operation with multiple validations and helpers',
        executable_knowledge: {
          validators: [
            {
              id: 'input_validator',
              validates: 'validate_input',
              language: 'javascript',
              function: `
                (function() {
                  if (!args.args.data || !Array.isArray(args.args.data)) {
                    return { valid: false, errors: ['Data must be an array'] };
                  }
                  return { valid: true, errors: [] };
                })();
              `,
            },
            {
              id: 'permission_validator',
              validates: 'validate_permission',
              language: 'javascript',
              function: `
                (function() {
                  if (!args.args.user || !args.args.user.role) {
                    return { valid: false, errors: ['User role required'] };
                  }
                  if (args.args.user.role !== 'admin') {
                    return { valid: false, errors: ['Admin role required'] };
                  }
                  return { valid: true, errors: [] };
                })();
              `,
            },
          ],
          helpers: [
            {
              id: 'process_data',
              language: 'javascript',
              function: `
                (function() {
                  return {
                    processed: args.data.map(item => item * 2),
                    count: args.data.length
                  };
                })();
              `,
            },
            {
              id: 'format_result',
              language: 'javascript',
              function: `
                (function() {
                  return {
                    result: args.processedData,
                    timestamp: new Date().toISOString(),
                    user: args.user
                  };
                })();
              `,
            },
          ],
        },
      };

      await fs.writeJSON(path.join(testToolsDir, 'complex_operation.yaml'), complexTool);

      // Resolve tool
      const tool = await toolResolver.resolveTool('complex_operation');

      // Create validators
      const validator = new ToolValidationHelper(tool.executable_knowledge.validators);

      // Test input validation
      const inputValidation = await validator.validate('validate_input', {
        data: [1, 2, 3],
      });
      expect(inputValidation.valid).toBe(true);

      // Test permission validation
      const permValidation = await validator.validate('validate_permission', {
        user: { role: 'admin' },
      });
      expect(permValidation.valid).toBe(true);

      const permFailure = await validator.validate('validate_permission', {
        user: { role: 'user' },
      });
      expect(permFailure.valid).toBe(false);

      // Create helpers executor
      const executor = new ToolHelperExecutor(tool.executable_knowledge.helpers);

      // Execute data processing
      const processResult = await executor.execute('process_data', {
        data: [1, 2, 3],
      });
      expect(processResult.processed).toEqual([2, 4, 6]);
      expect(processResult.count).toBe(3);

      // Execute result formatting
      const formatResult = await executor.execute('format_result', {
        processedData: processResult.processed,
        user: { role: 'admin', id: 123 },
      });
      expect(formatResult.result).toEqual([2, 4, 6]);
      expect(formatResult.user).toEqual({ role: 'admin', id: 123 });
      expect(formatResult.timestamp).toBeDefined();
    });

    test('should cache resolved tools across multiple requests', async () => {
      const tool = {
        id: 'cacheable_tool',
        type: 'local',
        name: 'cacheable_tool',
        version: '1.0.0',
        schema_version: 2.0,
        description: 'Tool for cache testing',
        executable_knowledge: {
          helpers: [
            {
              id: 'cache_helper',
              language: 'javascript',
              function: '(function() { return { cached: true }; })();',
            },
          ],
        },
      };

      await fs.writeJSON(path.join(testToolsDir, 'cacheable_tool.yaml'), tool);

      toolResolver.clearCache();
      toolResolver.setSearchPaths([testToolsDir]);

      // First resolution (uncached)
      const startTime1 = Date.now();
      const tool1 = await toolResolver.resolveTool('cacheable_tool');
      const duration1 = Date.now() - startTime1;

      // Second resolution (cached)
      const startTime2 = Date.now();
      const tool2 = await toolResolver.resolveTool('cacheable_tool');
      const duration2 = Date.now() - startTime2;

      expect(tool1).toBe(tool2); // Same reference (cached) - THIS is the key test

      // Performance assertion: relaxed for CI environments
      // Skip strict timing comparison if durations are too short to measure reliably
      if (duration1 > 5 && duration2 > 0) {
        // Only assert cached is faster when we have measurable durations
        expect(duration2).toBeLessThanOrEqual(duration1);
      }
      // Note: In CI environments, both can be 0-1ms due to fast I/O
      // The key assertion is tool1 === tool2 (same reference), not timing

      // Verify cached tool still works
      const executor = new ToolHelperExecutor(tool2.executable_knowledge.helpers);
      const result = await executor.execute('cache_helper', {});
      expect(result.cached).toBe(true);
    });
  });

  describe('Error Handling in Integration Scenarios', () => {
    test('should handle tool with invalid validator function', async () => {
      const invalidTool = {
        id: 'invalid_validator_tool',
        type: 'local',
        name: 'invalid_validator_tool',
        version: '1.0.0',
        schema_version: 2.0,
        description: 'Tool with invalid validator',
        executable_knowledge: {
          validators: [
            {
              id: 'broken_validator',
              validates: 'test_command',
              language: 'javascript',
              function: 'function invalid( { // Invalid syntax',
            },
          ],
        },
      };

      await fs.writeJSON(path.join(testToolsDir, 'invalid_validator_tool.yaml'), invalidTool);

      const tool = await toolResolver.resolveTool('invalid_validator_tool');

      const validator = new ToolValidationHelper(tool.executable_knowledge.validators);

      // Invalid validator function should be caught and returned as validation failure
      const result = await validator.validate('test_command', {});
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/Validation error/);
    });

    test('should handle tool with invalid helper function', async () => {
      const invalidTool = {
        id: 'invalid_helper_tool',
        type: 'local',
        name: 'invalid_helper_tool',
        version: '1.0.0',
        schema_version: 2.0,
        description: 'Tool with invalid helper',
        executable_knowledge: {
          helpers: [
            {
              id: 'broken_helper',
              language: 'javascript',
              function: 'throw new Error("Intentional error");',
            },
          ],
        },
      };

      await fs.writeJSON(path.join(testToolsDir, 'invalid_helper_tool.yaml'), invalidTool);

      const tool = await toolResolver.resolveTool('invalid_helper_tool');

      const executor = new ToolHelperExecutor(tool.executable_knowledge.helpers);

      await expect(executor.execute('broken_helper', {}))
        .rejects
        .toThrow(/execution failed/);
    });
  });
});
