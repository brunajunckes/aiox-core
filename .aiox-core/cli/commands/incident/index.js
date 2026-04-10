#!/usr/bin/env node

const path = require('path');
const { IncidentManager } = require('./manager');

/**
 * aiox incident
 * Incident tracking and response
 * Usage:
 *   aiox incident create <severity> <description>  # Log new incident
 *   aiox incident resolve <id>                       # Mark as resolved
 *   aiox incident list --open                        # List open incidents
 *   aiox incident view <id>                          # View incident details
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const options = {
    cwd: process.cwd(),
  };

  try {
    const manager = new IncidentManager(options);

    if (command === 'create') {
      const severity = args[1];
      const description = args.slice(2).join(' ');

      if (!severity || !description) {
        console.error('❌ Usage: aiox incident create <severity> <description>');
        process.exit(1);
      }

      const incident = await manager.create({ severity, description });
      console.log(`\n✅ Incident Created`);
      console.log(`ID: ${incident.id}`);
      console.log(`Severity: ${incident.severity}`);
      console.log(`Created: ${new Date(incident.createdAt).toISOString()}\n`);
    } else if (command === 'resolve') {
      const id = args[1];
      if (!id) {
        console.error('❌ Usage: aiox incident resolve <id>');
        process.exit(1);
      }

      const incident = await manager.resolve(id, { resolvedBy: 'CLI' });
      console.log(`\n✅ Incident Resolved`);
      console.log(`ID: ${incident.id}`);
      console.log(`Resolved: ${new Date(incident.resolvedAt).toISOString()}\n`);
    } else if (command === 'list') {
      const openOnly = args.includes('--open');
      const incidents = await manager.list(openOnly);

      console.log(`\n=== INCIDENTS (${openOnly ? 'OPEN' : 'ALL'}) ===\n`);
      if (incidents.length === 0) {
        console.log('No incidents found.\n');
      } else {
        incidents.forEach(inc => {
          const status = inc.resolvedAt ? '✅' : '🔴';
          console.log(`${status} ${inc.id}`);
          console.log(`   Severity: ${inc.severity}`);
          console.log(`   Description: ${inc.description}`);
          console.log(`   Created: ${new Date(inc.createdAt).toLocaleString()}`);
          if (inc.resolvedAt) {
            console.log(`   Resolved: ${new Date(inc.resolvedAt).toLocaleString()}`);
          }
          console.log();
        });
      }
    } else if (command === 'view') {
      const id = args[1];
      if (!id) {
        console.error('❌ Usage: aiox incident view <id>');
        process.exit(1);
      }

      const incident = await manager.get(id);
      if (!incident) {
        console.error(`❌ Incident not found: ${id}`);
        process.exit(1);
      }

      console.log(`\n=== INCIDENT: ${incident.id} ===\n`);
      console.log(`Severity: ${incident.severity}`);
      console.log(`Description: ${incident.description}`);
      console.log(`Created: ${new Date(incident.createdAt).toISOString()}`);
      if (incident.resolvedAt) {
        console.log(`Resolved: ${new Date(incident.resolvedAt).toISOString()}`);
        if (incident.resolution) console.log(`Resolution: ${incident.resolution}`);
      }
      console.log();
    } else {
      console.error('❌ Unknown command. Use: create, resolve, list, or view');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Incident Manager Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
