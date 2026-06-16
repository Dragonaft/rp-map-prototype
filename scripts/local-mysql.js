#!/usr/bin/env node

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { dirname, resolve } = require('path');
const { randomBytes } = require('crypto');
const { spawnSync } = require('child_process');

const rootDir = resolve(__dirname, '..');
const rootEnvPath = resolve(rootDir, '.env');
const apiEnvPath = resolve(rootDir, 'api', '.env');
const command = process.argv[2] || 'up';

const rootDefaults = {
  DB_ROOT_PASSWORD: 'rpmap_root_password',
  DB_NAME: 'rpmap',
  DB_USER_NAME: 'rpmap',
  DB_USER_PASSWORD: 'rpmap_password',
  DB_PORT: '3306',
  JWT_SECRET: randomSecret(),
  JWT_REFRESH_SECRET: randomSecret(),
};

function randomSecret() {
  return randomBytes(32).toString('hex');
}

function readEnv(filePath) {
  const content = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];
  const values = {};

  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match) {
      continue;
    }

    values[match[1]] = normalizeValue(match[2]);
  }

  return { lines, values };
}

function normalizeValue(rawValue) {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function upsertEnv(filePath, updates, overwriteKeys = []) {
  const overwrite = new Set(overwriteKeys);
  const env = readEnv(filePath);
  const handled = new Set();
  const nextLines = env.lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) {
      return line;
    }

    const key = match[1];
    if (!(key in updates)) {
      return line;
    }

    handled.add(key);
    if (!overwrite.has(key) && env.values[key]) {
      return line;
    }

    return `${key}=${updates[key]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!handled.has(key)) {
      nextLines.push(`${key}=${value}`);
    }
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${trimTrailingBlankLine(nextLines).join('\n')}\n`);
}

function trimTrailingBlankLine(lines) {
  const nextLines = [...lines];
  while (nextLines.length > 0 && nextLines[nextLines.length - 1] === '') {
    nextLines.pop();
  }

  return nextLines;
}

function ensureEnvFiles() {
  upsertEnv(rootEnvPath, rootDefaults);
  const rootEnv = readEnv(rootEnvPath).values;
  const apiEnv = readEnv(apiEnvPath).values;

  upsertEnv(
    apiEnvPath,
    {
      DB_HOST: '127.0.0.1',
      DB_PORT: rootEnv.DB_PORT || rootDefaults.DB_PORT,
      DB_NAME: rootEnv.DB_NAME || rootDefaults.DB_NAME,
      DB_USER_NAME: rootEnv.DB_USER_NAME || rootDefaults.DB_USER_NAME,
      DB_USER_PASSWORD: rootEnv.DB_USER_PASSWORD || rootDefaults.DB_USER_PASSWORD,
      JWT_SECRET: apiEnv.JWT_SECRET || rootEnv.JWT_SECRET || rootDefaults.JWT_SECRET,
      JWT_REFRESH_SECRET:
        apiEnv.JWT_REFRESH_SECRET || rootEnv.JWT_REFRESH_SECRET || rootDefaults.JWT_REFRESH_SECRET,
      COOKIE_SECURE: apiEnv.COOKIE_SECURE || 'false',
    },
    ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER_NAME', 'DB_USER_PASSWORD'],
  );

  return readEnv(rootEnvPath).values;
}

function runCompose(rootEnv) {
  const result = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      'docker-compose.yml',
      '-f',
      'docker-compose.local-db.yml',
      'up',
      '-d',
      '--wait',
      'db',
    ],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        DB_PORT: rootEnv.DB_PORT || rootDefaults.DB_PORT,
      },
    },
  );

  if (result.error) {
    console.error(`Failed to start Docker: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(
      'Docker compose failed. The env files were updated; make sure Docker Desktop is running and the MySQL port is free, then rerun npm run db:local.',
    );
  }

  process.exit(result.status || 0);
}

if (!['env', 'up'].includes(command)) {
  console.error('Usage: node scripts/local-mysql.js [env|up]');
  process.exit(1);
}

const rootEnv = ensureEnvFiles();
console.log('Updated .env and api/.env for local MySQL.');
console.log(`API DB URL: mysql://${rootEnv.DB_USER_NAME}@127.0.0.1:${rootEnv.DB_PORT}/${rootEnv.DB_NAME}`);

if (command === 'up') {
  runCompose(rootEnv);
}
