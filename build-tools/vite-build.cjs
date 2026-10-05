#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const { exit } = require('node:process');
const path = require('node:path');

const viteCli = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const result = spawnSync(process.execPath, [viteCli, 'build'], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  exit(result.status ?? 1);
}

if (typeof result.status === 'number') {
  exit(result.status);
}

if (result.signal) {
  console.error(`vite build terminated with signal ${result.signal}`);
  exit(1);
}

exit(0);
