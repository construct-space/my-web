<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Card } from '@construct-space/ui-web'

/**
 * Coming-soon page shell. Used wherever a settings/space panel is not yet
 * ported. Pass the source path to hint where the migration comes from.
 * Page title lives in the Toolbar3D breadcrumb; this just renders the
 * placeholder content.
 */
defineProps<{
  title: string
  icon: string
  description: string
  sourcePath?: string
}>()
</script>

<template>
  <section class="max-w-3xl">
    <Card>
      <div class="flex flex-col items-center text-center gap-3 py-6">
        <Icon :icon="`lucide:${icon}`" class="size-8 text-[var(--app-muted)]" />
        <div class="text-sm font-medium">{{ title }}</div>
        <p class="text-xs text-[var(--app-muted)] max-w-sm">{{ description }}</p>
        <div v-if="sourcePath" class="text-[11px] text-[var(--app-muted)] mt-2">
          Migrating from
          <code class="mono px-1.5 py-0.5 rounded bg-[var(--app-surface)]">{{ sourcePath }}</code>
        </div>
      </div>
    </Card>
  </section>
</template>
