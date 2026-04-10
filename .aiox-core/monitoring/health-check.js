#!/usr/bin/env node

/**
 * AIOX Infrastructure Health Check
 * Monitors Docker containers and service endpoints.
 */

import { execSync } from 'node:child_process';
import http from 'node:http';

const CONTAINERS = [
  { name: 'llm-router-api', port: 3000, healthPath: '/health' },
  { name: 'llm-router-postgres', port: 5432 },
  { name: 'llm-router-redis', port: 6379 },
  { name: 'llm-router-minio', port: 9000 },
  { name: 'ollama', port: 11434 },
];

async function checkDocker() {
  const results = [];
  try {
    const output = execSync('docker ps --format "{{.Names}}|{{.Status}}"', { encoding: 'utf-8' });
    const running = new Map();
    for (const line of output.trim().split('\n')) {
      const [name, status] = line.split('|');
      running.set(name, status);
    }

    for (const container of CONTAINERS) {
      const status = running.get(container.name);
      results.push({
        name: container.name,
        port: container.port,
        running: !!status,
        healthy: status?.includes('healthy') || status?.includes('Up'),
        status: status || 'NOT RUNNING',
      });
    }
  } catch {
    for (const container of CONTAINERS) {
      results.push({ name: container.name, running: false, healthy: false, status: 'DOCKER ERROR' });
    }
  }
  return results;
}

function checkEndpoint(host, port, path = '/') {
  return new Promise((resolve) => {
    const req = http.get({ hostname: host, port, path, timeout: 5000 }, (res) => {
      resolve({ port, status: res.statusCode, healthy: res.statusCode < 400 });
    });
    req.on('error', () => resolve({ port, status: 0, healthy: false }));
    req.on('timeout', () => { req.destroy(); resolve({ port, status: 0, healthy: false }); });
  });
}

async function run() {
  console.log('='.repeat(50));
  console.log(' AIOX Health Check Report');
  console.log(' Date:', new Date().toISOString());
  console.log('='.repeat(50));

  const containers = await checkDocker();
  console.log('\n Docker Containers:');
  for (const c of containers) {
    const icon = c.healthy ? '✅' : '❌';
    console.log(`  ${icon} ${c.name}:${c.port} — ${c.status}`);
  }

  // Check HTTP endpoints
  console.log('\n HTTP Endpoints:');
  for (const c of CONTAINERS) {
    if (c.healthPath) {
      const result = await checkEndpoint('localhost', c.port, c.healthPath);
      const icon = result.healthy ? '✅' : '❌';
      console.log(`  ${icon} localhost:${c.port}${c.healthPath} — HTTP ${result.status}`);
    }
  }

  const allHealthy = containers.every(c => c.healthy);
  console.log(`\n Overall: ${allHealthy ? '✅ ALL HEALTHY' : '⚠️  DEGRADED'}`);
  console.log('='.repeat(50));

  return { containers, allHealthy, timestamp: new Date().toISOString() };
}

run().catch(console.error);
