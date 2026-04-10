const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');

/**
 * IncidentManager
 * Manages incident tracking with JSONL audit log
 */
class IncidentManager {
  constructor(options = {}) {
    this.options = {
      cwd: process.cwd(),
      ...options,
    };
    this.incidentsDir = path.join(this.options.cwd, '.aiox/incidents');
    this.logFile = path.join(this.incidentsDir, 'log.jsonl');
    this._ensureDirectories();
  }

  _ensureDirectories() {
    if (!fs.existsSync(this.incidentsDir)) {
      fs.mkdirSync(this.incidentsDir, { recursive: true });
      this._createSchemaFile();
    }
  }

  _createSchemaFile() {
    const schema = {
      version: '1.0.0',
      description: 'Incident tracking schema',
      fields: {
        id: { type: 'string', format: 'INC-{timestamp}-{random}' },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        description: { type: 'string' },
        createdAt: { type: 'ISO8601' },
        createdBy: { type: 'string' },
        resolvedAt: { type: 'ISO8601', nullable: true },
        resolution: { type: 'string', nullable: true },
      },
    };

    fs.writeFileSync(
      path.join(this.incidentsDir, 'schema.json'),
      JSON.stringify(schema, null, 2),
      'utf8'
    );
  }

  async create(data) {
    const { severity, description } = data;

    if (!['critical', 'high', 'medium', 'low'].includes(severity)) {
      throw new Error(`Invalid severity: ${severity}`);
    }

    if (!description || description.trim().length === 0) {
      throw new Error('Description required');
    }

    const id = this._generateId();
    const incident = {
      id,
      severity,
      description,
      createdAt: new Date().toISOString(),
      createdBy: process.env.USER || 'unknown',
    };

    this._appendLog(incident);
    return incident;
  }

  async resolve(incidentId, metadata = {}) {
    const incident = await this.get(incidentId);
    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    if (incident.resolvedAt) {
      throw new Error(`Incident already resolved: ${incidentId}`);
    }

    incident.resolvedAt = new Date().toISOString();
    incident.resolvedBy = metadata.resolvedBy || process.env.USER || 'unknown';
    if (metadata.resolution) {
      incident.resolution = metadata.resolution;
    }

    this._appendLog(incident);
    return incident;
  }

  async get(incidentId) {
    const incidents = await this._readLog();
    const matches = incidents.filter(inc => inc.id === incidentId);

    if (matches.length === 0) return null;

    // Return most recent version
    return matches[matches.length - 1];
  }

  async list(openOnly = false) {
    const incidents = await this._readLog();
    const uniqueIncidents = new Map();

    // Keep only the latest version of each incident
    incidents.forEach(inc => {
      uniqueIncidents.set(inc.id, inc);
    });

    let results = Array.from(uniqueIncidents.values());

    if (openOnly) {
      results = results.filter(inc => !inc.resolvedAt);
    }

    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async stats() {
    const incidents = await this.list();
    const openCount = incidents.filter(inc => !inc.resolvedAt).length;
    const closedCount = incidents.filter(inc => inc.resolvedAt).length;

    const bySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    incidents.forEach(inc => {
      bySeverity[inc.severity]++;
    });

    return {
      total: incidents.length,
      open: openCount,
      closed: closedCount,
      bySeverity,
    };
  }

  _generateId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `INC-${timestamp}-${random}`;
  }

  _appendLog(incident) {
    const line = JSON.stringify(incident);
    fs.appendFileSync(this.logFile, line + '\n', 'utf8');
  }

  async _readLog() {
    if (!fs.existsSync(this.logFile)) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const incidents = [];
      const stream = fs.createReadStream(this.logFile);
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      rl.on('line', line => {
        if (line.trim()) {
          try {
            incidents.push(JSON.parse(line));
          } catch (error) {
            console.warn('Warning: Could not parse log line:', error.message);
          }
        }
      });

      rl.on('close', () => resolve(incidents));
      rl.on('error', reject);
    });
  }
}

module.exports = { IncidentManager };
