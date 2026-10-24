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
| `ENTRY_PORT` | `8080` | Public Xray port |
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

## Limits

- TCP only. No UDP, so no Hysteria2 / TUIC / QUIC, and no REALITY (needs a raw TLS port).
- One shared port, path-based routing.
- Loopback, RFC1918, link-local and metadata ranges are blocked on the proxy side.

Use it for personal access only, and follow the terms of the platform you deploy on.
