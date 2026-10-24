'use strict';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function intFromEnv(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a number, got "${raw}"`);
  const value = Number(raw);
  if (value < 1 || value > 65535) throw new Error(`${name} out of range: ${value}`);
  return value;
}

function loadConfig(env = process.env) {
  const uuid = (env.UUID || '').trim();
  if (!UUID_RE.test(uuid)) {
    throw new Error('UUID is required and must look like 123e4567-e89b-12d3-a456-426614174000');
  }

  const httpPort = intFromEnv(env, 'HTTP_PORT', 3000);
  const entryPort = intFromEnv(env, 'ENTRY_PORT', 8080);
  const publicPort = intFromEnv(env, 'PUBLIC_PORT', 443);

  const subPath = (env.SUB_PATH || 'sub').replace(/^\/+|\/+$/g, '');
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(subPath)) {
    throw new Error('SUB_PATH may only contain letters, digits, dot, underscore and dash');
  }

  const ws = { vless: httpPort + 1, trojan: httpPort + 2, vmess: httpPort + 3 };
  if (ws.vmess > 65535) throw new Error('HTTP_PORT is too high; internal websocket ports overflow');

  const ports = [httpPort, entryPort, ws.vless, ws.trojan, ws.vmess];
  if (new Set(ports).size !== ports.length) {
    throw new Error(`port conflict between HTTP_PORT, ENTRY_PORT and the internal websocket ports: ${ports.join(', ')}`);
  }

  return {
    uuid,
    domain: (env.DOMAIN || '').trim(),
    name: (env.NAME || 'Node').trim(),
    showLog: !/^(0|false|no)$/i.test(env.SHOW_LOG || 'true'),
    publicPort,
    entryPort,
    httpPort,
    subPath,
    ws,
    paths: { vless: '/vless', trojan: '/trojan', vmess: '/vmess' },
  };
}

// Never let a client reach loopback, RFC1918, link-local or cloud metadata addresses.
const PRIVATE_CIDRS = [
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '169.254.0.0/16',
  '::1/128',
  'fc00::/7',
  'fe80::/10',
];

function buildXrayConfig(cfg) {
  const { uuid, ws, paths } = cfg;

  return {
    log: { loglevel: cfg.showLog ? 'warning' : 'none' },
    inbounds: [
      {
        tag: 'entry',
        listen: '0.0.0.0',
        port: cfg.entryPort,
        protocol: 'vless',
        settings: {
          clients: [{ id: uuid, flow: '' }],
          decryption: 'none',
          fallbacks: [
            { path: paths.vless, dest: ws.vless, xver: 0 },
            { path: paths.trojan, dest: ws.trojan, xver: 0 },
            { path: paths.vmess, dest: ws.vmess, xver: 0 },
            { dest: cfg.httpPort, xver: 0 },
          ],
        },
        streamSettings: { network: 'tcp', security: 'none' },
      },
      {
        tag: 'vless-ws',
        listen: '127.0.0.1',
        port: ws.vless,
        protocol: 'vless',
        settings: { clients: [{ id: uuid }], decryption: 'none' },
        streamSettings: {
          network: 'ws',
          security: 'none',
          wsSettings: { path: paths.vless },
        },
      },
      {
        tag: 'trojan-ws',
        listen: '127.0.0.1',
        port: ws.trojan,
        protocol: 'trojan',
        settings: { clients: [{ password: uuid }] },
        streamSettings: {
          network: 'ws',
          security: 'none',
          wsSettings: { path: paths.trojan },
        },
      },
      {
        tag: 'vmess-ws',
        listen: '127.0.0.1',
        port: ws.vmess,
        protocol: 'vmess',
        settings: { clients: [{ id: uuid, alterId: 0 }] },
        streamSettings: {
          network: 'ws',
          security: 'none',
          wsSettings: { path: paths.vmess },
        },
      },
    ],
    outbounds: [
      { tag: 'direct', protocol: 'freedom' },
      { tag: 'block', protocol: 'blackhole' },
    ],
    routing: {
      domainStrategy: 'AsIs',
      rules: [{ type: 'field', ip: PRIVATE_CIDRS, outboundTag: 'block' }],
    },
  };
}

module.exports = { loadConfig, buildXrayConfig };
