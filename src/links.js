'use strict';

const { Buffer } = require('node:buffer');

function hostFromRequest(cfg, headerHost) {
  if (cfg.domain) return cfg.domain;
  const host = (headerHost || '').trim();
  if (!host) return 'localhost';
  if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1);
  return host.split(':')[0];
}

function buildLinks(cfg, headerHost) {
  const host = hostFromRequest(cfg, headerHost);
  const port = cfg.publicPort;
  const tag = encodeURIComponent(cfg.name);
  const enc = encodeURIComponent;

  const vless = `vless://${cfg.uuid}@${host}:${port}`
    + `?encryption=none&security=tls&sni=${host}&fp=chrome&type=ws&host=${host}`
    + `&path=${enc(cfg.paths.vless)}#${tag}`;

  const trojan = `trojan://${cfg.uuid}@${host}:${port}`
    + `?security=tls&sni=${host}&fp=chrome&type=ws&host=${host}`
    + `&path=${enc(cfg.paths.trojan)}#${tag}`;

  const vmessJson = {
    v: '2',
    ps: cfg.name,
    add: host,
    port: String(port),
    id: cfg.uuid,
    aid: '0',
    scy: 'auto',
    net: 'ws',
    type: 'none',
    host,
    path: cfg.paths.vmess,
    tls: 'tls',
    sni: host,
    alpn: '',
    fp: 'chrome',
  };
  const vmess = `vmess://${Buffer.from(JSON.stringify(vmessJson), 'utf8').toString('base64')}`;

  return { vless, trojan, vmess };
}

function buildSubscription(cfg, headerHost) {
  const { vless, trojan, vmess } = buildLinks(cfg, headerHost);
  return Buffer.from([vless, trojan, vmess].join('\n'), 'utf8').toString('base64');
}

module.exports = { buildLinks, buildSubscription, hostFromRequest };
