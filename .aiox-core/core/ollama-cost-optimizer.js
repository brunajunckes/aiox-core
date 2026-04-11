/**
 * Ollama Cost Optimizer — Dual Model Routing
 * Routes tasks strategically to maximize quality/speed
 * - qwen2.5:7b: Fast, structured output (YAML, JSON, code)
 * - gemma4:e4b: Deep reasoning, complex analysis
 * Endpoint: http://ollama.ampcast.site:11434/api/generate
 */

const https = require('https');
const http = require('http');

const OLLAMA_URL = 'http://ollama.ampcast.site:11434';
const MODELS = {
  PRIMARY: 'qwen2.5:7b',      // Fast, structured (default)
  REASONING: 'gemma4:e4b',    // Complex reasoning
};

function selectModel(taskType) {
  const reasoningTasks = [
    'architecture-analysis',
    'complex-reasoning',
    'pattern-analysis',
    'code-review',
    'multi-step-logic',
    'deep-analysis',
  ];

  if (reasoningTasks.includes(taskType)) {
    return MODELS.REASONING;
  }
  return MODELS.PRIMARY;
}

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

    const model = options.model || MODELS.PRIMARY;
    const body = JSON.stringify({
      model,
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
    const model = selectModel(taskType);
    const response = await callOllama(prompt, { ...options, model, timeout: 30000 });
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
  selectModel,
  OLLAMA_URL,
  MODELS,
};
