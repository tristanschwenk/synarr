<template>
  <div class="iframe-wrapper">
    <!-- Slim top bar -->
    <div v-if="module" class="iframe-topbar" aria-label="Current service">
      <span class="iframe-topbar-icon" aria-hidden="true">
        <AppIcon :name="module.id" :size="16" />
      </span>
      <span class="iframe-topbar-name">{{ module.name }}</span>
      <span class="iframe-topbar-url" :title="module.url">{{ module.url }}</span>
      <a
        :href="module.url"
        target="_blank"
        rel="noopener noreferrer"
        class="btn-ghost btn"
        style="padding: 0.3rem 0.6rem; font-size: 0.75rem;"
        aria-label="Open in new tab"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        New tab
      </a>
    </div>

    <!-- Loading state -->
    <div v-if="module && module.url && !module.openInNewTab && isLoading" class="iframe-loading">
      <div class="spinner" role="status" aria-label="Loading"></div>
      <span>Loading {{ module?.name }}...</span>
    </div>

    <!-- Iframe -->
    <iframe
      v-if="module && module.url && !module.openInNewTab"
      :src="module.url"
      :title="module.name"
      :style="isLoading ? 'opacity: 0; position: absolute; pointer-events: none;' : 'flex: 1;'"
      @load="isLoading = false"
    />

    <!-- Public app: opens on its own hostname, not in the iframe -->
    <div v-else-if="module && module.openInNewTab" class="empty-state">
      <div>
        <h2>{{ module.name }} opens in a new tab</h2>
        <p>{{ module.url }}</p>
      </div>
      <a :href="module.url" target="_blank" rel="noopener noreferrer" class="btn">Open {{ module.name }}</a>
    </div>

    <!-- Not found -->
    <div v-else class="empty-state">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted)" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div>
        <h2>Module not found</h2>
        <p>This service could not be found or has not been configured.</p>
      </div>
      <NuxtLink to="/settings" class="btn">Go to Settings</NuxtLink>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const { getModule } = useModules()

const module = computed(() => getModule(route.params.id))
const isLoading = ref(true)

watch(() => route.params.id, () => {
  isLoading.value = true
})
</script>

<style scoped>
.iframe-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

iframe {
  flex: 1;
  width: 100%;
  border: none;
  display: block;
}
</style>
