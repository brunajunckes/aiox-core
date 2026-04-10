#!/usr/bin/env node
'use strict';

/**
 * AIOX Ollama MCP Server
 * Exposes Ollama as an MCP tool for Claude Code subagents.
 * Uses stdio transport (stdin/stdout JSON-RPC).
 */

const http = require('http');
const readline = require('readline');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen2:7b-instruct';

// JSON-RPC over stdio
const rl = readline.createInterface({ input: process.stdin, terminal: false });
let buffer = '';

function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
}

function sendError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
}

function sendNotification(method, params) {
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`);
}

async function callOllama(prompt, opts = {}) {
  const { model = DEFAULT_MODEL, system, temperature = 0.7, maxTokens = 2048 } = opts;
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const body = JSON.stringify({
    model,
    messages,
    stream: false,
    options: { temperature, num_predict: maxTokens },
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${OLLAMA_URL}/api/chat`);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 120000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.message?.content || parsed.response || 'No response');
        } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama timeout')); });
    req.write(body);
    req.end();
  });
}

const TOOLS = [
  {
    name: 'ollama_generate',
    description: 'Generate text using local Ollama LLM (qwen2:7b-instruct). Use for simple tasks: story updates, code generation, text formatting, YAML/JSON creation. Free and local - no API cost.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt to send to Ollama' },
        system: { type: 'string', description: 'Optional system prompt for context' },
        model: { type: 'string', description: 'Model name (default: qwen2:7b-instruct)' },
        temperature: { type: 'number', description: 'Temperature 0-1 (default: 0.7)' },
        max_tokens: { type: 'number', description: 'Max tokens (default: 2048)' },
      },
      required: ['prompt'],
    },
  },
];

async function handleRequest(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'aiox-ollama', version: '1.0.0' },
      });
      break;

    case 'notifications/initialized':
      // Client confirmed initialization
      break;

    case 'tools/list':
      sendResponse(id, { tools: TOOLS });
      break;

    case 'tools/call': {
      const { name, arguments: args } = params;
      if (name !== 'ollama_generate') {
        sendError(id, -32601, `Unknown tool: ${name}`);
        return;
      }
      try {
        const result = await callOllama(args.prompt, {
          system: args.system,
          model: args.model,
          temperature: args.temperature,
          maxTokens: args.max_tokens,
        });
        sendResponse(id, {
          content: [{ type: 'text', text: result }],
        });
      } catch (err) {
        sendResponse(id, {
          content: [{ type: 'text', text: `Ollama error: ${err.message}` }],
          isError: true,
        });
      }
      break;
    }

    default:
      if (id) sendError(id, -32601, `Method not found: ${method}`);
  }
}

// Parse MCP messages (Content-Length header framing)
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;
    const header = buffer.substring(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) { buffer = buffer.substring(headerEnd + 4); continue; }
    const len = parseInt(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) break;
    const body = buffer.substring(bodyStart, bodyStart + len);
    buffer = buffer.substring(bodyStart + len);
    try {
      handleRequest(JSON.parse(body));
    } catch (err) {
      process.stderr.write(`Parse error: ${err.message}\n`);
    }
  }
});

process.stderr.write('AIOX Ollama MCP Server started\n');
