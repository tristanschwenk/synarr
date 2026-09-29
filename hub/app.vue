<template>
  <div id="app-container">
    <!-- Desktop Sidebar -->
    <aside class="sidebar desktop-only" aria-label="Main navigation">
      <!-- Brand -->
      <div class="sidebar-header">
        <div class="logo-mark" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <div class="sidebar-brand">
          <span class="sidebar-brand-name">Synarr</span>
          <span class="sidebar-brand-sub">Media Hub</span>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="nav-links" aria-label="Services">
        <span class="nav-section-label">Services</span>
        <NuxtLink
          v-for="(module, idx) in activeModules"
          :key="module.id"
          :to="`/s/${module.id}`"
          class="nav-item"
          active-class="active"
          :style="`animation-delay: ${idx * 40}ms`"
        >
          <span class="nav-item-icon">
            <AppIcon :name="module.id" :size="18" />
          </span>
          <span class="nav-item-label">{{ module.name }}</span>
        </NuxtLink>

        <template v-if="activeModules.length === 0">
          <span class="nav-item" style="cursor: default; opacity: 0.5; font-size: 0.8125rem;">
            No services active
          </span>
        </template>
      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <NuxtLink to="/settings" class="nav-item" active-class="active">
          <span class="nav-item-icon">
            <AppIcon name="settings" :size="18" />
          </span>
          <span class="nav-item-label">Settings</span>
        </NuxtLink>
      </div>
    </aside>

    <!-- Mobile Top Header -->
    <header class="mobile-header mobile-only" aria-label="App header">
      <div class="mobile-header-inner">
        <div class="logo-mark logo-mark-sm" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <span class="mobile-header-title">Synarr</span>
      </div>
    </header>

    <main class="main-content" id="main-content">
      <NuxtPage />
    </main>

    <!-- Mobile Bottom Navigation -->
    <nav class="bottom-nav mobile-only" aria-label="Main navigation">
      <NuxtLink to="/" class="bottom-nav-item" :class="{ active: route.path === '/' }">
        <span class="bottom-nav-icon">
          <AppIcon name="home" :size="22" />
        </span>
        <span class="bottom-nav-label">Home</span>
      </NuxtLink>

      <NuxtLink
        v-for="module in mobileNavModules"
        :key="module.id"
        :to="`/s/${module.id}`"
        class="bottom-nav-item"
        active-class="active"
      >
        <span class="bottom-nav-icon">
          <AppIcon :name="module.id" :size="22" />
        </span>
        <span class="bottom-nav-label">{{ module.shortName || module.name }}</span>
      </NuxtLink>

      <!-- More button when there are extra modules -->
      <button
        v-if="overflowModules.length > 0"
        class="bottom-nav-item"
        :class="{ active: showMoreSheet }"
        @click="showMoreSheet = !showMoreSheet"
      >
        <span class="bottom-nav-icon">
          <AppIcon name="more" :size="22" />
        </span>
        <span class="bottom-nav-label">More</span>
      </button>

      <NuxtLink to="/settings" class="bottom-nav-item" active-class="active">
        <span class="bottom-nav-icon">
          <AppIcon name="settings" :size="22" />
        </span>
        <span class="bottom-nav-label">Settings</span>
      </NuxtLink>

    </nav>

    <!-- Overflow Sheet (outside bottom-nav to avoid backdrop-filter containing block) -->
    <Transition name="sheet">
      <div v-if="showMoreSheet" class="more-sheet mobile-only" @click.self="showMoreSheet = false">
        <div class="more-sheet-content">
          <div class="more-sheet-handle" aria-hidden="true"></div>
          <span class="more-sheet-title">All Services</span>
          <NuxtLink
            v-for="module in overflowModules"
            :key="module.id"
            :to="`/s/${module.id}`"
            class="more-sheet-item"
            active-class="active"
            @click="showMoreSheet = false"
          >
            <span class="more-sheet-item-icon">
              <AppIcon :name="module.id" :size="20" />
            </span>
            <span class="more-sheet-item-label">{{ module.name }}</span>
          </NuxtLink>
        </div>
      </div>
    </Transition>

    <VitePwaManifest />
  </div>
</template>

<script setup>
const route = useRoute()
const { activeModules } = useModules()
const showMoreSheet = ref(false)

// Bottom bar: max 5 items total (Home + services + optional More + Settings)
// Home=1, Settings=1 are always present → 3 slots for services
// If overflow exists, More takes 1 slot → 2 slots for services
const maxServiceTabs = computed(() => {
  const fixedSlots = 2 // Home + Settings
  const totalSlots = 5
  const available = totalSlots - fixedSlots // 3
  // If we'd need a More button, it takes a slot
  return activeModules.value.length > available ? available - 1 : available
})
const mobileNavModules = computed(() => activeModules.value.slice(0, maxServiceTabs.value))
const overflowModules = computed(() => activeModules.value.slice(maxServiceTabs.value))

// Close sheet on route change
watch(() => route.path, () => {
  showMoreSheet.value = false
})
</script>
