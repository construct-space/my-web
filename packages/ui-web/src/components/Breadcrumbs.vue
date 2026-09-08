<script setup lang="ts">
/**
 * Breadcrumbs — Construct UI
 * Navigation breadcrumb trail with chevron separators.
 */

export interface BreadcrumbItem {
  label: string
  to?: string
  icon?: string
}

defineProps<{
  items: BreadcrumbItem[]
}>()

const emit = defineEmits<{
  'navigate': [item: BreadcrumbItem]
}>()
</script>

<template>
  <nav class="flex items-center gap-1.5 text-sm">
    <template v-for="(crumb, i) in items" :key="i">
      <svg v-if="i > 0" class="size-3 shrink-0" style="color: var(--app-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
      <button
        v-if="crumb.to"
        class="hover:underline transition-colors"
        style="color: var(--app-muted)"
        @click="emit('navigate', crumb)"
      >{{ crumb.label }}</button>
      <span v-else class="font-medium" style="color: var(--app-foreground)">{{ crumb.label }}</span>
    </template>
  </nav>
</template>
