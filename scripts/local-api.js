#!/usr/bin/env node

const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');

const rootDir = resolve(__dirname, '..');
const apiDir = resolve(rootDir, 'api');
const apiEnvPath = resolve(apiDir, '.env');
const npmCmd = 'npm';
const useShell = process.platform === 'win32';

function readEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match) {
      continue;
    }

    values[match[1]] = normalizeEnvValue(match[2]);
  }

  return values;
}

function normalizeEnvValue(rawValue) {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function getApiEnv() {
  return {
    ...process.env,
    ...readEnvFile(apiEnvPath),
    NODE_ENV: 'development',
    COOKIE_SECURE: process.env.COOKIE_SECURE || 'false',
  };
}

const steps = [
  {
    label: 'Install API dependencies',
    command: npmCmd,
    cwd: apiDir,
    args: ['install'],
    skip: () => existsSync(resolve(apiDir, 'node_modules')),
  },
  {
    label: 'Start local MySQL',
    command: process.execPath,
    cwd: rootDir,
    args: [resolve(rootDir, 'scripts', 'local-mysql.js'), 'up'],
  },
  {
    label: 'Run API migrations',
    command: npmCmd,
    cwd: apiDir,
    args: ['run', 'migration:run'],
    useApiEnv: true,
  },
  {
    label: 'Seed techs',
    command: npmCmd,
    cwd: apiDir,
    args: ['run', 'seed:techs'],
    useApiEnv: true,
  },
  {
    label: 'Seed buildings',
    command: npmCmd,
    cwd: apiDir,
    args: ['run', 'seed:buildings'],
    useApiEnv: true,
  },
  {
    label: 'Seed troop types',
    command: npmCmd,
    cwd: apiDir,
    args: ['run', 'seed:troop-types'],
    useApiEnv: true,
  },
  {
    label: 'Import provinces',
    command: npmCmd,
    cwd: apiDir,
    args: ['run', 'import:provinces'],
    useApiEnv: true,
  },
  {
    label: 'Seed test countries',
    command: npmCmd,
    cwd: apiDir,
    args: ['run', 'seed:test-countries'],
    useApiEnv: true,
  },
  {
    label: 'Start API',
    command: npmCmd,
    cwd: apiDir,
    args: ['run', 'start:dev'],
    useApiEnv: true,
  },
];

function runStep(step) {
  if (step.skip?.()) {
    console.log(`\n==> ${step.label} (skipped)`);
    return;
  }

  console.log(`\n==> ${step.label}`);
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    env: step.useApiEnv ? getApiEnv() : process.env,
    shell: step.command === npmCmd ? useShell : false,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`Failed to run "${step.label}": ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Step failed: ${step.label}`);
    process.exit(result.status || 1);
  }
}

for (const step of steps) {
  runStep(step);
}
