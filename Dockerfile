FROM node:20-bookworm-slim

ARG TARGETARCH=amd64
# Pinned to a release verified with this config. Override with --build-arg to upgrade.
ARG XRAY_VERSION=v26.10.21

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl unzip \
 && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) ASSET="Xray-linux-64.zip" ;; \
      arm64) ASSET="Xray-linux-arm64-v8a.zip" ;; \
      *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    if [ "${XRAY_VERSION}" = "latest" ]; then \
      XRAY_VERSION="$(curl -fsSL https://api.github.com/repos/XTLS/Xray-core/releases/latest \
        | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"; \
    fi; \
    test -n "${XRAY_VERSION}"; \
    BASE="https://github.com/XTLS/Xray-core/releases/download/${XRAY_VERSION}/${ASSET}"; \
    curl -fsSL -o /tmp/xray.zip "${BASE}"; \
    curl -fsSL -o /tmp/xray.dgst "${BASE}.dgst"; \
    EXPECTED="$(sed -n 's/^SHA2-256[[:space:]]*[=:][[:space:]]*//p' /tmp/xray.dgst | head -n1 | tr -d ' \r')"; \
    test -n "${EXPECTED}"; \
    echo "${EXPECTED}  /tmp/xray.zip" | sha256sum -c -; \
    unzip -q -o /tmp/xray.zip -d /tmp/xray; \
    install -m 0755 /tmp/xray/xray /usr/local/bin/xray; \
    rm -rf /tmp/xray /tmp/xray.zip /tmp/xray.dgst; \
    xray version | head -n1

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY public ./public

ENV NODE_ENV=production \
    ENTRY_PORT=8080 \
    HTTP_PORT=3000

EXPOSE 8080

CMD ["node", "src/index.js"]
