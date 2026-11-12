import { computed } from 'vue'
import { useStorage } from '@vueuse/core'
import { DEFAULT_MODULES, migrateModules, type Module } from '~/utils/modules'

export const useModules = () => {
  const serverAddress = useStorage<string>('casa-server-address', '')
  const modules = useStorage<Module[]>('casa-modules', DEFAULT_MODULES)

  // Bring stored modules up to date (public URLs for Jellyfin and Seerr, new modules)
  modules.value = migrateModules(modules.value, DEFAULT_MODULES)

  const activeModules = computed(() => modules.value.filter(m => m.active))

  const updateServerAddress = (address: string) => {
    const base = address.replace(/\/$/, '')
    serverAddress.value = base
    
    modules.value = modules.value.map(m => {
      if (m.useCustomUrl) return m
      const pathPrefix = base && base !== '/' ? base : ''
      return {
        ...m,
        url: `${pathPrefix}/${m.id}`
      }
    })
  }

  const updateModule = (id: string, updates: Partial<Module>) => {
    const index = modules.value.findIndex(m => m.id === id)
    if (index !== -1) {
      const updatedModule = { ...modules.value[index], ...updates }
      
      if (updatedModule.useCustomUrl) {
        if (updatedModule.customUrl) {
          updatedModule.url = updatedModule.customUrl
        }
      } else {
        const base = serverAddress.value && serverAddress.value !== '/' ? serverAddress.value : ''
        updatedModule.url = `${base}/${updatedModule.id}`
      }
      
      modules.value[index] = updatedModule
    }
  }

  const getModule = (id: string) => modules.value.find(m => m.id === id)

  return {
    modules,
    serverAddress,
    activeModules,
    updateServerAddress,
    updateModule,
    getModule
  }
}
