# Remote access through Cloudflare Tunnel and Cloudflare Access

Date: 2026-11-12
Status: draft, waiting for approval

## Intent

The Synarr stack (hub, *arr tools, Jellyfin, Seerr) has been paused because remote
access never worked well. Today the only public access is a Tailscale Funnel URL that
points at Jellyfin alone (one port, a `*.ts.net` name, bandwidth-limited relays).

The owner wants:

- Family and a few friends to watch on Jellyfin and request content on Seerr, from
  browsers, iPhones, Apple TVs and smart TVs, without installing anything extra.
- Admin tools reachable only by the owner, behind one login that lasts, so there is no
  re-authentication all the time.
- The hub (Nuxt PWA with iframes) to be the owner's single entry point to the admin
  tools, installed as a PWA on the phone.
- No port opened on the home router. Nothing on the server is directly reachable from
  the internet.

## Goals

1. Cloudflare Tunnel is the only way in from the internet. The router keeps every port
   closed.
2. `jellyfin.tristanschwenk.fr` and `seerr.tristanschwenk.fr` (Seerr) are public
   through the tunnel, with no Cloudflare login. Jellyfin accounts protect both. Native
   Jellyfin apps work.
3. `home.tristanschwenk.fr` serves the hub and every admin tool under paths
   (`/radarr`, `/sonarr`, `/prowlarr`, `/bazarr`, `/transmission`, `/jellystat`),
   behind Cloudflare Access, allowed for the owner's email only.
4. One Access login covers the hub and every admin tool, including inside the hub's
   iframes, for up to 1 month.
5. The hub keeps working as an installable PWA under Access.
6. The admin tools and the hub drop their own logins. Access is their only lock.

## Non-goals

- No access for anyone other than the owner to `home.tristanschwenk.fr`.
- No per-tool hostnames (`radarr.tristanschwenk.fr` etc.). Rejected because the Access
  login page cannot load in an iframe and per-host cookies break the hub's iframes.
- No change to the VPN sidecar, the download pipeline or the media layout.
- No Tailscale client on viewers' devices.
- No relay VPS now. It is the fallback if Cloudflare objects to video traffic (see Risks).

## Anti-goals (failure even if it technically works)

- Any admin tool reachable from the internet without the Access login, for example
  through a hostname added later without a policy, or a path that bypasses Caddy.
- Viewers forced to sign in to Cloudflare, or Jellyfin apps that cannot connect.
- Seerr losing the link between a request and the Jellyfin user who made it.
- Secrets (tunnel token) committed to git.
- Any port opened on the router, or any container published on `0.0.0.0` that is
  reachable from outside.

## Decisions made by the owner

- Everything goes through Cloudflare, including Jellyfin video. The owner accepts the
  Cloudflare terms-of-service risk on video at family scale.
- Tailscale Funnel is turned off once the tunnel works.
- Seerr keeps Jellyfin sign-in, so each request records who made it.
- `home.tristanschwenk.fr` is for the owner only.
- Hub and admin tools stay on one hostname with paths (the existing Caddy layout).
- Admin tools stay reachable without a login from the home LAN (server IP and ports)
  and over the owner's Tailscale network. This is accepted: it is also the fallback when
  the internet or Cloudflare is down. Their published host ports stay as they are.
- Jellyfin and Seerr open in a new tab (or the native app) from the hub, not in an
  iframe.
- The domain `tristanschwenk.fr` is now on Cloudflare (moved from Infomaniak on
  2026-11-12). Email stays on Infomaniak; its DNS records must not change.

## Current state (from the repo and the server)

- `docker-compose.yaml`: Caddy (`proxy`) on host port 80, routes paths with
  `forward_auth` to the hub's `/api/auth/verify`. The `proxy` container does not start
  today because another process already holds host port 80.
- Hub (`hub/`): Nuxt 4, Better Auth with email/password and 2FA, SQLite, single-user
  lock, global route middleware that redirects to `/login` or `/register`. Modules list
  in `hub/composables/useModules.ts` (stored in localStorage), iframes in
  `hub/pages/s/[id].vue`. PWA via `@vite-pwa/nuxt`.
- Hub Docker build fails on the server: `npm install` gives `ERESOLVE` (vite peer
  conflict), because `nuxt`, `@vite-pwa/nuxt` and `@vueuse/nuxt` are pinned to
  `latest`. The running hub is an old image.
- `bin/configure-apps.py` already sets Radarr, Sonarr and Prowlarr to `UrlBase=/<name>`
  and `AuthenticationMethod=External`, and Bazarr's base URL.
- Jellyfin runs with `network_mode: host` on port 8096. Seerr publishes 5055.
- The server already runs two `cloudflared` containers for another project (`argos`).
  They are separate and must not be touched.
- The server's `docker-compose.yaml` carries uncommitted local edits (Watchtower labels,
  an extra Sonarr volume). Deploys must keep them.

## Design

### Traffic

```
Internet -> Cloudflare edge -> tunnel -> cloudflared (synarr stack)
   jellyfin.tristanschwenk.fr  -> Jellyfin (host network, port 8096)   [no Access]
   seerr.tristanschwenk.fr  -> seerr:5055                           [no Access]
   home.tristanschwenk.fr      -> caddy:80 -> hub / tools by path      [Access: owner only]
```

- New `cloudflared` service in this compose project, its own tunnel and token
  (`CLOUDFLARE_TUNNEL_TOKEN` in `.env`, documented in `.env.example`), run as non-root,
  not privileged, no volume mounts, `--no-autoupdate`, on the compose network next to
  Caddy and Seerr.
- Tunnel public hostnames are configured remotely (token-based tunnel, Zero Trust
  dashboard). The README documents each hostname and its target.
- Jellyfin is on the host network, so `cloudflared` reaches it through the host
  gateway (`host.docker.internal:8096` with `extra_hosts: host-gateway`).

### Caddy

- Caddy stays as the path router for `home.tristanschwenk.fr`, but stops publishing
  host port 80. Only `cloudflared` reaches it on the internal network. This also
  removes the current port-80 conflict.
- Remove every `forward_auth` block and the `@public` / `@protected_hub` split.
  Plain `handle /<tool>*` routes to each tool, and a final route to the hub.
- Keep the Transmission `Authorization` header injection only if Transmission keeps
  RPC auth; otherwise drop it with Transmission's own auth (builder's call, see below).
- Defense in depth: Caddy rejects requests that do not carry the
  `Cf-Access-Jwt-Assertion` header for `home.*` traffic. Full JWT signature
  validation against the team's public keys is preferred if it is simple to add
  (Caddy plugin or a small check in the hub); the header-presence check is the minimum.

### Cloudflare Access (configured in the Zero Trust dashboard, documented in the README)

- One self-hosted Access application for `home.tristanschwenk.fr` (all paths).
  Policy: Allow, include the owner's email. Login method: one-time PIN by email
  (Google or GitHub may be added later). Session duration: 1 month.
- A Bypass policy (or a separate Access application) for the PWA files that browsers
  fetch without cookies: the web manifest and the icons. Nothing else bypasses.
- Safety net against forgotten hostnames: a wildcard Access application on
  `*.tristanschwenk.fr` that allows the owner only, with `jellyfin.` and `seerr.`
  as their own applications set to Bypass (more specific applications win). Any new
  hostname is then locked by default.
- No Access on the email-related records (they are DNS-only and not tunneled).

### Hub

- Remove Better Auth, SQLite, 2FA, `/login`, `/register`, `/api/auth/*`, the global
  auth middleware and `BETTER_AUTH_SECRET`. Remove `better-sqlite3` and the native
  build steps from the Dockerfile.
- Read the signed-in user from the `Cf-Access-Authenticated-User-Email` header when the
  UI needs a name; never use it for authorization (Access already did that).
- Module defaults: Radarr, Sonarr, Prowlarr, Bazarr, Transmission, Jellystat stay as
  relative paths in the iframe. Jellyfin (`https://jellyfin.tristanschwenk.fr`) and
  Seerr (`https://seerr.tristanschwenk.fr`) open in a new tab instead of the iframe
  (a new per-module flag, for example `openInNewTab`).
  Existing localStorage entries with `/jellyfin` or `/seerr` must migrate to the new
  URLs. Home Assistant stays as a custom LAN URL (works only at home).
- Pin `nuxt`, `@vite-pwa/nuxt` and `@vueuse/nuxt` to exact versions that install and
  build together, so the Docker build is reproducible again. Node version in the
  Dockerfile matches a new `.nvmrc` and `engines`.

### Admin tools

- Radarr, Sonarr, Prowlarr: keep `AuthenticationMethod=External` (they trust the
  reverse proxy). Bazarr, Transmission and Jellystat: turn off their own logins where the
  tool allows it, or keep a stored credential injected by Caddy where it does not.
- Their host ports published through the `vpn` container (9091, 8989, 7878, 9696,
  6767), Jellystat (3001) and Seerr (5055) stay published as today. They are reachable
  without a login from the LAN and the owner's tailnet (owner's decision). The router
  does not forward them.

### Jellyfin and Seerr

- Jellyfin: set the public URL in Dashboard > Networking ("Published server URIs"
  or equivalent) to `https://jellyfin.tristanschwenk.fr`, add Cloudflare's tunnel as
  a known proxy if Jellyfin needs it to log real client IPs. Owner keeps the only
  admin account; family accounts are non-admin with strong passwords.
- Seerr: application URL set to `https://seerr.tristanschwenk.fr`, sign-in with
  Jellyfin only (local accounts off).

### Rollout

1. Create the tunnel and token, add `cloudflared` to compose, publish
   `jellyfin.` and `seerr.` first. Check playback from a phone on mobile data and
   from an Apple TV app.
2. Create the Access applications (wildcard lock, `home.` owner-only, bypasses).
3. Ship the hub without Better Auth and the new Caddyfile; publish `home.`.
4. Install the hub PWA on the iPhone, check login, iframes, and a session that
   survives closing the app.
5. Turn off Tailscale Funnel (`tailscale funnel off` or equivalent) once step 1 is
   confirmed.

## Calls made by the designer (owner may correct)

- The owner performs every Cloudflare dashboard step (tunnel, hostnames, Access apps).
  The plan gives step-by-step instructions with a check after each.
- Only `home.`, `jellyfin.` and `seerr.` are tunneled. The apex and `www` (Infomaniak
  hosting) and all email records stay DNS-only and outside Access. The wildcard Access
  app does not apply to DNS-only records.
- Devices at home keep using Jellyfin's LAN address; no split DNS. Only devices outside
  the home stream through Cloudflare.
- The server's uncommitted compose edits (Watchtower labels, extra Sonarr volume) are
  folded into the repo first, so deploys are a plain `git pull`. `cloudflared`, `caddy`
  and the hub get no Watchtower label (updates by hand).

## Risks

- Cloudflare terms on video: an account may be warned or limited for heavy video over
  the tunnel. Accepted. Fallback: small VPS relay with WireGuard/Tailscale to home.
- Anyone on the home Wi-Fi or the tailnet has admin on the tools without a password.
  Accepted by the owner.
- Access is the only lock on admin tools from the internet. A policy mistake opens them. Mitigated by the
  wildcard lock-by-default application and the Caddy header check.
- iPhone PWA and Access: when the session expires, the login may open in a Safari
  overlay whose cookie does not reach the standalone PWA. Accepted without testing;
  the 1-month session makes it rare. Workaround if it bites: log in once in Safari,
  then reopen the PWA, or reinstall.
- Home upload bandwidth limits concurrent streams (about 8-20 Mbps per 1080p stream).

## Left to the builder

- Exact compose network layout and service names, as long as Caddy and admin tools
  are not published to the host for internet use.
- How Jellystat and Transmission handle sub-paths and auth; pick the simplest working
  setup and record it in the README.
- Whether JWT validation lives in Caddy or the hub.
- Exact package versions for the hub.
