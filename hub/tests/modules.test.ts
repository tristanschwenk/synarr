import { describe, expect, it } from 'vitest'
import { DEFAULT_MODULES, migrateModules, type Module } from '../utils/modules'

const find = (list: Module[], id: string) => list.find(m => m.id === id)!

describe('migrateModules', () => {
  it('null stored -> returns defaults', () => {
    expect(migrateModules(null, DEFAULT_MODULES)).toEqual(DEFAULT_MODULES)
  })

  it('corrupt stored value (not an array) -> returns defaults', () => {
    expect(migrateModules({} as any, DEFAULT_MODULES)).toEqual(DEFAULT_MODULES)
    expect(migrateModules('oops' as any, DEFAULT_MODULES)).toEqual(DEFAULT_MODULES)
  })

  it('stored jellyfin with url "/jellyfin" -> public URL, new tab, active kept', () => {
    const stored = [{ id: 'jellyfin', name: 'Jellyfin', url: '/jellyfin', active: false, useCustomUrl: false, customUrl: '' }]
    const jf = find(migrateModules(stored, DEFAULT_MODULES), 'jellyfin')
    expect(jf.url).toBe('https://jellyfin.tristanschwenk.fr')
    expect(jf.openInNewTab).toBe(true)
    expect(jf.active).toBe(false)
  })

  it('stored seerr named Overseerr and inactive -> Seerr, public URL, new tab, still inactive', () => {
    const stored = [{ id: 'seerr', name: 'Overseerr', url: '/seerr', active: false, useCustomUrl: false, customUrl: '' }]
    const seerr = find(migrateModules(stored, DEFAULT_MODULES), 'seerr')
    expect(seerr.url).toBe('https://seerr.tristanschwenk.fr')
    expect(seerr.openInNewTab).toBe(true)
    expect(seerr.active).toBe(false)
    expect(seerr.name).toBe('Seerr')
  })

  it('stored radarr without openInNewTab -> iframe module at /radarr/', () => {
    const stored = [{ id: 'radarr', name: 'Radarr', url: '/radarr', active: true, useCustomUrl: false, customUrl: '' }]
    const radarr = find(migrateModules(stored, DEFAULT_MODULES), 'radarr')
    expect(radarr.openInNewTab).toBe(false)
    expect(radarr.url).toBe('/radarr/')
  })

  // Bazarr once answered /bazarr with a permanent redirect to http://, which browsers
  // cache. Linking to the trailing slash never hits that redirect.
  it('relative tool URLs end with a slash', () => {
    const relative = DEFAULT_MODULES.filter(m => m.url.startsWith('/'))
    expect(relative.length).toBeGreaterThan(0)
    for (const m of relative) expect(m.url).toBe(`/${m.id}/`)
  })

  it('stored homeassistant custom URL -> unchanged', () => {
    const stored = [{ id: 'homeassistant', name: 'Home Assistant', url: 'http://10.0.0.5:8123', active: true, useCustomUrl: true, customUrl: 'http://10.0.0.5:8123' }]
    const ha = find(migrateModules(stored, DEFAULT_MODULES), 'homeassistant')
    expect(ha.url).toBe('http://10.0.0.5:8123')
    expect(ha.customUrl).toBe('http://10.0.0.5:8123')
  })

  it('module missing from stored -> appended from defaults', () => {
    const stored = [{ id: 'radarr', name: 'Radarr', url: '/radarr', active: true, useCustomUrl: false, customUrl: '' }]
    const out = migrateModules(stored, DEFAULT_MODULES)
    expect(out.map(m => m.id).sort()).toEqual(DEFAULT_MODULES.map(m => m.id).sort())
  })
})
