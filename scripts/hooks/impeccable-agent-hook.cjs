#!/usr/bin/env node

/**
 * Runs the Impeccable hook with the launcher for the current platform.
 *
 * Codex may execute a hook's generic `command` on Windows, so the manifest
 * must not directly invoke the POSIX launcher kept alongside the skill.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const isWindows = process.platform === 'win32';
const launcher = path.join(
  repoRoot,
  '.agents',
  'skills',
  'impeccable',
  'scripts',
  isWindows ? 'impeccable.cmd' : 'impeccable',
);

if (!fs.existsSync(launcher)) {
  process.exit(0);
}

const result = isWindows
  ? spawnSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', 'call .agents\\skills\\impeccable\\scripts\\impeccable.cmd hook'],
      {
        cwd: repoRoot,
        stdio: 'inherit',
        windowsHide: true,
      },
    )
  : spawnSync(launcher, ['hook'], {
      cwd: repoRoot,
      stdio: 'inherit',
    });

if (result.error) {
  process.stderr.write(`Unable to start the Impeccable hook: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
