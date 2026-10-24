'use strict';

const { spawn } = require('node:child_process');

const FAILURE_WINDOW_MS = 60_000;
const MAX_FAILURES = 10;
const MAX_BACKOFF_MS = 30_000;

function startXray({ configPath, showLog }) {
  let child = null;
  let stopped = false;
  let timer = null;
  let failures = [];
  let settled = false;

  function recordFailure(message) {
    if (stopped || settled) return;
    settled = true;

    console.error(`[xray] ${message}`);

    failures.push(Date.now());
    failures = failures.filter((at) => Date.now() - at < FAILURE_WINDOW_MS);

    if (failures.length >= MAX_FAILURES) {
      console.error(`[xray] ${MAX_FAILURES} failures in ${FAILURE_WINDOW_MS / 1000}s, giving up`);
      process.exit(1);
    }

    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(failures.length - 1, 5));
    console.error(`[xray] restarting in ${delay}ms`);
    timer = setTimeout(launch, delay);
  }

  function launch() {
    if (stopped) return;
    settled = false;

    const startedAt = Date.now();
    child = spawn('xray', ['run', '-c', configPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (showLog) {
      child.stdout.on('data', (chunk) => process.stdout.write(`[xray] ${chunk}`));
    }
    child.stderr.on('data', (chunk) => process.stderr.write(`[xray] ${chunk}`));

    child.on('error', (err) => {
      recordFailure(`failed to spawn: ${err.message}`);
    });

    child.on('exit', (code, signal) => {
      const lived = Date.now() - startedAt;
      recordFailure(`exited code=${code} signal=${signal} after ${lived}ms`);
    });
  }

  launch();

  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      if (child && child.exitCode === null) child.kill('SIGTERM');
    },
  };
}

module.exports = { startXray };
