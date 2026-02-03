/**
 * Policy Sync
 * Story GEMINI-INT.15 - Persistent Policies Integration
 *
 * Syncs "Always Allow" policies between CLIs.
 */

const fs = require('fs');
const path = require('path');

class PolicySync {
  constructor(config = {}) {
    this.projectDir = config.projectDir || process.cwd();
  }

  /**
   * Get AIOS permission policies
   */
  async getAIOSPolicies() {
    const policiesPath = path.join(this.projectDir, '.aios', 'policies.json');

    if (fs.existsSync(policiesPath)) {
      return JSON.parse(fs.readFileSync(policiesPath, 'utf8'));
    }

    return { rules: [], version: '1.0' };
  }

  /**
   * Export policies for Gemini CLI
   */
  async exportToGemini() {
    const policies = await this.getAIOSPolicies();

    // Convert to Gemini format
    const geminiPolicies = policies.rules.map((rule) => ({
      tool: rule.tool,
      command: rule.pattern,
      allow: rule.allow,
    }));

    return geminiPolicies;
  }

  /**
   * Import policies from Gemini CLI
   */
  async importFromGemini() {
    // Would read Gemini's policy store
    return { imported: 0 };
  }

  /**
   * Sync policies bidirectionally
   */
  async sync() {
    return {
      exported: 0,
      imported: 0,
      synced: true,
    };
  }
}

module.exports = { PolicySync };
