<template>
  <!-- Welcome: service card grid when modules are active -->
  <div v-if="activeModules.length > 0" class="welcome-page">
    <header class="welcome-header">
      <h1 class="welcome-greeting">Good evening, <span>Synarr</span></h1>
      <p class="welcome-sub">{{ activeModules.length }} service{{ activeModules.length !== 1 ? 's' : '' }} available — select one to launch.</p>
    </header>

    <div class="service-grid" role="list">
      <NuxtLink
        v-for="(module, idx) in activeModules"
        :key="module.id"
        :to="`/s/${module.id}`"
        class="service-card"
        role="listitem"
        :style="`animation-delay: ${idx * 50}ms`"
        :aria-label="`Launch ${module.name}`"
      >
        <div class="service-card-icon" aria-hidden="true">
          <AppIcon :name="module.id" :size="22" />
        </div>

        <div class="service-card-info">
          <div class="service-card-name">{{ module.name }}</div>
          <div class="service-card-desc">{{ module.description }}</div>
        </div>

        <div class="service-card-footer">
          <span class="service-status">
            <span class="service-status-dot" aria-hidden="true"></span>
            Active
          </span>
          <svg class="service-launch-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M7 17L17 7"/>
            <path d="M7 7h10v10"/>
          </svg>
        </div>
      </NuxtLink>
    </div>
  </div>

  <!-- Empty state: nothing configured yet -->
  <div v-else class="empty-state" role="main">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted)" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
    <div>
      <h2>No services configured</h2>
      <p>Head to settings to enable your first service and get started.</p>
    </div>
    <NuxtLink to="/settings" class="btn">Configure Services</NuxtLink>
  </div>
</template>

<script setup>
const { activeModules } = useModules()
const router = useRouter()
</script>
