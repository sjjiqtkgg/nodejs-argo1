'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { buildSubscription } = require('./links');

function send(res, status, contentType, body) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(res.req.method === 'HEAD' ? undefined : body);
}

function startServer(cfg) {
  const landingPath = path.join(__dirname, '..', 'public', 'index.html');
  let landing;
  try {
    landing = fs.readFileSync(landingPath);
  } catch {
    landing = Buffer.from('<!doctype html><meta charset="utf-8"><title>Node</title><h1>OK</h1>');
  }

  const server = http.createServer((req, res) => {
    let pathname;
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      return send(res, 400, 'text/plain; charset=utf-8', 'Bad Request');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
    }

    if (pathname === '/healthz') {
      return send(res, 200, 'text/plain; charset=utf-8', 'ok');
    }

    if (pathname === '/') {
      return send(res, 200, 'text/html; charset=utf-8', landing);
    }

    if (pathname === `/${cfg.subPath}`) {
      const subscription = buildSubscription(cfg, req.headers.host);
      return send(res, 200, 'text/plain; charset=utf-8', `${subscription}\n`);
    }

    return send(res, 404, 'text/plain; charset=utf-8', 'Not Found');
  });

  server.on('error', (err) => {
    console.error('[http] server error:', err.message);
    process.exit(1);
  });

  server.listen(cfg.httpPort, '127.0.0.1', () => {
    console.log(`[http] listening on 127.0.0.1:${cfg.httpPort}, subscription at /${cfg.subPath}`);
  });

  return server;
}

module.exports = { startServer };
