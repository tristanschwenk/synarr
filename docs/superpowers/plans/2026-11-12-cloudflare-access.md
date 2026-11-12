# Cloudflare Tunnel and Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Jellyfin and Seerr public through a Cloudflare Tunnel, and put the hub plus every admin tool behind one Cloudflare Access login on `home.tristanschwenk.fr`, with no router port open.

**Architecture:** A new `cloudflared` container (token tunnel, hostnames configured in the Zero Trust dashboard) forwards `jellyfin.` to Jellyfin on the host, `seerr.` to the `seerr` container, and `home.` to Caddy. Caddy stops publishing port 80, drops every `forward_auth`, routes tools by path and refuses requests without the `Cf-Access-Jwt-Assertion` header. The hub loses Better Auth and opens Jellyfin and Seerr in a new tab.

**Tech Stack:** Docker Compose, cloudflared, Caddy 2, Nuxt 4 + `@vite-pwa/nuxt`, Vitest, Python 3 (`unittest`), Radarr/Sonarr/Prowlarr/Bazarr/Seerr settings files.

**Spec:** `docs/superpowers/specs/2026-11-12-cloudflare-access-design.md`

## Global Constraints

- Hostnames: `home.tristanschwenk.fr` (hub + tools, Access owner-only), `jellyfin.tristanschwenk.fr` and `seerr.tristanschwenk.fr` (public, no Access).
- No router port opened. Caddy publishes no host port.
- Tool paths under `home.`: `/radarr`, `/sonarr`, `/prowlarr`, `/bazarr`, `/transmission`, `/jellystat`.
- Tool host ports (7878, 8989, 9696, 6767, 9091 on `vpn`; 3001 Jellystat; 5055 Seerr) stay published for LAN and tailnet use without a login.
- Secrets only in gitignored `.env`; new variable `CLOUDFLARE_TUNNEL_TOKEN`; `BETTER_AUTH_SECRET` removed.
- `cloudflared`: non-root, not privileged, no volumes, `--no-autoupdate`, no Watchtower label. Same for `caddy` and `hub` (no Watchtower label).
- Never touch the `argos` project's `cloudflared` containers.
- Node projects: `.nvmrc` with `24`, matching `engines` and the Dockerfile base image (`node:24-alpine`). Run Node commands after `source ~/.nvm/nvm.sh && nvm use`.
- Server repo: `/media/raid/storage/docker-streaming-manager` on host `casaoslocal`. Keep its `.env`.
- Commits: Conventional Commits, English.

## Review Focus

1. **A tool path that leaks past the header check** (`/radarr/api/...`, `/transmission/rpc`, `/jellystat/...`): every request to Caddy without `Cf-Access-Jwt-Assertion` must get 403, including API paths. Pinned in Task 3 (curl matrix).
2. **Stored hub modules in localStorage** still pointing Jellyfin/Seerr at `/jellyfin` and `/seerr`, or a user who disabled a module: migration must rewrite the URL and set `openInNewTab` while keeping `active`. Pinned in Task 6 tests.
3. **Integrations that break when UrlBase changes** (Seerr, Prowlarr app sync, Bazarr pointing at Radarr/Sonarr, Prowlarr indexers inside Radarr/Sonarr): each must be updated and pass its own connection test. Pinned in Task 4 tests and Task 8 checks.
4. **PWA files fetched without cookies** (`/manifest.webmanifest`, `/sw.js`, icons) behind Access: install must still work. Pinned in Task 7 (Access bypass rule) and Task 8 check.
5. **Deploy on a server whose compose file has local edits**: the pull must not lose the Watchtower labels or the Sonarr volume. Pinned in Task 1 and Task 8 (`git status` clean before pull).

---

### Task 1: Fold the server's compose edits into the repo

**Files:**
- Modify: `docker-compose.yaml`
- Modify: `.gitignore`

**Interfaces:**
- Produces: a repo `docker-compose.yaml` equal to the server's file except the Bazarr fix and no `version:` key.

- [ ] **Step 1: Fetch the server's working copy (read-only)**

Run: `ssh casaoslocal 'cat /media/raid/storage/docker-streaming-manager/docker-compose.yaml' > /tmp/server-compose.yaml` (use the scratchpad directory, not `/tmp`, if one is set). Do not print secrets; the file contains `${VAR}` references only.

- [ ] **Step 2: Apply the server's edits to the repo file**

Bring over: `image: qmcgaw/gluetun:latest`, `image: jellyfin/jellyfin:latest`, the `com.centurylinklabs.watchtower.enable=true` label on `vpn`, `transmission`, `prowlarr`, `radarr`, `sonarr`, `jellyfin`, `jellystat`, `seerr`, `bazarr`, and the Sonarr volume `/media/raid/storage/TVshows:/data/media/old-seriesa`. Do not bring `version: '3.8'`. Change Bazarr's volume to `/media/raid/storage/TVshows:/data/media/old-seriesa`. Add `data/` to `.gitignore`.

- [ ] **Step 3: Verify**

Run: `diff <(docker compose -f /tmp/server-compose.yaml config 2>/dev/null) <(docker compose config 2>/dev/null)` with a dummy `.env` (all five variables set to `x`), then delete the dummy `.env`.
Expected: only the Bazarr `old-series` → `old-seriesa` line differs.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yaml .gitignore
git commit -m "chore(compose): sync server edits and align Bazarr old-series mount with Sonarr"
```

### Task 2: Compose for the tunnel

**Files:**
- Modify: `docker-compose.yaml`
- Modify: `.env.example`

**Interfaces:**
- Produces: service `cloudflared` on the default compose network; targets reachable from it: `http://caddy:80`, `http://seerr:5055`, `http://host.docker.internal:8096`.

- [ ] **Step 1: Add the `cloudflared` service**

Image `cloudflare/cloudflared:2025.11.1` (or the newest tag at least two weeks old; pin it), `command: tunnel --no-autoupdate run`, `environment: TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN:?set CLOUDFLARE_TUNNEL_TOKEN in .env}`, `extra_hosts: ["host.docker.internal:host-gateway"]`, `restart: always`, `user: "65532:65532"`, `security_opt: [no-new-privileges:true]`, `depends_on: [caddy, seerr]`. No ports, no volumes, no labels.

- [ ] **Step 2: Remove Caddy's published port and the hub's auth env**

Delete `ports: - 80:80` from `caddy`. Delete `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_PATH` and the `./docker-config/hub/db` volume from `hub`.

- [ ] **Step 3: Update `.env.example`**

Remove `BETTER_AUTH_SECRET` and its comment. Add a `# --- Cloudflare Tunnel ---` block with `CLOUDFLARE_TUNNEL_TOKEN=` and a comment: "Zero Trust > Networks > Tunnels > <tunnel> > token".

- [ ] **Step 4: Verify**

Run with a dummy `.env` (`OPENVPN_USER`, `OPENVPN_PASSWORD`, `POSTGRES_PASSWORD`, `JELLYSTAT_JWT_SECRET`, `CLOUDFLARE_TUNNEL_TOKEN` = `x`): `docker compose config -q && docker compose config | grep -c "published"`.
Expected: config valid; no `published: "80"` for caddy. Then `mv .env .env.bak && docker compose config -q` fails with `set CLOUDFLARE_TUNNEL_TOKEN in .env`. Delete both dummy files.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yaml .env.example
git commit -m "feat(compose): add cloudflared tunnel and stop publishing Caddy"
```

### Task 3: Caddyfile without forward_auth, with the Access header check

**Files:**
- Modify: `Caddyfile`
- Create: `bin/test-caddy.sh`

**Interfaces:**
- Consumes: upstream names `hub:3000`, `vpn:7878`, `vpn:8989`, `vpn:9696`, `vpn:6767`, `vpn:9091`, `jellystat:3000`.
- Produces: Caddy on `:80` that returns `403` without `Cf-Access-Jwt-Assertion` and proxies by path otherwise.

- [ ] **Step 1: Write the failing test `bin/test-caddy.sh`**

The script starts `caddy:2-alpine` with the repo `Caddyfile` mounted, on a throwaway Docker network where a tiny echo container (`hashicorp/http-echo:1.0`, `-text=ok`) answers under every upstream name (`--network-alias hub --network-alias vpn --network-alias jellystat`, listening on each needed port, or one echo container per port). It then curls through the Caddy container and asserts, exiting non-zero on the first mismatch:

| Request | Header present | Expected |
| --- | --- | --- |
| `GET /` | no | `403` |
| `GET /radarr/api/v3/system/status` | no | `403` |
| `POST /transmission/rpc` | no | `403` |
| `GET /jellystat/` | no | `403` |
| `GET /` | yes | `200` body `ok` |
| `GET /radarr/` | yes | `200` |
| `GET /sonarr/`, `/prowlarr/`, `/bazarr/`, `/transmission/web/`, `/jellystat/` | yes | `200` |
| `GET /seerr/` | yes | routed to hub (no `/seerr` route left) |

Cleans up containers and network on exit (`trap`).

- [ ] **Step 2: Run it against the current Caddyfile**

Run: `bash bin/test-caddy.sh`
Expected: FAIL on the first row (current file answers via `forward_auth`, not `403`).

- [ ] **Step 3: Rewrite `Caddyfile`**

One `:80` site. First a matcher `@no_access not header Cf-Access-Jwt-Assertion *` with `respond @no_access 403`. Then `handle /radarr*` → `vpn:7878`, `/sonarr*` → `vpn:8989`, `/prowlarr*` → `vpn:9696`, `/bazarr*` → `vpn:6767`, `/transmission*` → `vpn:9091` (no `Authorization` header: RPC auth is off on the server), `/jellystat*` → `jellystat:3000`, and a final `handle` → `hub:3000`. No `forward_auth`, no `/seerr` route. Short comment at the top: Cloudflare Access is the only auth; this file must never be published on a host port.

- [ ] **Step 4: Run the test**

Run: `bash bin/test-caddy.sh`
Expected: all rows pass, exit 0.

- [ ] **Step 5: Commit**

```bash
git add Caddyfile bin/test-caddy.sh
git commit -m "feat(caddy): route tools by path behind Cloudflare Access, drop forward_auth"
```

### Task 4: Settings script for URL bases and integrations

**Files:**
- Modify: `bin/configure-apps.py`
- Create: `bin/test_configure_apps.py`
- Create: `bin/fixtures/` (minimal `config.xml`, Bazarr `config.yaml`, Seerr `settings.json`)

**Interfaces:**
- Produces: `python3 bin/configure-apps.py [--base-dir DIR]`, which edits files under `DIR/docker-config/` and must run while `radarr sonarr prowlarr bazarr seerr` are stopped. Functions:
  - `update_xml_config(filepath: str, url_base: str) -> None` (existing; sets `UrlBase`, `AuthenticationMethod=External`, `AuthenticationRequired=Enabled`)
  - `update_bazarr_yaml(filepath: str) -> None`: sets `general.base_url: /bazarr`, `radarr.base_url: /radarr`, `sonarr.base_url: /sonarr`, keeps every other line byte-for-byte (line-based edit inside the named top-level section, no PyYAML dependency).
  - `update_seerr_settings(filepath: str) -> None`: sets `baseUrl` to `/radarr` on each `radarr[]` entry and `/sonarr` on each `sonarr[]` entry, keeps all other keys, writes with 1-space indent like Seerr.
- Bazarr path is `docker-config/bazarr/config/config.yaml` (the old `config.ini` call is removed).

- [ ] **Step 1: Write failing tests in `bin/test_configure_apps.py`** (`unittest`, copies fixtures to a temp dir)

- `test_xml_sets_url_base_and_external_auth`: after `update_xml_config(path, "/radarr")`, `UrlBase == "/radarr"`, `AuthenticationMethod == "External"`, other elements (`ApiKey`, `Port`) unchanged.
- `test_bazarr_yaml_sets_three_base_urls_only`: after the call, `general.base_url: /bazarr`, `radarr.base_url: /radarr`, `sonarr.base_url: /sonarr`; every other line equal to the fixture; a `base_url: ''` under another section (for example `plex`) unchanged.
- `test_seerr_sets_base_urls_and_keeps_hosts`: `radarr[0].baseUrl == "/radarr"`, `sonarr[0].baseUrl == "/sonarr"`, `hostname` and `apiKey` unchanged.
- `test_script_is_idempotent`: running `main()` twice gives identical files.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -I -m unittest bin/test_configure_apps.py -v`
Expected: FAIL (`update_bazarr_yaml` and `update_seerr_settings` not defined).

- [ ] **Step 3: Implement the two functions, add `--base-dir`, remove the `config.ini` call**

- [ ] **Step 4: Run tests to verify they pass**

Run: `python3 -I -m unittest bin/test_configure_apps.py -v`
Expected: 4 tests OK.

- [ ] **Step 5: Commit**

```bash
git add bin/configure-apps.py bin/test_configure_apps.py bin/fixtures
git commit -m "feat(bin): set URL bases for Bazarr and Seerr integrations"
```

### Task 5: Hub without Better Auth, reproducible build

**Files:**
- Delete: `hub/server/utils/auth.ts`, `hub/server/api/auth/` (all), `hub/composables/useAuth.ts`, `hub/middleware/auth.global.ts`, `hub/pages/login.vue`, `hub/pages/register.vue`, `hub/nginx.conf` (unused)
- Modify: `hub/package.json`, `hub/package-lock.json`, `hub/Dockerfile`, `hub/nuxt.config.ts`
- Create: `hub/.nvmrc`

**Interfaces:**
- Produces: a hub with no `/api/auth/*`, `/login` or `/register`; `npm ci && npm run build` works under Node 24; Docker image builds.

- [ ] **Step 1: Confirm the current build failure**

Run: `cd hub && docker build -t synarr-hub-test .`
Expected: FAIL with `ERESOLVE` (the same error as the server).

- [ ] **Step 2: Remove auth code and dependencies**

Delete the files listed above. In `package.json`: remove `better-auth`, `better-sqlite3`, `@types/better-sqlite3`; pin `nuxt` to `4.4.2`, `@vite-pwa/nuxt` to `1.1.1`, `@vueuse/nuxt` to `14.2.1` (the versions in the current lockfile; if they do not resolve together, pick the newest exact set that does and note it in the commit body); add `"engines": { "node": ">=24" }`; drop `packageManager` (yarn) since the project uses npm. In `nuxt.config.ts`: set `devtools: { enabled: false }`. Grep for leftovers: `grep -rn "authClient\|better-auth\|/login\|/register" hub --exclude-dir=node_modules --exclude-dir=.nuxt --exclude-dir=.output` must print nothing.

- [ ] **Step 3: `.nvmrc` and Dockerfile**

`hub/.nvmrc` = `24`. Dockerfile: both stages `node:24-alpine`; remove `apk add python3 make g++`; `npm ci` instead of `npm install`; stage 2 copies only `.output` (no `node_modules`, no `package*.json`, no `/app/db`).

- [ ] **Step 4: Regenerate the lockfile and build**

Run: `cd hub && source ~/.nvm/nvm.sh && nvm use && rm -rf node_modules && npm install && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Build the image and smoke-test**

Run: `docker build -t synarr-hub-test hub && docker run --rm -d -p 3999:3000 --name hub-smoke synarr-hub-test && sleep 3 && curl -s -o /dev/null -w "%{http_code}\n" localhost:3999/ localhost:3999/login localhost:3999/manifest.webmanifest; docker rm -f hub-smoke`
Expected: `200` for `/` and for the manifest; `curl -s localhost:3999/login | grep -ci password` prints `0`.

- [ ] **Step 6: Commit**

```bash
git add -A hub
git commit -m "refactor(hub): remove Better Auth, rely on Cloudflare Access; pin deps and Node 24"
```

### Task 6: Hub modules open Jellyfin and Seerr in a new tab

**Files:**
- Create: `hub/utils/modules.ts`
- Create: `hub/components/ModuleLink.vue`
- Modify: `hub/composables/useModules.ts`, `hub/app.vue`, `hub/pages/index.vue`, `hub/pages/s/[id].vue`, `hub/pages/settings.vue` (only if it edits URL fields)
- Test: `hub/tests/modules.test.ts`
- Modify: `hub/package.json` (devDependency `vitest`, script `"test": "vitest run"`)

**Interfaces:**
- Produces:
  - `interface Module` gains `openInNewTab: boolean`.
  - `export const DEFAULT_MODULES: Module[]` in `hub/utils/modules.ts`, with `jellyfin` → `url`/`customUrl` `https://jellyfin.tristanschwenk.fr`, `useCustomUrl: true`, `openInNewTab: true`; `seerr` → name `Seerr`, `https://seerr.tristanschwenk.fr`, `useCustomUrl: true`, `openInNewTab: true`, `active: true`; every other module `openInNewTab: false`.
  - `export function migrateModules(stored: Partial<Module>[] | null, defaults: Module[]): Module[]` in the same file (pure; the composable calls it once on load).
  - `<ModuleLink :module="m" v-bind="$attrs">slot</ModuleLink>`: renders `<a :href="m.url" target="_blank" rel="noopener noreferrer">` when `m.openInNewTab`, else `<NuxtLink :to="`/s/${m.id}`">`.

- [ ] **Step 1: Write failing tests in `hub/tests/modules.test.ts`**

- `null stored → returns defaults`
- `stored jellyfin with url "/jellyfin" → url "https://jellyfin.tristanschwenk.fr", openInNewTab true, active kept as stored`
- `stored seerr with active false and name "Overseerr" → url "https://seerr.tristanschwenk.fr", openInNewTab true, active false, name "Seerr"`
- `stored radarr without openInNewTab → openInNewTab false, url "/radarr"`
- `stored homeassistant custom URL → unchanged`
- `module missing from stored → appended from defaults`

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd hub && source ~/.nvm/nvm.sh && nvm use && npm i -D vitest && npx vitest run`
Expected: FAIL (cannot import `~/utils/modules` / `migrateModules`).

- [ ] **Step 3: Implement `hub/utils/modules.ts`, wire `useModules` to it, add `ModuleLink.vue`**

Rule for `migrateModules`: for `jellyfin` and `seerr`, force `url`, `customUrl`, `useCustomUrl`, `openInNewTab` and `name` from defaults and keep the stored `active`; for other modules keep the existing relative-path rule and default `openInNewTab` to `false`. Replace the three `NuxtLink :to="/s/${module.id}"` lists (sidebar and bottom nav in `app.vue`, grid in `pages/index.vue`) with `ModuleLink`. In `pages/s/[id].vue`, when the module has `openInNewTab`, show the "New tab" link and no iframe.

- [ ] **Step 4: Run tests and build**

Run: `cd hub && npx vitest run && npm run build`
Expected: 6 tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add hub
git commit -m "feat(hub): open Jellyfin and Seerr in a new tab at their public hostnames"
```

### Task 7: README setup guide

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the auth parts of the README**

Update the architecture diagram, "Key Highlights" and service table: Cloudflare Tunnel + Access replace the hub's Better Auth and Caddy `forward_auth`. Add a section "Remote access (Cloudflare)" with, in order:
1. **Tunnel:** Zero Trust > Networks > Tunnels > Create (cloudflared), copy the token into `.env` as `CLOUDFLARE_TUNNEL_TOKEN`. Public hostnames: `home.tristanschwenk.fr` → `http://caddy:80`; `jellyfin.tristanschwenk.fr` → `http://host.docker.internal:8096`; `seerr.tristanschwenk.fr` → `http://seerr:5055`.
2. **Login method:** Zero Trust > Settings > Authentication > One-time PIN. Global session duration: 1 month.
3. **Access applications** (self-hosted), in this order:
   - `jellyfin.tristanschwenk.fr`: policy action Bypass, include Everyone.
   - `seerr.tristanschwenk.fr`: Bypass, Everyone.
   - `home.tristanschwenk.fr` paths `manifest.webmanifest`, `sw.js`, `workbox-*.js`, `icon-192x192.png`, `icon-512x512.png`, `favicon.ico`: Bypass, Everyone.
   - `home.tristanschwenk.fr`: Allow, include Emails = the owner's email; session 1 month.
   - `*.tristanschwenk.fr`: Allow, include Emails = the owner's email (lock-by-default safety net).
   - Check: open each URL in a private window; `home.` asks for a PIN, the other two do not.
4. **Jellyfin:** Dashboard > Networking: Published server URIs `all=https://jellyfin.tristanschwenk.fr`; Known proxies `172.17.0.1` and the compose network gateway (`docker network inspect docker-streaming-manager_default -f '{{(index .IPAM.Config 0).Gateway}}'`). Family accounts are not admin.
5. **Seerr:** Settings > General: Application URL `https://seerr.tristanschwenk.fr`; Settings > Users: turn off local login, keep Jellyfin login.
6. **Prowlarr:** Settings > Apps > Radarr and Sonarr: Prowlarr Server `http://localhost:9696/prowlarr`, Radarr Server `http://localhost:7878/radarr`, Sonarr Server `http://localhost:8989/sonarr`; Test, Save, then System > Tasks > Application Indexer Sync.
7. **Tailscale Funnel off:** `tailscale funnel status`, then `tailscale funnel reset`.
8. Note: tools stay reachable without a login on the LAN (`http://<server-ip>:7878/radarr` …) and on the tailnet, by choice.
Remove the "Set secrets" mention of `BETTER_AUTH_SECRET`.

- [ ] **Step 2: Verify no stale references**

Run: `grep -n "Better.Auth\|forward_auth\|BETTER_AUTH\|2FA\|/register" README.md`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document Cloudflare Tunnel and Access setup"
```

### Task 8: Deploy and verify on the server

Owner-driven steps are marked **(owner)**; the executor waits for the owner to confirm each one. The executor may SSH to `casaoslocal` for the other steps.

- [ ] **Step 1: Push** — `git push`.
- [ ] **Step 2 (owner): Cloudflare** — follow README sections 1-3 (tunnel, PIN login, Access applications). Owner adds `CLOUDFLARE_TUNNEL_TOKEN=...` to the server's `.env` (the executor does not handle the token). The executor checks: `ssh casaoslocal "grep -c '^CLOUDFLARE_TUNNEL_TOKEN=.\+' /media/raid/storage/docker-streaming-manager/.env"` prints `1`; then removes the `BETTER_AUTH_SECRET` line from that `.env`.
- [ ] **Step 3: Pull cleanly** — on the server: `git stash` (holds the same edits Task 1 committed), `git pull`, `git stash drop` after `git diff stash@{0} -- docker-compose.yaml` shows only edits now in the repo. Expected: `git status --short` empty.
- [ ] **Step 4: Apply URL bases** — `docker compose stop radarr sonarr prowlarr bazarr seerr`; back up the five settings files: `tar czf ~/synarr-settings-$(date +%F).tgz docker-config/radarr/config.xml docker-config/sonarr/config.xml docker-config/prowlarr/config.xml docker-config/bazarr/config/config.yaml docker-config/seerr/settings.json`; run `python3 bin/configure-apps.py`; `docker compose up -d radarr sonarr prowlarr bazarr seerr`.
- [ ] **Step 5: Rebuild and start** — `docker compose up -d --build hub caddy cloudflared` (the hub build must pass now). `docker compose ps` shows `cloudflared`, `proxy`, `synarr-hub` up; `docker logs cloudflared` shows `Registered tunnel connection` 4 times.
- [ ] **Step 6: LAN checks** — from the server: `curl -s -o /dev/null -w "%{http_code}\n" localhost:7878/radarr/ localhost:8989/sonarr/ localhost:9696/prowlarr/ localhost:6767/bazarr/` all `200`; `curl -s -o /dev/null -w "%{http_code}" localhost:80` fails (Caddy not published).
- [ ] **Step 7 (owner): Integrations** — README sections 5-6; in Seerr Settings > Services, Test on Radarr and Sonarr passes; in Bazarr Settings > Sonarr/Radarr, Test passes; Radarr and Sonarr Settings > Indexers, Test All passes.
- [ ] **Step 8: Internet checks** — from this Mac (off the LAN is not required for these): `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://home.tristanschwenk.fr/radarr/api/v3/system/status` → `302` to `*.cloudflareaccess.com`; `https://home.tristanschwenk.fr/manifest.webmanifest` → `200`; `https://jellyfin.tristanschwenk.fr/health` → `200 Healthy`; `https://seerr.tristanschwenk.fr/api/v1/status` → `200`.
- [ ] **Step 8b: Jellystat sub-path** — open `https://home.tristanschwenk.fr/jellystat/` after login. If assets 404, set Jellystat's base-path variable (check its docs for the current name, for example `JS_BASE_URL=/jellystat`) in compose, commit, redeploy. If Jellystat has no sub-path support, set its hub module `active: false` and record in the README that Jellystat is LAN-only (`http://<server-ip>:3001`).
- [ ] **Step 9 (owner): Real use** — phone on mobile data: Jellyfin app connects to `https://jellyfin.tristanschwenk.fr` and plays; Seerr login with Jellyfin account works; `home.` asks for a PIN once, then Radarr/Sonarr open in the hub without another prompt; install the hub as a PWA and reopen it.
- [ ] **Step 10 (owner): Funnel off** — README section 7, after Step 9 passes.
