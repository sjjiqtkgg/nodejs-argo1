# xray-node

Single-port VLESS / Trojan / VMess over WebSocket, built for platforms that expose one
HTTP port and terminate TLS at the edge (InstaCloud, Render, Railway, Fly, ...).

- No tunnel, no cloudflared, no third-party binaries.
- Xray-core comes from the official GitHub release and is verified against the published
  `SHA2-256` digest at build time.
- Zero npm dependencies, under 500 lines of readable Node.
- Xray is pinned to `v26.10.21` (override with `--build-arg XRAY_VERSION=...`).

## How it works

```
client --wss://host/vless --> edge TLS --> xray :8080
                                            ├─ /vless  -> 127.0.0.1:3001 (VLESS-WS)
                                            ├─ /trojan -> 127.0.0.1:3002 (Trojan-WS)
                                            ├─ /vmess  -> 127.0.0.1:3003 (VMess-WS)
                                            └─ other   -> 127.0.0.1:3000 (Node)
                                                            ├─ /        landing page
                                                            ├─ /sub     subscription
                                                            └─ /healthz health check
```

Only Xray listens publicly. Node binds to loopback and serves the subscription that Xray's
VLESS fallback routes to it.

## Environment

| Variable | Default | Description |
|---|---|---|
| `UUID` | required | VLESS/VMess id, also the Trojan password |
| `DOMAIN` | empty | Public hostname for the links; empty means use the request `Host` header |
| `PUBLIC_PORT` | `443` | Port written into the links |
| `ENTRY_PORT` | `$PORT`, else `8080` | Public Xray port |
| `HTTP_PORT` | `3000` | Internal Node port (WS ports are +1, +2, +3) |
| `SUB_PATH` | `sub` | Subscription path |
| `NAME` | `Node` | Node name in the links |
| `SHOW_LOG` | `true` | Print Xray logs |

Generate a UUID with `node -e "console.log(crypto.randomUUID())"`.

## Run locally

```bash
docker build -t xray-node .
docker run --rm -p 8080:8080 -e UUID=<your-uuid> xray-node
```

```bash
curl -s localhost:8080/healthz
curl -s localhost:8080/sub | base64 -d
```

The links will point at `https://<host>` because the platform terminates TLS. For a local
end-to-end test, run an Xray client against `ws://127.0.0.1:8080/vless` with
`security: none`.

## Deploy on InstaCloud

```bash
insta services add compute node
insta deploy . --port 8080 --websocket
insta compute always-on on
```

Set `UUID` (and optionally `DOMAIN`) as service environment variables, then import
`https://<service-host>/sub` into your client.

`always-on` is required: a suspended service drops every WebSocket connection.

## Deploy from GitHub

The Dockerfile must sit at the repository root (or pass `--root-dir`). Then connect the repo
to an existing compute service:

```bash
insta services add compute node
insta compute connect-repo <owner>/<repo> node --port 8080
```

- A **private** repo (InstaCloud GitHub App installed) redeploys on every push.
- A **public** repo deploys once; later pushes do not redeploy.
- `connect-repo` has no `--websocket` flag. The WebSocket setting lives on the service:
  either deploy once with `insta deploy . --port 8080 --websocket` before connecting the repo,
  or turn it on in the service settings in the console.
- Set `UUID` as a service environment variable; never commit it.

If you only need one deploy, `insta deploy . --port 8080 --websocket` from this directory is
simpler and fully supported.

## Other platforms

The image is generic: one HTTP port, TLS terminated by the platform, WebSocket for transport.
It runs anywhere that gives you (a) an HTTPS hostname, (b) WebSocket support, and (c) a
process that stays up. `PORT` is honoured automatically when the platform injects it.

- **Render / Railway / Koyeb / Zeabur / ClawCloud**: set `UUID`, enable WebSocket if the
  platform exposes a toggle, and turn off idle sleep.
- **Fly.io**: set `internal_port = 8080` in `fly.toml`; WebSocket works out of the box.
- **Your own VPS**: run the container behind Caddy or nginx for TLS.

If the platform rewrites the `Host` header, set `DOMAIN` so the subscription links stay correct.

Not suitable for Vercel, Netlify or Cloudflare Workers: they do not run a long-lived process
that can hold a server-side WebSocket.

## Limits

- TCP only. No UDP, so no Hysteria2 / TUIC / QUIC, and no REALITY (needs a raw TLS port).
- One shared port, path-based routing.
- Loopback, RFC1918, link-local and metadata ranges are blocked on the proxy side.

Use it for personal access only, and follow the terms of the platform you deploy on.
