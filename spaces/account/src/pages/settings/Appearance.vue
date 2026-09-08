<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useTheme, type Theme } from '@construct-space/ui-web'
import { usePageToolbar } from '@construct-space/infra-shell'

const { themes, currentThemeId, setTheme } = useTheme()

// Quick mode toggle in the top toolbar — complements the full grid below.
usePageToolbar(
  computed(() => [
    { id: 'auto', icon: 'lucide:monitor', label: 'Auto', active: currentThemeId.value === 'auto', onClick: () => setTheme('auto') },
    { id: 'light', icon: 'lucide:sun', label: 'Light', active: currentThemeId.value === 'vs', onClick: () => setTheme('vs') },
    { id: 'dark', icon: 'lucide:moon', label: 'Dark', active: currentThemeId.value === 'vs-dark', onClick: () => setTheme('vs-dark') },
  ]),
)

function lighten(hex: string, n: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const c = (v: number) => Math.max(0, Math.min(255, v + n)).toString(16).padStart(2, '0')
  return '#' + c(r) + c(g) + c(b)
}

function darken(hex: string, n: number): string {
  return lighten(hex, -n)
}

function previewBarColor(t: Theme): string {
  return t.accent
}

function previewBlockColor(t: Theme): string {
  return t.mode === 'dark' ? lighten(t.bg, 24) : darken(t.bg, 4)
}

function previewSidebarColor(t: Theme): string {
  return t.mode === 'dark' ? lighten(t.bg, 16) : '#ffffff'
}
</script>

<template>
  <section class="max-w-4xl flex flex-col gap-6">
    <p class="text-sm text-[var(--app-muted)]">Choose a theme for Construct</p>

    <!-- Auto (System) row -->
    <button
      type="button"
      class="flex items-center gap-4 p-4 rounded-xl border text-left transition-colors"
      :class="currentThemeId === 'auto'
        ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_8%,transparent)]'
        : 'border-[var(--app-border)] bg-[var(--app-card-bg)] hover:border-[var(--app-muted)]'"
      @click="setTheme('auto')"
    >
      <div class="size-10 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:monitor" class="size-5" />
      </div>
      <div class="flex-1">
        <div class="text-sm font-medium">Auto (System)</div>
        <div class="text-xs text-[var(--app-muted)]">Follow your OS light/dark setting</div>
      </div>
      <div v-if="currentThemeId === 'auto'" class="size-5 rounded-full grid place-items-center bg-[var(--app-accent)] text-[var(--app-accent-foreground)]">
        <Icon icon="lucide:check" class="size-3" />
      </div>
    </button>

    <!-- Theme grid -->
    <div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      <button
        v-for="t in themes"
        :key="t.id"
        type="button"
        class="relative flex flex-col gap-0 rounded-xl border overflow-hidden text-left transition-colors"
        :class="currentThemeId === t.id
          ? 'border-[var(--app-accent)]'
          : 'border-[var(--app-border)] hover:border-[var(--app-muted)]'"
        @click="setTheme(t.id)"
      >
        <div
          class="aspect-[16/10] p-3 flex flex-col gap-1.5"
          :style="{ background: t.bg }"
        >
          <div
            class="h-1.5 rounded-full w-3/4"
            :style="{ background: previewSidebarColor(t) }"
          />
          <div
            class="h-2.5 rounded w-1/3"
            :style="{ background: previewBarColor(t) }"
          />
          <div class="flex-1" />
          <div
            class="h-2 rounded w-1/2"
            :style="{ background: previewBlockColor(t) }"
          />
        </div>

        <div class="flex items-center justify-between px-3 py-2 bg-[var(--app-card-bg)]">
          <span class="text-xs font-medium">{{ t.name }}</span>
          <Icon
            :icon="t.mode === 'dark' ? 'lucide:moon' : 'lucide:sun'"
            class="size-3.5 text-[var(--app-muted)]"
          />
        </div>

        <div
          v-if="currentThemeId === t.id"
          class="absolute top-2 right-2 size-5 rounded-full grid place-items-center bg-[var(--app-accent)] text-[var(--app-accent-foreground)]"
        >
          <Icon icon="lucide:check" class="size-3" />
        </div>
      </button>
    </div>
  </section>
</template>
