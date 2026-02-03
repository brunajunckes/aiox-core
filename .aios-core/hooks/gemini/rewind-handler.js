#!/usr/bin/env node
/**
 * AIOS Rewind Handler
 * Story GEMINI-INT.14 - /rewind Integration
 *
 * Syncs Gemini's /rewind command with AIOS state.
 */

const fs = require('fs');
const path = require('path');

async function handleRewind() {
  const projectDir = process.env.GEMINI_PROJECT_DIR || process.cwd();
  const sessionId = process.env.GEMINI_SESSION_ID;

  // Sync with AIOS memory layer
  try {
    const memoryDir = path.join(projectDir, '.aios', 'memory');

    if (fs.existsSync(memoryDir)) {
      // Clear session-specific memory
      const sessionMemory = path.join(memoryDir, `session-${sessionId}.json`);
      if (fs.existsSync(sessionMemory)) {
        fs.unlinkSync(sessionMemory);
      }
    }

    // Log the rewind event
    const logDir = path.join(projectDir, '.aios', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const rewindLog = {
      timestamp: new Date().toISOString(),
      sessionId,
      action: 'rewind',
      provider: 'gemini',
    };

    const logPath = path.join(logDir, 'rewind.jsonl');
    fs.appendFileSync(logPath, JSON.stringify(rewindLog) + '\n');

    console.log(JSON.stringify({ status: 'success', synced: true }));
  } catch (error) {
    console.log(JSON.stringify({ status: 'error', error: error.message }));
  }

  process.exit(0);
}

handleRewind();
