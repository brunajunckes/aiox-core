/**
 * Ollama Cost Optimizer
 * Routes simple tasks to Ollama instead of Opus to save credits
 * Endpoint: http://ollama.ampcast.site:11434/api/generate
 */

const https = require('https');
const http = require('http');

const OLLAMA_URL = 'http://ollama.ampcast.site:11434';
const OLLAMA_MODEL = 'qwen2.5:3b';

async function callOllama(prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 30000;
    const url = new URL(`${OLLAMA_URL}/api/generate`);

    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const body = JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      temperature: options.temperature || 0.7,
    });

    const proto = url.protocol === 'https:' ? https : http;
    const req = proto.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.response || '');
        } catch (e) {
          reject(new Error(`Invalid Ollama response: ${data}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ollama request timeout'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function isSimpleTask(taskType) {
  const SIMPLE_TASKS = [
    'story-update',
    'yaml-generation',
    'json-formatting',
    'boilerplate-code',
    'test-boilerplate',
    'markdown-generation',
    'commit-message',
    'text-formatting',
    'documentation-text',
  ];
  return SIMPLE_TASKS.includes(taskType);
}

async function optimizeTask(taskType, prompt, options = {}) {
  if (!isSimpleTask(taskType)) {
    return null; // Use Opus for complex tasks
  }

  try {
    const response = await callOllama(prompt, { ...options, timeout: 30000 });
    return response;
  } catch (error) {
    console.warn(`⚠️  Ollama failed, falling back to Haiku: ${error.message}`);
    return null; // Fallback to Haiku
  }
}

module.exports = {
  callOllama,
  optimizeTask,
  isSimpleTask,
  OLLAMA_URL,
  OLLAMA_MODEL,
};
