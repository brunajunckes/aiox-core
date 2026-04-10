/**
 * Squad Communication Message Formatter
 * Formats and validates squad messages
 */

/**
 * Message types
 */
const MESSAGE_TYPES = {
  notification: 'notification',
  dataHandoff: 'data_handoff',
  statusUpdate: 'status_update',
  request: 'request',
  escalation: 'escalation',
  announcement: 'announcement'
};

/**
 * Validate message structure
 */
function validateMessage(message) {
  if (!message.type || !MESSAGE_TYPES[message.type]) {
    throw new Error(`Invalid message type: ${message.type}`);
  }
  if (!message.sender) throw new Error('Message must have sender');
  if (!message.content) throw new Error('Message must have content');

  return true;
}

/**
 * Format message for logging
 */
function formatForLog(message) {
  return {
    timestamp: new Date().toISOString(),
    type: message.type,
    sender: message.sender,
    recipient: message.recipient || null,
    channel: message.channel || null,
    contentLength: typeof message.content === 'string' ? message.content.length : 0,
    priority: message.priority || 'normal',
    acknowledged: message.acknowledged || false
  };
}

/**
 * Format message for display
 */
function formatForDisplay(message) {
  return {
    timestamp: message.timestamp,
    from: message.sender,
    to: message.recipient,
    type: message.type,
    priority: message.priority,
    content: message.content,
    acknowledged: message.acknowledged
  };
}

/**
 * Create notification message
 */
function createNotification(sender, recipient, content) {
  return {
    type: MESSAGE_TYPES.notification,
    sender,
    recipient,
    content,
    priority: 'normal'
  };
}

/**
 * Create data handoff message
 */
function createDataHandoff(sender, recipient, data) {
  return {
    type: MESSAGE_TYPES.dataHandoff,
    sender,
    recipient,
    content: data,
    priority: 'high'
  };
}

/**
 * Create status update message
 */
function createStatusUpdate(sender, recipient, status) {
  return {
    type: MESSAGE_TYPES.statusUpdate,
    sender,
    recipient,
    content: status,
    priority: 'normal'
  };
}

/**
 * Create request message
 */
function createRequest(sender, recipient, request) {
  return {
    type: MESSAGE_TYPES.request,
    sender,
    recipient,
    content: request,
    priority: 'high',
    requiresAcknowledgment: true
  };
}

/**
 * Create escalation message
 */
function createEscalation(sender, recipient, issue) {
  return {
    type: MESSAGE_TYPES.escalation,
    sender,
    recipient,
    content: issue,
    priority: 'critical',
    requiresAcknowledgment: true
  };
}

/**
 * Create announcement message
 */
function createAnnouncement(sender, content) {
  return {
    type: MESSAGE_TYPES.announcement,
    sender,
    recipient: null,
    content,
    priority: 'high'
  };
}

/**
 * Filter messages by priority
 */
function filterByPriority(messages, priority) {
  return messages.filter(m => m.priority === priority);
}

/**
 * Sort messages by timestamp
 */
function sortByTimestamp(messages, ascending = true) {
  const sorted = [...messages].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return ascending ? timeA - timeB : timeB - timeA;
  });
  return sorted;
}

module.exports = {
  MESSAGE_TYPES,
  validateMessage,
  formatForLog,
  formatForDisplay,
  createNotification,
  createDataHandoff,
  createStatusUpdate,
  createRequest,
  createEscalation,
  createAnnouncement,
  filterByPriority,
  sortByTimestamp
};
