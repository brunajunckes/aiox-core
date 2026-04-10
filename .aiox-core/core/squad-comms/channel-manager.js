/**
 * Squad Communication Channel Manager
 * Manages squad-to-squad communication channels
 */

const fs = require('fs');
const path = require('path');

const CHANNELS_PATH = path.join(__dirname, '../../data/squad-channels.json');

/**
 * Load channels registry
 */
function loadChannels() {
  if (!fs.existsSync(CHANNELS_PATH)) {
    return { channels: {}, metadata: { createdAt: new Date().toISOString() } };
  }
  return JSON.parse(fs.readFileSync(CHANNELS_PATH, 'utf8'));
}

/**
 * Save channels registry
 */
function saveChannels(registry) {
  const dir = path.dirname(CHANNELS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CHANNELS_PATH, JSON.stringify(registry, null, 2));
}

/**
 * Create channel between two squads
 */
function createChannel(squad1, squad2) {
  const channels = loadChannels();
  const channelId = `${squad1}--${squad2}-${Date.now()}`;

  channels.channels[channelId] = {
    id: channelId,
    squad1,
    squad2,
    createdAt: new Date().toISOString(),
    status: 'active',
    messageCount: 0,
    lastMessage: null
  };

  saveChannels(channels);
  return channels.channels[channelId];
}

/**
 * Get channel by ID
 */
function getChannel(channelId) {
  const channels = loadChannels();
  return channels.channels[channelId];
}

/**
 * Get channels for a squad
 */
function getChannelsForSquad(squadId) {
  const channels = loadChannels();
  return Object.values(channels.channels).filter(c =>
    (c.squad1 === squadId || c.squad2 === squadId) && c.status === 'active'
  );
}

/**
 * Close channel
 */
function closeChannel(channelId) {
  const channels = loadChannels();
  if (channels.channels[channelId]) {
    channels.channels[channelId].status = 'closed';
    channels.channels[channelId].closedAt = new Date().toISOString();
    saveChannels(channels);
  }
  return channels.channels[channelId];
}

/**
 * Update channel metadata
 */
function updateChannel(channelId, updates) {
  const channels = loadChannels();
  if (channels.channels[channelId]) {
    channels.channels[channelId] = {
      ...channels.channels[channelId],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    saveChannels(channels);
  }
  return channels.channels[channelId];
}

/**
 * List all active channels
 */
function listActiveChannels() {
  const channels = loadChannels();
  return Object.values(channels.channels).filter(c => c.status === 'active');
}

module.exports = {
  loadChannels,
  saveChannels,
  createChannel,
  getChannel,
  getChannelsForSquad,
  closeChannel,
  updateChannel,
  listActiveChannels
};
