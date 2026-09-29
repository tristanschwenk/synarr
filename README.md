# ⚡ Synarr

<p align="center">
  <strong>The Turnkey, VPN-Secured <code>*arr</code> & Media Streaming Suite with Unified Authentication Hub</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Nuxt_3-Hub-00DC82?style=flat&logo=nuxtdotjs&logoColor=white" alt="Nuxt 3" />
  <img src="https://img.shields.io/badge/Gluetun-VPN_Sidecar-009688?style=flat&logo=wireguard&logoColor=white" alt="VPN" />
  <img src="https://img.shields.io/badge/Caddy-Forward_Auth-1F88C0?style=flat&logo=caddy&logoColor=white" alt="Caddy" />
  <img src="https://img.shields.io/badge/Jellyfin-Streaming-00A4DC?style=flat&logo=jellyfin&logoColor=white" alt="Jellyfin" />
</p>

---

**Synarr** is a production-ready, fully automated, self-hosted media center. It brings together the complete **Servarr** ecosystem (`Radarr`, `Sonarr`, `Prowlarr`, `Bazarr`, `Overseerr/Seerr`), a torrent client (`Transmission`), an analytics engine (`Jellystat`), and a streaming server (`Jellyfin`), all unified behind a **custom Nuxt-powered SSO Hub with 2FA** and secured via a **Gluetun VPN Sidecar**.

---

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph WAN [Internet / External]
        Client[User Browser / App]
        Trackers[Trackers & Indexers]
        Peers[Torrent Swarm]
    end

    subgraph SynarrHost [Synarr Server]
        Proxy[Caddy Reverse Proxy :80]
        Hub[Synarr Nuxt Hub + Better Auth :3000]

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

    Client --> Proxy
    Proxy -->|Forward Auth Verification| Hub
    Proxy -->|Authorized Traffic| Hub
    Proxy -->|Authorized Traffic| VPNSidecar
    Proxy -->|Authorized Traffic| LocalNetwork

    Transmission -.-> Storage
    Radarr -.-> Storage
    Sonarr -.-> Storage
    Jellyfin -.-> Storage

    VPNSidecar -->|Encrypted Tunnel| Trackers
    VPNSidecar -->|Encrypted Tunnel| Peers
```

### Key Highlights

* 🛡️ **Sidecar VPN Gateway**: All acquisition and indexer containers share the network stack of Gluetun (`network_mode: "container:vpn"`). If the VPN drops, all torrent/search traffic immediately halts (built-in killswitch).
* 🔐 **Unified Authentication (SSO)**: Every `*arr` web UI is guarded behind Caddy `forward_auth` powered by the **Synarr Hub** (built with Nuxt 3, Better-Auth, and 2FA / TOTP support).
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
| **Synarr Hub** | Unified dashboard, module launcher & 2FA Auth | Host / Direct |
| **Caddy** | Reverse proxy with SSO forward-authentication | Host / Direct |

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

### 4. Deploy

```bash
docker compose up -d
```

---

## 📡 Accessing Services

Once deployed, access the **Synarr Hub** at `http://<your-server-ip>`:

* **Initial Setup**: Navigate to `http://<your-server-ip>/register` to create your single admin account and enable 2FA / OTP.
* **Unified Hub**: After signing in, you can access all services directly through the sidebar launcher or at their individual sub-paths:
  * `/radarr` — Movies
  * `/sonarr` — Series
  * `/prowlarr` — Indexers
  * `/transmission` — BitTorrent Client
  * `/bazarr` — Subtitles
  * `/seerr` — Requests
  * `/jellystat` — Stats
  * `http://<your-server-ip>:8096` — Jellyfin Direct Streaming

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
