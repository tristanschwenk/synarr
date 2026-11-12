#!/usr/bin/env bash
# Checks the repo Caddyfile: every request without the Cloudflare Access header gets 403,
# and with the header each path reaches the right upstream.
# Runs Caddy and three fake upstreams (hub, vpn, jellystat) on a throwaway Docker network.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NET="synarr-caddy-test-$$"
PORT="${TEST_CADDY_PORT:-18080}"
TMP="$(mktemp -d)"
IMAGE="caddy:2-alpine"

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

docker network create "$NET" >/dev/null
for name in hub vpn jellystat; do
  docker run -d --name "$NET-$name" --network "$NET" --network-alias "$name" \
    -v "$TMP/$name:/etc/caddy/Caddyfile:ro" "$IMAGE" >/dev/null
done
docker run -d --name "$NET-caddy" --network "$NET" -p "127.0.0.1:$PORT:80" \
  -v "$ROOT/Caddyfile:/etc/caddy/Caddyfile:ro" "$IMAGE" >/dev/null

# Wait for Caddy.
for _ in $(seq 1 30); do
  curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 0.5
done

fail=0
check() { # method path header(yes|no) expected_status [expected_body]
  local method="$1" path="$2" hdr="$3" want_status="$4" want_body="${5:-}"
  local args=(-s -o "$TMP/body" -w "%{http_code}" -X "$method")
  [[ "$hdr" == yes ]] && args+=(-H "Cf-Access-Jwt-Assertion: test")
  local status body
  status="$(curl "${args[@]}" "http://127.0.0.1:$PORT$path")"
  body="$(cat "$TMP/body")"
  if [[ "$status" != "$want_status" ]] || { [[ -n "$want_body" ]] && [[ "$body" != "$want_body" ]]; }; then
    echo "FAIL $method $path header=$hdr: got $status '$body', want $want_status '${want_body}'"
    fail=1
  else
    echo "ok   $method $path header=$hdr -> $status ${body}"
  fi
}

check GET  /                               no  403
check GET  /radarr/api/v3/system/status    no  403
check POST /transmission/rpc               no  403
check GET  /jellystat/                     no  403
check GET  /                               yes 200 hub
check GET  /radarr/                        yes 200 vpn-7878
check GET  /sonarr/                        yes 200 vpn-8989
check GET  /prowlarr/                      yes 200 vpn-9696
check GET  /bazarr/                        yes 200 vpn-6767
check GET  /transmission/web/              yes 200 vpn-9091
check GET  /jellystat/                     yes 200 jellystat
check GET  /seerr/                         yes 200 hub

exit "$fail"
