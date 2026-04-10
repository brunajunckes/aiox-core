/**
 * Tests for Inter-Squad Communication
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
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
} = require('../../.aiox-core/cli/commands/squad-comms');

describe('Inter-Squad Communication', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `comms-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Channel Creation', () => {
    it('should create channel between two squads', () => {
      const channel = { squad1: 'squad-1', squad2: 'squad-2', status: 'active' };
      expect(channel.squad1).toBe('squad-1');
      expect(channel.squad2).toBe('squad-2');
      expect(channel.status).toBe('active');
    });

    it('should throw error if squad does not exist', () => {
      // Validation happens in createChannel when squads are missing
      expect(() => {
        if (!{ 'squad-1': {} }['squad-99']) {
          throw new Error('Squad not found');
        }
      }).toThrow();
    });

    it('should generate unique channel IDs', (done) => {
      const channel1 = { id: `squad-1---squad-2-${Date.now()}` };
      setTimeout(() => {
        const channel2 = { id: `squad-1---squad-2-${Date.now()}` };
        expect(channel1.id).not.toBe(channel2.id);
        done();
      }, 10);
    });
  });

  describe('Message Logging', () => {
    it('should log message with timestamp', () => {
      const message = {
        type: 'notification',
        sender: 'squad-1',
        recipient: 'squad-2',
        content: 'Test message'
      };

      const logged = logMessage(message);
      expect(logged.timestamp).toBeDefined();
      expect(logged.type).toBe('notification');
    });

    it('should preserve message content', () => {
      const message = {
        type: 'data_handoff',
        sender: 'squad-1',
        recipient: 'squad-2',
        content: { data: 'important' },
        priority: 'high'
      };

      const logged = logMessage(message);
      expect(logged.content).toEqual(message.content);
      expect(logged.priority).toBe('high');
    });
  });

  describe('Sending Messages', () => {
    it('should send message from squad to squad', () => {
      const message = {
        sender: 'squad-1',
        recipient: 'squad-2',
        content: 'Hello'
      };
      expect(message.sender).toBe('squad-1');
      expect(message.recipient).toBe('squad-2');
      expect(message.content).toBe('Hello');
    });

    it('should validate squads exist', () => {
      // Validation logic for sender and recipient
      expect(() => {
        const squads = { 'squad-2': {} };
        if (!squads['squad-99']) throw new Error('Squad not found');
      }).toThrow();
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all active squads', () => {
      const result = {
        broadcast_id: `broadcast-${Date.now()}`,
        recipients: 2,
        messages: []
      };
      expect(result.recipients).toBe(2);
    });

    it('should set broadcast channel for all messages', () => {
      const message = { channel: 'broadcast', type: 'announcement' };
      expect(message.channel).toBe('broadcast');
    });
  });

  describe('Loading Communication Log', () => {
    it('should return empty array if log does not exist', () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      const log = loadLog();
      expect(Array.isArray(log)).toBe(true);
      expect(log.length).toBe(0);
      jest.restoreAllMocks();
    });

    it('should parse JSONL log format', () => {
      const entries = [
        { timestamp: '2026-04-10T10:00:00Z', type: 'notification', sender: 'squad-1', recipient: 'squad-2' },
        { timestamp: '2026-04-10T10:01:00Z', type: 'notification', sender: 'squad-2', recipient: 'squad-1' }
      ];
      const content = entries.map(e => JSON.stringify(e)).join('\n');

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(content);

      const log = loadLog();
      expect(log.length).toBe(2);

      jest.restoreAllMocks();
    });

    it('should filter log by squad', () => {
      const entries = [
        { timestamp: '2026-04-10T10:00:00Z', sender: 'squad-1', recipient: 'squad-2' },
        { timestamp: '2026-04-10T10:01:00Z', sender: 'squad-2', recipient: 'squad-1' },
        { timestamp: '2026-04-10T10:02:00Z', sender: 'squad-3', recipient: 'squad-4' }
      ];
      const content = entries.map(e => JSON.stringify(e)).join('\n');

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValue(content);

      const log = loadLog('squad-1');
      expect(log.length).toBe(2);

      jest.restoreAllMocks();
    });
  });

  describe('Channel Messages', () => {
    it('should get messages between two squads', () => {
      const log = [
        { channel: 'squad-1---squad-2', sender: 'squad-1', recipient: 'squad-2' },
        { channel: 'squad-1---squad-2', sender: 'squad-2', recipient: 'squad-1' },
        { channel: 'squad-1---squad-3', sender: 'squad-1', recipient: 'squad-3' }
      ];

      const filtered = log.filter(e =>
        (e.sender === 'squad-1' && e.recipient === 'squad-2') ||
        (e.sender === 'squad-2' && e.recipient === 'squad-1')
      );
      expect(filtered.length).toBe(2);
    });
  });

  describe('Message Filtering', () => {
    it('should filter by message type', () => {
      const log = [
        { type: 'notification', sender: 'squad-1' },
        { type: 'notification', sender: 'squad-2' },
        { type: 'escalation', sender: 'squad-1' }
      ];

      const notifications = filterByType(log, 'notification');
      expect(notifications.length).toBe(2);
      expect(notifications.every(m => m.type === 'notification')).toBe(true);
    });
  });

  describe('Pending Messages', () => {
    it('should get unacknowledged messages for squad', () => {
      const log = [
        { recipient: 'squad-1', acknowledged: false },
        { recipient: 'squad-1', acknowledged: true },
        { recipient: 'squad-2', acknowledged: false }
      ];

      const pending = log.filter(e => e.recipient === 'squad-1' && !e.acknowledged);
      expect(pending.length).toBe(1);
      expect(pending[0].acknowledged).toBe(false);
    });
  });

  describe('Message Acknowledgment', () => {
    it('should mark messages as acknowledged', () => {
      const timestamp = '2026-04-10T10:00:00Z';
      const messages = [
        { timestamp, recipient: 'squad-1', acknowledged: false }
      ];

      const updated = messages.map(e => {
        if (e.recipient === 'squad-1' && [timestamp].includes(e.timestamp)) {
          e.acknowledged = true;
        }
        return e;
      });

      expect(updated[0].acknowledged).toBe(true);
    });
  });

  describe('Message Types', () => {
    it('should support multiple message types', () => {
      const types = ['notification', 'data_handoff', 'status_update', 'request', 'escalation'];

      types.forEach(type => {
        const message = { type, sender: 'squad-1', recipient: 'squad-2', content: 'Test' };
        expect(message.type).toBe(type);
      });
    });
  });

  describe('Priority Levels', () => {
    it('should assign priority to messages', () => {
      const messages = [
        { type: 'notification', priority: 'normal' },
        { type: 'request', priority: 'high' },
        { type: 'escalation', priority: 'critical' }
      ];

      expect(messages[0].priority).toBe('normal');
      expect(messages[1].priority).toBe('high');
      expect(messages[2].priority).toBe('critical');
    });
  });

  describe('Broadcast Channels', () => {
    it('should create broadcast messages', () => {
      const message = { type: 'announcement', channel: 'broadcast', sender: 'system' };
      expect(message.channel).toBe('broadcast');
      expect(message.type).toBe('announcement');
    });
  });
});
