#!/usr/bin/env node

/**
 * Squad Formation Engine CLI
 * Enables dynamic creation and configuration of multi-agent teams.
 *
 * Usage:
 *   aiox squad-form <template>              Create squad from template
 *   aiox squad-form --auto                  Auto-form optimal squad
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SQUAD_REGISTRY_PATH = path.join(__dirname, '../../data/squad-registry.json');
const SQUAD_TEMPLATES_DIR = path.join(__dirname, '../../data/squad-templates');

/**
 * Load squad template by name
 */
function loadTemplate(templateName) {
  const templatePath = path.join(SQUAD_TEMPLATES_DIR, `${templateName}.yaml`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Squad template not found: ${templateName}`);
  }
  return yaml.load(fs.readFileSync(templatePath, 'utf8'));
}

/**
 * Load squad registry
 */
function loadRegistry() {
  if (!fs.existsSync(SQUAD_REGISTRY_PATH)) {
    return { squads: {}, metadata: { createdAt: new Date().toISOString() } };
  }
  return JSON.parse(fs.readFileSync(SQUAD_REGISTRY_PATH, 'utf8'));
}

/**
 * Save squad registry
 */
function saveRegistry(registry) {
  if (!fs.existsSync(SQUAD_TEMPLATES_DIR)) {
    fs.mkdirSync(SQUAD_TEMPLATES_DIR, { recursive: true });
  }
  fs.writeFileSync(SQUAD_REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

/**
 * Generate squad ID
 */
function generateSquadId(templateName) {
  return `squad-${templateName}-${Date.now()}`;
}

/**
 * Validate squad definition
 */
function validateSquad(squad) {
  if (!squad.name || typeof squad.name !== 'string') {
    throw new Error('Squad must have a valid name');
  }
  if (!Array.isArray(squad.agents) || squad.agents.length === 0) {
    throw new Error('Squad must have at least one agent');
  }
  if (!squad.capabilities || typeof squad.capabilities !== 'object') {
    throw new Error('Squad must have defined capabilities');
  }
  return true;
}

/**
 * Create squad from template
 */
function createFromTemplate(templateName) {
  const template = loadTemplate(templateName);
  validateSquad(template);

  const squadId = generateSquadId(templateName);
  const squad = {
    ...template,
    id: squadId,
    createdAt: new Date().toISOString(),
    status: 'active',
    agents: template.agents.map(agent => ({
      ...agent,
      status: 'ready',
      joinedAt: new Date().toISOString()
    }))
  };

  const registry = loadRegistry();
  registry.squads[squadId] = squad;
  saveRegistry(registry);

  return squad;
}

/**
 * Auto-form optimal squad based on current workload
 * Simple algorithm: load-balancing among available agent types
 */
function autoFormSquad() {
  // Load all available templates
  const templates = fs.readdirSync(SQUAD_TEMPLATES_DIR)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace('.yaml', ''));

  if (templates.length === 0) {
    throw new Error('No squad templates available for auto-formation');
  }

  // Simple selection: pick the first available template
  // In a real system, this would analyze current workload
  const selectedTemplate = templates[0];
  return createFromTemplate(selectedTemplate);
}

/**
 * List active squads
 */
function listSquads() {
  const registry = loadRegistry();
  const squads = Object.values(registry.squads || {});
  return squads.filter(s => s.status === 'active');
}

/**
 * Get squad by ID
 */
function getSquad(squadId) {
  const registry = loadRegistry();
  return registry.squads[squadId];
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.length === 0) {
      console.log('Usage:');
      console.log('  aiox squad-form <template>    Create squad from template');
      console.log('  aiox squad-form --auto        Auto-form optimal squad');
      console.log('  aiox squad-form --list        List active squads');
      process.exit(0);
    }

    if (args[0] === '--list') {
      const squads = listSquads();
      console.log(JSON.stringify(squads, null, 2));
      process.exit(0);
    }

    if (args[0] === '--auto') {
      const squad = autoFormSquad();
      console.log(`Squad formed: ${squad.id}`);
      console.log(JSON.stringify(squad, null, 2));
      process.exit(0);
    }

    // Create from template
    const templateName = args[0];
    const squad = createFromTemplate(templateName);
    console.log(`Squad created: ${squad.id}`);
    console.log(JSON.stringify(squad, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Export for testing
module.exports = {
  loadTemplate,
  loadRegistry,
  saveRegistry,
  generateSquadId,
  validateSquad,
  createFromTemplate,
  autoFormSquad,
  listSquads,
  getSquad
};

if (require.main === module) {
  main();
}
