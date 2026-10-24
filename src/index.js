'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadConfig, buildXrayConfig } = require('./config');
const { startXray } = require('./xray');
const { startServer } = require('./server');

function main() {
  let cfg;
  try {
    cfg = loadConfig();
  } catch (err) {
    console.error(`[config] ${err.message}`);
    process.exit(1);
  }

  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xray-node-'));
  const configPath = path.join(configDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(buildXrayConfig(cfg), null, 2));

  const server = startServer(cfg);
  const xray = startXray({ configPath, showLog: cfg.showLog });

  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[boot] ${signal} received, shutting down`);
    xray.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log(`[boot] entry 0.0.0.0:${cfg.entryPort} -> http 127.0.0.1:${cfg.httpPort}`);
  console.log(`[boot] websocket paths ${cfg.paths.vless}, ${cfg.paths.trojan}, ${cfg.paths.vmess}`);
}

main();
