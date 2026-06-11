const fs = require('fs');
const path = require('path');

function loadEnvFile(fileName) {
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) return {};

  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).reduce((env, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return env;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return env;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
    return env;
  }, {});
}

const loadedEnv = {
  ...loadEnvFile('.env.production'),
  ...loadEnvFile('.env'),
  NEXTAUTH_URL: 'https://dent-ix.app'
};

const workerEnv = {
  ...loadedEnv,
  NODE_ENV: 'production',
  INGRESS_WORKER_CONCURRENCY: '4',
  CORE_ROUTING_WORKER_CONCURRENCY: '3',
  AI_WORKER_CONCURRENCY: '1',
  EGRESS_WORKER_CONCURRENCY: '3'
};

module.exports = {
  apps: [
    {
      name: 'chatzi-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '768M',
      out_file: './logs/chatzi-web.out.log',
      error_file: './logs/chatzi-web.err.log',
      env: {
        ...loadedEnv,
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'worker-ingress',
      script: 'node_modules/ts-node/dist/bin.js',
      args: '--transpile-only -r tsconfig-paths/register --compiler-options {"module":"commonjs","moduleResolution":"node"} workers/ingress-worker.ts',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1200M',
      out_file: './logs/worker-ingress.out.log',
      error_file: './logs/worker-ingress.err.log',
      env: workerEnv
    },
    {
      name: 'worker-core-routing',
      script: 'node_modules/ts-node/dist/bin.js',
      args: '--transpile-only -r tsconfig-paths/register --compiler-options {"module":"commonjs","moduleResolution":"node"} workers/core-routing-worker.ts',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1200M',
      out_file: './logs/worker-core-routing.out.log',
      error_file: './logs/worker-core-routing.err.log',
      env: workerEnv
    },
    {
      name: 'worker-ai',
      script: 'node_modules/ts-node/dist/bin.js',
      args: '--transpile-only -r tsconfig-paths/register --compiler-options {"module":"commonjs","moduleResolution":"node"} workers/ai-worker.ts',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1200M',
      out_file: './logs/worker-ai.out.log',
      error_file: './logs/worker-ai.err.log',
      env: workerEnv
    },
    {
      name: 'worker-egress',
      script: 'node_modules/ts-node/dist/bin.js',
      args: '--transpile-only -r tsconfig-paths/register --compiler-options {"module":"commonjs","moduleResolution":"node"} workers/egress-worker.ts',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1200M',
      out_file: './logs/worker-egress.out.log',
      error_file: './logs/worker-egress.err.log',
      env: workerEnv
    },
    {
      name: 'worker-outbound',
      script: 'node_modules/ts-node/dist/bin.js',
      args: '--transpile-only -r tsconfig-paths/register --compiler-options {"module":"commonjs","moduleResolution":"node"} workers/outbound-worker.ts',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1200M',
      out_file: './logs/worker-outbound.out.log',
      error_file: './logs/worker-outbound.err.log',
      env: workerEnv
    }
  ]
};
