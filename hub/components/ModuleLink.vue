<template>
  <a
    v-if="module.openInNewTab"
    :href="module.url"
    target="_blank"
    rel="noopener noreferrer"
  >
    <slot />
  </a>
  <NuxtLink v-else :to="`/s/${module.id}`" :active-class="activeClass">
    <slot />
  </NuxtLink>
</template>

<script setup lang="ts">
import type { Module } from '~/utils/modules'

// Public apps (Jellyfin, Seerr) open on their own hostname in a new tab;
// admin tools open in the hub's iframe page.
defineProps<{ module: Module, activeClass?: string }>()
</script>
