#!/usr/bin/env bash
# Checks caddy/routes.caddy: each path reaches the right upstream.
# The real Caddyfile needs the Cloudflare DNS plugin and a token, so this test serves the
# routes alone on plain HTTP with the stock Caddy image.
# Runs Caddy and three fake upstreams (hub, vpn, jellystat) on a throwaway Docker network.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NET="synarr-caddy-test-$$"
PORT="${TEST_CADDY_PORT:-18080}"
TMP="$(mktemp -d)"
IMAGE="caddy:2-alpine"

# A missing file would make Docker create a directory in its place.
[[ -f "$ROOT/caddy/routes.caddy" ]] || { echo "missing caddy/routes.caddy"; exit 1; }

cleanup() {
  docker rm -f "$NET-caddy" "$NET-hub" "$NET-vpn" "$NET-jellystat" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

# Fake upstreams answer with their own name and port.
cat > "$TMP/hub" <<'EOF'
:3000 {
	respond "hub"
}
EOF
cat > "$TMP/jellystat" <<'EOF'
:3000 {
	respond "jellystat"
}
EOF
: > "$TMP/vpn"
for p in 7878 8989 9696 6767 9091; do
  printf ':%s {\n\trespond "vpn-%s"\n}\n' "$p" "$p" >> "$TMP/vpn"
done

cat > "$TMP/Caddyfile" <<'EOF2'
:80 {
	import /etc/caddy/routes.caddy
}
EOF2

docker network create "$NET" >/dev/null
for name in hub vpn jellystat; do
  docker run -d --name "$NET-$name" --network "$NET" --network-alias "$name" \
    -v "$TMP/$name:/etc/caddy/Caddyfile:ro" "$IMAGE" >/dev/null
done
docker run -d --name "$NET-caddy" --network "$NET" -p "127.0.0.1:$PORT:80" \
  -v "$TMP/Caddyfile:/etc/caddy/Caddyfile:ro" \
  -v "$ROOT/caddy/routes.caddy:/etc/caddy/routes.caddy:ro" "$IMAGE" >/dev/null

# Wait for Caddy.
for _ in $(seq 1 30); do
  curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

fail=0
check() { # method path expected_status expected_body
  local method="$1" path="$2" want_status="$3" want_body="$4"
  local status body
  status="$(curl -s -o "$TMP/body" -w "%{http_code}" -X "$method" "http://127.0.0.1:$PORT$path")"
  body="$(cat "$TMP/body")"
  if [[ "$status" != "$want_status" ]] || [[ "$body" != "$want_body" ]]; then
    echo "FAIL $method $path: got $status '$body', want $want_status '$want_body'"
    fail=1
  else
    echo "ok   $method $path -> $status $body"
  fi
}

check GET  /                               200 hub
check GET  /manifest.webmanifest           200 hub
check GET  /radarr/                        200 vpn-7878
check GET  /radarr/api/v3/system/status    200 vpn-7878
check GET  /sonarr/                        200 vpn-8989
check GET  /prowlarr/                      200 vpn-9696
check GET  /bazarr/                        200 vpn-6767
check GET  /transmission/web/              200 vpn-9091
check POST /transmission/rpc               200 vpn-9091
check GET  /jellystat/                     200 jellystat
check GET  /seerr/                         200 hub

exit "$fail"
