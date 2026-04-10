#!/usr/bin/env node

/**
 * Inter-Squad Communication CLI
 * Structured messaging between squads.
 *
 * Usage:
 *   aiox squad-comms <squad1> <squad2>           Enable channel
 *   aiox squad-comms --broadcast <message>       Broadcast to all
 *   aiox squad-comms --log <squad>               View comm log
 */

const fs = require('fs');
const path = require('path');

const COMMS_LOG_PATH = path.join(__dirname, '../../data/squad-communications.jsonl');
const SQUAD_REGISTRY_PATH = path.join(__dirname, '../../data/squad-registry.json');

/**
 * Load squad registry
 */
function loadRegistry() {
  if (!fs.existsSync(SQUAD_REGISTRY_PATH)) {
    return { squads: {} };
  }
  return JSON.parse(fs.readFileSync(SQUAD_REGISTRY_PATH, 'utf8'));
}

/**
 * Validate squad exists
 */
function validateSquad(squadId) {
  const registry = loadRegistry();
  return registry.squads && registry.squads[squadId];
}

/**
 * Create communication channel between squads
 */
function createChannel(squad1, squad2) {
  if (!validateSquad(squad1)) throw new Error(`Squad not found: ${squad1}`);
  if (!validateSquad(squad2)) throw new Error(`Squad not found: ${squad2}`);

  const channel = {
    id: `${squad1}---${squad2}-${Date.now()}`,
    squad1,
    squad2,
    createdAt: new Date().toISOString(),
    status: 'active',
    messageCount: 0
  };

  logMessage({
    type: 'channel_created',
    sender: 'system',
    recipient: null,
    channel: channel.id,
    details: { squad1, squad2 },
    priority: 'info'
  });

  return channel;
}

/**
 * Log message to communication log
 */
function logMessage(message) {
  const entry = {
    timestamp: new Date().toISOString(),
    ...message
  };

  // Ensure directory exists
  const dir = path.dirname(COMMS_LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.appendFileSync(COMMS_LOG_PATH, JSON.stringify(entry) + '\n');
  return entry;
}

/**
 * Send message from squad1 to squad2
 */
function sendMessage(squad1, squad2, content, type = 'notification') {
  if (!validateSquad(squad1)) throw new Error(`Sender squad not found: ${squad1}`);
  if (!validateSquad(squad2)) throw new Error(`Recipient squad not found: ${squad2}`);

  const message = {
    type: type,
    sender: squad1,
    recipient: squad2,
    channel: `${squad1}---${squad2}`,
    content,
    priority: 'normal',
    acknowledged: false
  };

  logMessage(message);
  return message;
}

/**
 * Broadcast message to all active squads
 */
function broadcast(content, messageType = 'announcement') {
  const registry = loadRegistry();
  const squads = Object.values(registry.squads || {})
    .filter(s => s.status === 'active');

  const messages = squads.map(squad => {
    const msg = {
      type: messageType,
      sender: 'system',
      recipient: squad.id,
      channel: 'broadcast',
      content,
      priority: 'high',
      acknowledged: false
    };

    logMessage(msg);
    return msg;
  });

  return {
    broadcast_id: `broadcast-${Date.now()}`,
    recipients: squads.length,
    messages
  };
}

/**
 * Load communication log
 */
function loadLog(squad = null) {
  if (!fs.existsSync(COMMS_LOG_PATH)) {
    return [];
  }

  const lines = fs.readFileSync(COMMS_LOG_PATH, 'utf8').trim().split('\n').filter(l => l);
  const entries = lines.map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);

  if (!squad) return entries;

  // Filter for squad's communications
  return entries.filter(e =>
    e.sender === squad || e.recipient === squad || (e.type === 'channel_created' && (e.details?.squad1 === squad || e.details?.squad2 === squad))
  );
}

/**
 * Get messages between two squads
 */
function getChannelMessages(squad1, squad2) {
  const log = loadLog();
  const channel = `${squad1}---${squad2}`;
  return log.filter(e =>
    (e.channel === channel || (e.sender === squad1 && e.recipient === squad2) || (e.sender === squad2 && e.recipient === squad1))
  );
}

/**
 * Filter messages by type
 */
function filterByType(log, messageType) {
  return log.filter(e => e.type === messageType);
}

/**
 * Get unacknowledged messages for a squad
 */
function getPending(squad) {
  const log = loadLog(squad);
  return log.filter(e => e.recipient === squad && !e.acknowledged);
}

/**
 * Acknowledge messages
 */
function acknowledge(squad, timestamps = []) {
  const log = loadLog();
  const updated = log.map(e => {
    if (e.recipient === squad && timestamps.includes(e.timestamp)) {
      e.acknowledged = true;
    }
    return e;
  });

  // Rewrite log
  const dir = path.dirname(COMMS_LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(COMMS_LOG_PATH, updated.map(e => JSON.stringify(e)).join('\n'));

  return { acknowledged: timestamps.length };
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.length === 0) {
      console.log('Usage:');
      console.log('  aiox squad-comms <squad1> <squad2>          Enable direct channel');
      console.log('  aiox squad-comms --broadcast <message>      Broadcast to all');
      console.log('  aiox squad-comms --log <squad>              View comm log');
      console.log('  aiox squad-comms --pending <squad>          View pending messages');
      process.exit(0);
    }

    if (args[0] === '--broadcast') {
      const message = args.slice(1).join(' ');
      if (!message) throw new Error('Broadcast requires a message');
      const result = broadcast(message);
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    }

    if (args[0] === '--log') {
      const squad = args[1];
      if (!squad) throw new Error('--log requires squad ID');
      const log = loadLog(squad);
      console.log(JSON.stringify(log, null, 2));
      process.exit(0);
    }

    if (args[0] === '--pending') {
      const squad = args[1];
      if (!squad) throw new Error('--pending requires squad ID');
      const pending = getPending(squad);
      console.log(JSON.stringify(pending, null, 2));
      process.exit(0);
    }

    // Create channel between two squads
    const squad1 = args[0];
    const squad2 = args[1];
    if (!squad2) throw new Error('Requires two squad IDs');

    const channel = createChannel(squad1, squad2);
    console.log(`Channel created: ${channel.id}`);
    console.log(JSON.stringify(channel, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Export for testing
module.exports = {
  loadRegistry,
  validateSquad,
  createChannel,
  logMessage,
  sendMessage,
  broadcast,
  loadLog,
  getChannelMessages,
  filterByType,
  getPending,
  acknowledge
};

if (require.main === module) {
  main();
}
