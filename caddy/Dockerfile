# Caddy with the Cloudflare DNS plugin, for the Let's Encrypt DNS challenge.
FROM caddy:2.11.7-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare@v0.2.4

FROM caddy:2.11.7-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
