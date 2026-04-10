const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

/**
 * PolicyManager
 * Manages policy loading and enforcement
 */
class PolicyManager {
  constructor(options = {}) {
    this.options = {
      cwd: process.cwd(),
      ...options,
    };
    this.policies = new Map();
    this._loadPolicies();
  }

  _loadPolicies() {
    const policiesDir = path.join(this.options.cwd, '.aiox/policies');

    // Create directory if it doesn't exist
    if (!fs.existsSync(policiesDir)) {
      fs.mkdirSync(policiesDir, { recursive: true });
      this._createDefaultPolicies(policiesDir);
    }

    // Load all YAML policies
    const files = fs.readdirSync(policiesDir).filter(f => f.endsWith('.yaml'));
    files.forEach(file => {
      try {
        const content = fs.readFileSync(path.join(policiesDir, file), 'utf8');
        const policy = yaml.load(content);
        if (policy && policy.id) {
          this.policies.set(policy.id, {
            ...policy,
            filePath: path.join(policiesDir, file),
          });
        }
      } catch (error) {
        console.warn(`Warning: Could not load policy ${file}: ${error.message}`);
      }
    });
  }

  _createDefaultPolicies(dir) {
    const defaults = [
      {
        id: 'import-absolute',
        name: 'Absolute Imports Only',
        description: 'All imports must be absolute, never relative',
        enabled: true,
      },
      {
        id: 'no-git-push',
        name: 'No Direct Git Push',
        description: '@dev agent cannot push to remote',
        enabled: true,
      },
      {
        id: 'const-naming',
        name: 'Constant Naming Convention',
        description: 'Constants must be SCREAMING_SNAKE_CASE',
        enabled: true,
      },
    ];

    defaults.forEach(policy => {
      const ymlPath = path.join(dir, `${policy.id}.yaml`);
      fs.writeFileSync(ymlPath, yaml.dump(policy), 'utf8');
    });
  }

  async list() {
    const policies = [];
    for (const [id, policy] of this.policies) {
      policies.push({
        id,
        name: policy.name,
        description: policy.description || '',
        enabled: policy.enabled !== false,
      });
    }
    return policies.sort((a, b) => a.name.localeCompare(b.name));
  }

  async enforce(policyId) {
    const policy = this.policies.get(policyId);

    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    if (policy.enabled === false) {
      return { passed: true, violations: [], message: 'Policy disabled' };
    }

    try {
      if (policy.check && typeof policy.check === 'function') {
        const result = await policy.check(this.options.cwd);
        return result;
      }
      return { passed: true, violations: [] };
    } catch (error) {
      return {
        passed: false,
        violations: [{ message: `Policy check error: ${error.message}` }],
      };
    }
  }

  async enablePolicy(policyId) {
    const policy = this.policies.get(policyId);
    if (policy) {
      policy.enabled = true;
      await this._savePolicy(policy);
    }
  }

  async disablePolicy(policyId) {
    const policy = this.policies.get(policyId);
    if (policy) {
      policy.enabled = false;
      await this._savePolicy(policy);
    }
  }

  async _savePolicy(policy) {
    const { filePath, ...policyData } = policy;
    if (filePath) {
      fs.writeFileSync(filePath, yaml.dump(policyData), 'utf8');
    }
  }
}

module.exports = { PolicyManager };
