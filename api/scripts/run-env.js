#!/usr/bin/env node
'use strict';

// Picks the dev (ts-node against src/) or prod (node against compiled dist/)
// invocation for a script or typeorm command, based on NODE_ENV. The prod
// Docker image only ships dist/ (see api/Dockerfile) — src/ isn't present —
// so this must always resolve correctly from the environment, not a flag.

const { spawnSync } = require('child_process');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const [mode, ...rest] = process.argv.slice(2);

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(result.status === null ? 1 : result.status);
}

if (mode === 'script') {
  const [name] = rest;
  if (!name) {
    console.error('Usage: node scripts/run-env.js script <name>');
    process.exit(1);
  }
  if (isProd) {
    run('node', [path.join('dist', 'scripts', `${name}.js`)]);
  } else {
    run('npx', ['ts-node', path.join('src', 'scripts', `${name}.ts`)]);
  }
} else if (mode === 'typeorm') {
  if (isProd) {
    // Call the CLI entry directly instead of through npx — npx holds open an extra resident
    // node process for the command's lifetime, which matters on a memory-constrained host
    // running migrations alongside mysqld and the API itself. typeorm's package.json maps
    // bin.typeorm -> ./cli.js.
    run('node', [path.join('node_modules', 'typeorm', 'cli.js'), ...rest, '-d', 'dist/db/data-source.prod.js']);
  } else {
    // Dev needs the ts-node registration wrapper, so this path still goes through npx.
    run('npx', ['typeorm-ts-node-commonjs', ...rest, '-d', 'src/db/data-source.ts']);
  }
} else {
  console.error('Usage: node scripts/run-env.js <script|typeorm> ...');
  process.exit(1);
}
