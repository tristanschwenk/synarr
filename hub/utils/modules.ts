export interface Module {
  id: string
  name: string
  url: string
  active: boolean
  description: string
  defaultPort: number
  port: number
  useCustomUrl: boolean
  customUrl: string
  /** Open in a new tab instead of the hub's iframe (public apps on their own hostname). */
  openInNewTab: boolean
}

const JELLYFIN_URL = 'https://jellyfin.tristanschwenk.fr'
const SEERR_URL = 'https://seerr.tristanschwenk.fr'

export const DEFAULT_MODULES: Module[] = [
  { id: 'homeassistant', name: 'Home Assistant', url: 'http://192.168.1.34:8123', active: true, description: 'Home automation platform', defaultPort: 8123, port: 8123, useCustomUrl: true, customUrl: 'http://192.168.1.34:8123', openInNewTab: false },
  { id: 'jellyfin', name: 'Jellyfin', url: JELLYFIN_URL, active: true, description: 'Media server & streaming', defaultPort: 8096, port: 8096, useCustomUrl: true, customUrl: JELLYFIN_URL, openInNewTab: true },
  { id: 'radarr', name: 'Radarr', url: '/radarr/', active: true, description: 'Movie collection manager', defaultPort: 7878, port: 7878, useCustomUrl: false, customUrl: '', openInNewTab: false },
  { id: 'sonarr', name: 'Sonarr', url: '/sonarr/', active: true, description: 'TV series manager', defaultPort: 8989, port: 8989, useCustomUrl: false, customUrl: '', openInNewTab: false },
  { id: 'prowlarr', name: 'Prowlarr', url: '/prowlarr/', active: true, description: 'Indexer manager', defaultPort: 9696, port: 9696, useCustomUrl: false, customUrl: '', openInNewTab: false },
  { id: 'transmission', name: 'Transmission', url: '/transmission/', active: true, description: 'BitTorrent client', defaultPort: 9091, port: 9091, useCustomUrl: false, customUrl: '', openInNewTab: false },
  { id: 'jellystat', name: 'Jellystat', url: '/jellystat/', active: false, description: 'Jellyfin statistics & analytics', defaultPort: 3001, port: 3001, useCustomUrl: false, customUrl: '', openInNewTab: false },
  { id: 'seerr', name: 'Seerr', url: SEERR_URL, active: true, description: 'Media request management', defaultPort: 5055, port: 5055, useCustomUrl: true, customUrl: SEERR_URL, openInNewTab: true },
  { id: 'bazarr', name: 'Bazarr', url: '/bazarr/', active: false, description: 'Subtitle manager', defaultPort: 6767, port: 6767, useCustomUrl: false, customUrl: '', openInNewTab: false },
]

/** Modules whose address is fixed by the deployment, not by the user. */
const PUBLIC_APPS = new Set(['jellyfin', 'seerr'])

/**
 * Bring modules stored in localStorage up to date with the defaults.
 * Jellyfin and Seerr always take their public URL and open in a new tab; the user's
 * `active` choice is kept. Other modules keep their stored settings, and relative ones
 * point at `/<id>/`. Modules missing from storage are appended from the defaults.
 */
export function migrateModules(stored: Partial<Module>[] | null, defaults: Module[]): Module[] {
  if (!Array.isArray(stored)) return defaults.map(m => ({ ...m }))

  const migrated = stored
    .filter((m): m is Partial<Module> & { id: string } => typeof m?.id === 'string')
    .map((m) => {
      const def = defaults.find(d => d.id === m.id)
      const merged = { ...(def ?? {}), ...m } as Module

      if (def && PUBLIC_APPS.has(m.id)) {
        return {
          ...merged,
          name: def.name,
          url: def.url,
          customUrl: def.customUrl,
          useCustomUrl: def.useCustomUrl,
          openInNewTab: def.openInNewTab,
        }
      }

      const withTab = { ...merged, openInNewTab: merged.openInNewTab ?? false }
      if (!withTab.useCustomUrl && withTab.id !== 'homeassistant') {
        withTab.url = `/${withTab.id}/`
      }
      return withTab
    })

  const missing = defaults.filter(d => !migrated.some(m => m.id === d.id)).map(d => ({ ...d }))
  return [...migrated, ...missing]
}
