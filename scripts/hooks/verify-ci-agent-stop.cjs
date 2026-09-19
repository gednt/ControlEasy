#!/usr/bin/env node

/**
 * Cross-platform entry point for agent stop hooks.
 *
 * Hook manifests are shared by agents running on Windows hosts and in
 * POSIX devcontainers.  Dispatch here rather than asking each manifest to
 * select a shell, so stdin, exit codes, and the CI gate behaviour remain
 * identical for every agent.
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const isWindows = process.platform === 'win32';
const hookScript = path.join(__dirname, isWindows ? 'verify-ci-agent-stop.ps1' : 'verify-ci-agent-stop.sh');

function run(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
}

let result;
if (isWindows) {
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', hookScript];
  result = run('pwsh', args);

  // Windows PowerShell remains available on machines that do not yet have
  // PowerShell 7.  Only fall back when pwsh itself is unavailable; do not
  // mask a genuine verification failure from the preferred command.
  if (result.error?.code === 'ENOENT') {
    result = run('powershell', args);
  }
} else {
  result = run('bash', [hookScript]);
}

if (result.error) {
  process.stderr.write(`Unable to start the local CI stop hook: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
