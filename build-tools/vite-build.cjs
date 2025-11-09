#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const { exit, platform } = require('node:process');

process.env.ROLLUP_SKIP_NODEJS_NATIVE_BUILD = '1';

const npxCommand = platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npxCommand, ['vite', 'build', '--outDir', 'dist'], {
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
