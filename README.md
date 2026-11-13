# ⚡ Synarr

<p align="center">
  <strong>The Turnkey, VPN-Secured <code>*arr</code> & Media Streaming Suite with Unified Authentication Hub</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Nuxt_3-Hub-00DC82?style=flat&logo=nuxtdotjs&logoColor=white" alt="Nuxt 3" />
  <img src="https://img.shields.io/badge/Gluetun-VPN_Sidecar-009688?style=flat&logo=wireguard&logoColor=white" alt="VPN" />
  <img src="https://img.shields.io/badge/Cloudflare-Tunnel-F38020?style=flat&logo=cloudflare&logoColor=white" alt="Cloudflare" />
  <img src="https://img.shields.io/badge/Jellyfin-Streaming-00A4DC?style=flat&logo=jellyfin&logoColor=white" alt="Jellyfin" />
</p>

---

**Synarr** is a production-ready, fully automated, self-hosted media center. It brings together the complete **Servarr** ecosystem (`Radarr`, `Sonarr`, `Prowlarr`, `Bazarr`, `Overseerr/Seerr`), a torrent client (`Transmission`), an analytics engine (`Jellystat`), and a streaming server (`Jellyfin`), with Jellyfin and Seerr public through a **Cloudflare Tunnel** (no router port), the hub and admin tools reachable only over **Tailscale**, a Nuxt PWA hub, and secured via a **Gluetun VPN Sidecar**.

---

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph WAN [Internet / External]
        Client[User Browser / App]
        Owner[Owner device on the tailnet]
        CF[Cloudflare Edge]
        Trackers[Trackers & Indexers]
        Peers[Torrent Swarm]
    end

    subgraph SynarrHost [Synarr Server]
        Tunnel[cloudflared]
        Proxy[Caddy path router :443]
        Hub[Synarr Nuxt Hub PWA :3000]

        subgraph VPNSidecar [Gluetun VPN Gateway Container]
            VPN[Gluetun WireGuard/OpenVPN]
            Transmission[Transmission]
            Prowlarr[Prowlarr]
            Radarr[Radarr]
            Sonarr[Sonarr]
            Bazarr[Bazarr]
        end

        subgraph LocalNetwork [Direct Host Network]
            Jellyfin[Jellyfin Media Server]
            Seerr[Jellyseerr / Seerr]
            Jellystat[Jellystat Analytics]
        end

        Storage[(Root Dataset: /data)]
    end

    Client --> CF
    CF -->|outbound tunnel| Tunnel
    Tunnel -->|jellyfin. public| Jellyfin
    Tunnel -->|seerr. public| Seerr
    Owner -->|hub. over Tailscale| Proxy
    Proxy --> Hub
    Proxy --> VPNSidecar
    Proxy --> Jellystat

    Transmission -.-> Storage
    Radarr -.-> Storage
    Sonarr -.-> Storage
    Jellyfin -.-> Storage

    VPNSidecar -->|Encrypted Tunnel| Trackers
    VPNSidecar -->|Encrypted Tunnel| Peers
```

### Key Highlights

* 🛡️ **Sidecar VPN Gateway**: All acquisition and indexer containers share the network stack of Gluetun (`network_mode: "container:vpn"`). If the VPN drops, all torrent/search traffic immediately halts (built-in killswitch).
* 🔐 **No open port**: A Cloudflare Tunnel is the only way in from the internet, and it carries only Jellyfin and Seerr (public, with their own Jellyfin accounts, so the TV and phone apps work). `hub.<domain>` (hub and every admin tool) resolves to the server's Tailscale IP, so only the owner's tailnet devices reach it.
* ⚡ **Atomic Hardlinks**: A unified single-root dataset (`/data`) allows instant, zero-duplicate moves between downloading (`torrents/`) and your organized streaming library (`media/`).
* 📱 **Progressive Web App (PWA)**: Access and switch between all services on desktop or mobile through the unified Synarr interface.

---

## 🧩 Included Services

| Service | Role | Network Mode |
| :--- | :--- | :--- |
| **Gluetun** | VPN gateway & encrypted killswitch tunnel | Direct (Exposes web ports) |
| **Transmission** | BitTorrent downloader | Routed via VPN sidecar |
| **Prowlarr** | Torrent indexer & tracker manager | Routed via VPN sidecar |
| **Radarr** | Movie library automation & manager | Routed via VPN sidecar |
| **Sonarr** | TV show series automation & manager | Routed via VPN sidecar |
| **Bazarr** | Subtitle downloader & manager | Routed via VPN sidecar |
| **Seerr** | Media discovery & request manager | Host / Direct |
| **Jellyfin** | Personal media player & streaming server | Host / Direct |
| **Jellystat** | Jellyfin analytics & watch statistics | Host / Direct |
| **Synarr Hub** | Dashboard and module launcher (PWA) | Behind Caddy |
| **Caddy** | Path router and HTTPS for `hub.<domain>` (Cloudflare DNS plugin) | Host port 443, tailnet only |
| **cloudflared** | Cloudflare Tunnel connector (outbound only) | Compose network |

---

## 📂 Storage Structure & Hardlinks

To avoid wasting disk space and eliminate slow file copies across filesystems, Synarr uses a **Single Root Dataset** (`/data`):

```text
data/
├── torrents/                  # In-progress & seeding files
│   ├── movies/
│   └── tv/
└── media/                     # Formatted library (Jellyfin source)
    ├── movies/
    └── tv/
docker-config/                 # Persistent service configurations
    ├── vpn/
    ├── transmission/
    ├── radarr/
    ├── sonarr/
    ├── prowlarr/
    ├── bazarr/
    ├── seerr/
    └── hub/
```

> [!TIP]
> Because `./data` is mounted to `/data` across all containers, Radarr and Sonarr create **hardlinks** from `torrents/` to `media/`. Files remain seeding without taking twice the disk space.

---

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/synarr.git
cd synarr
```

### 2. Prepare directories

Create required persistent data and configuration directories:

```bash
chmod +x ./bin/create-folder-structure.sh
./bin/create-folder-structure.sh
```

### 3. Configure your VPN

Place your OpenVPN (`client.conf` or `.ovpn`) or WireGuard configuration inside:

```text
docker-config/vpn/
```

*(Refer to [Gluetun documentation](https://github.com/qdm12/gluetun-wiki) for provider-specific environment variables in `docker-compose.yaml` if needed).*

### 4. Set secrets

Secrets (VPN credentials, database password, Jellystat JWT secret, Cloudflare tunnel token, Cloudflare API token) live in a gitignored `.env` file, not in `docker-compose.yaml`:

```bash
cp .env.example .env
# fill in every value; generate secrets with: openssl rand -hex 32
```

`docker compose` refuses to start if a required variable is missing.

### 5. Deploy

```bash
docker compose up -d
```

---

## 📡 Accessing Services

| Address | Who | Login |
| :--- | :--- | :--- |
| `https://hub.tristanschwenk.fr` | Owner only | None: reachable only from the owner's tailnet |
| `https://jellyfin.tristanschwenk.fr` | Family and friends | Jellyfin account |
| `https://seerr.tristanschwenk.fr` | Family and friends | Jellyfin account |

Admin tools under `hub.`: `/radarr`, `/sonarr`, `/prowlarr`, `/bazarr`, `/transmission`, `/jellystat`.

On the home network and the owner's tailnet, the tools stay reachable **without a login** at `http://<server-ip>:7878/radarr`, `:8989/sonarr`, `:9696/prowlarr`, `:6767/bazarr`, `:9091/transmission/web/`, `:3001/jellystat/` (Jellystat), `:5055` (Seerr). This is deliberate. Never forward these ports on the router.

---

## ☁️ Remote access

Jellyfin and Seerr go through a Cloudflare Tunnel. The hub and admin tools (`hub.`) are reachable only over Tailscale. The domain must be on Cloudflare.

1. **Tunnel** (Zero Trust > Networks > Tunnels > Create a tunnel > Cloudflared). Copy the token from the install command into `.env` as `CLOUDFLARE_TUNNEL_TOKEN` (never commit it), then start the connector so the dashboard sees it: `docker compose up -d --no-deps cloudflared`. Add routes of type **Published application**:
   * `jellyfin.tristanschwenk.fr` → `http://host.docker.internal:8096` (Jellyfin is on the host network; `localhost` would be the cloudflared container itself)
   * `seerr.tristanschwenk.fr` → `http://seerr:5055`
   * Never add `hub.` to the tunnel.
2. **Access applications** (Zero Trust > Access > Applications > Add > Self-hosted). One-time PIN is the login method; it has no settings.
   * `jellyfin.tristanschwenk.fr`: policy action **Bypass**, include **Everyone**.
   * `seerr.tristanschwenk.fr`: **Bypass**, **Everyone**.
   * `*.tristanschwenk.fr`: **Allow**, include **Emails** = the owner's email. Safety net: any tunnel hostname added later is locked by default.
   * Check in a private window: `jellyfin.` and `seerr.` open without a PIN.
3. **`hub.` DNS record** (DNS > Records): `A hub 100.82.243.124` (the server's `tailscale ip -4`), **DNS only** (grey cloud). Only tailnet devices can reach that address.
4. **Cloudflare API token** for Caddy's certificate (Let's Encrypt cannot reach a Tailscale IP, so Caddy uses the DNS challenge): My Profile > API Tokens > Create Token > **Edit zone DNS**, zone `tristanschwenk.fr` only. Put it in `.env` as `CLOUDFLARE_API_TOKEN`. Anyone with this token can edit the zone's DNS, email records included: keep it only in `.env`.
5. **Tailscale Funnel off**: it holds port 443 on the Tailscale IP. `tailscale funnel status`, then `tailscale funnel reset`.
6. **Jellyfin** (Dashboard > Networking): Published server URIs `all=https://jellyfin.tristanschwenk.fr`. Known proxies: `172.17.0.1` and the compose network gateway (`docker network inspect docker-streaming-manager_default -f '{{(index .IPAM.Config 0).Gateway}}'`). Only the owner's account is admin.
7. **Seerr**: Settings > General > Application URL `https://seerr.tristanschwenk.fr`, and turn on **Enable Proxy Support**. Settings > Users: turn off local sign-in, keep Jellyfin sign-in.
8. **URL bases**: stop the tools, run the settings script, start them again:
   ```bash
   docker compose stop radarr sonarr prowlarr bazarr seerr
   python3 bin/configure-apps.py
   docker compose up -d radarr sonarr prowlarr bazarr seerr
   ```
   It sets `/radarr`, `/sonarr`, `/prowlarr`, `/bazarr` and points Bazarr and Seerr at the new Radarr and Sonarr paths.
9. **Prowlarr** (Settings > Apps > Radarr and Sonarr): Prowlarr Server `http://localhost:9696/prowlarr`, Radarr Server `http://localhost:7878/radarr`, Sonarr Server `http://localhost:8989/sonarr`. Set **Sync Level = Full Sync** (otherwise the indexers already inside Radarr and Sonarr keep the old Prowlarr URL), Test, Save, then System > Tasks > Application Indexer Sync. Check with Settings > Indexers > Test All in Radarr and in Sonarr.
10. **Hub and Caddy**: `docker compose up -d --build hub caddy`. From a tailnet device, open `https://hub.tristanschwenk.fr`: the certificate must be valid. Host port 80 is not used (another service holds it), so always use `https://`.

Tests for the proxy rules: `bash bin/test-caddy.sh` (needs Docker).

---

## 🛡️ Killswitch Verification

To ensure your downloader traffic is fully routed through the VPN tunnel and not leaking your real ISP address:

```bash
docker exec transmission curl https://ifconfig.me
```

*The returned IP address must match your VPN provider's exit node, not your home IP.*

---

## 📜 License

Distributed under the [MIT License](LICENSE).
