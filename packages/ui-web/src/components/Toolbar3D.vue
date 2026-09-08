<script setup lang="ts">
/**
 * Toolbar3D — Construct UI
 * 3D rotating toolbar that flips on page transitions.
 * Rounded-right-only, inset margins, surface background.
 */
import { Icon } from '@iconify/vue'

export interface ToolbarAction {
  id: string
  icon: string
  label: string
  active?: boolean
  disabled?: boolean
}

export interface BreadcrumbItem {
  label: string
  to?: string
  icon?: string
}

const props = withDefaults(defineProps<{
  breadcrumbs?: BreadcrumbItem[]
  actions?: ToolbarAction[]
  nextBreadcrumbs?: BreadcrumbItem[]
  nextActions?: ToolbarAction[]
  rotating?: boolean
  spaceIcon?: string
  spaceColor?: string
}>(), {
  breadcrumbs: () => [],
  actions: () => [],
  nextBreadcrumbs: () => [],
  nextActions: () => [],
  rotating: false,
})

const emit = defineEmits<{
  'action-click': [action: ToolbarAction]
  'breadcrumb-click': [crumb: BreadcrumbItem]
}>()

function actionBtnClass(action: ToolbarAction): string {
  const base = 'inline-flex items-center justify-center size-8 rounded-md cursor-pointer transition-all duration-150 border-none'
  if (action.disabled) return `${base} opacity-40 cursor-not-allowed text-[var(--app-muted)] bg-transparent`
  if (action.active) return `${base} bg-[color-mix(in_srgb,var(--app-accent)_15%,transparent)] text-[var(--app-accent)]`
  return `${base} bg-transparent text-[var(--app-muted)] hover:bg-[color-mix(in_srgb,var(--app-muted)_10%,transparent)] hover:text-[var(--app-foreground)]`
}
</script>

<template>
  <div class="toolbar-cube relative h-11 select-none ml-4 mr-3 mt-3" @contextmenu.prevent>
    <div
      class="toolbar-cube__wrapper w-full h-full relative"
      :class="rotating ? 'toolbar-cube__wrapper--animated' : ''"
      :style="{ transform: rotating ? 'rotateX(90deg)' : 'rotateX(0deg)' }"
    >
      <!-- Front Panel -->
      <div class="toolbar-face relative w-full h-11 px-3 flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface,var(--app-card-bg))]">
        <!-- Space icon -->
        <div v-if="spaceIcon" class="size-5 rounded flex items-center justify-center shrink-0" :style="`background: color-mix(in srgb, ${spaceColor || 'var(--app-accent)'} 15%, transparent)`">
          <slot name="space-icon">
            <Icon :icon="spaceIcon" class="size-3.5" :style="`color: ${spaceColor || 'var(--app-accent)'}`" />
          </slot>
        </div>

        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-1.5 text-sm ml-1">
          <template v-for="(crumb, i) in breadcrumbs" :key="i">
            <svg v-if="i > 0" class="size-3 shrink-0 text-[var(--app-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            <button
              v-if="crumb.to"
              class="text-[var(--app-muted)] hover:underline transition-colors"
              @click="emit('breadcrumb-click', crumb)"
            >{{ crumb.label }}</button>
            <span v-else class="font-medium text-[var(--app-foreground)]">{{ crumb.label }}</span>
          </template>
        </nav>

        <slot name="left" />
        <div class="flex-1" />
        <slot name="center" />
        <div class="flex-1" />

        <!-- Action buttons -->
        <template v-if="actions.length">
          <div class="w-px h-5 bg-[var(--app-border)]" />
          <div class="flex items-center gap-0.5">
            <button
              v-for="action in actions"
              :key="action.id"
              :class="actionBtnClass(action)"
              :disabled="action.disabled"
              :title="action.label"
              @click="emit('action-click', action)"
            >
              <Icon :icon="action.icon" class="size-4" />
            </button>
          </div>
        </template>

        <slot name="right" />
      </div>

      <!-- Bottom Panel (rotation target) -->
      <div class="toolbar-face toolbar-face--bottom absolute left-0 w-full h-11 px-3 flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface,var(--app-card-bg))]">
        <!-- Space icon mirrored from the front face — must be here or it
             pops in mid-rotation as a visual flicker when the toolbar
             flips to the new route. -->
        <div v-if="spaceIcon" class="size-5 rounded flex items-center justify-center shrink-0" :style="`background: color-mix(in srgb, ${spaceColor || 'var(--app-accent)'} 15%, transparent)`">
          <slot name="space-icon">
            <Icon :icon="spaceIcon" class="size-3.5" :style="`color: ${spaceColor || 'var(--app-accent)'}`" />
          </slot>
        </div>

        <nav class="flex items-center gap-1.5 text-sm ml-1">
          <template v-for="(crumb, i) in nextBreadcrumbs" :key="i">
            <svg v-if="i > 0" class="size-3 shrink-0 text-[var(--app-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            <span :class="i === nextBreadcrumbs.length - 1 ? 'font-medium text-[var(--app-foreground)]' : 'text-[var(--app-muted)]'">{{ crumb.label }}</span>
          </template>
        </nav>
        <div class="flex-1" />
        <template v-if="nextActions.length">
          <div class="w-px h-5 bg-[var(--app-border)]" />
          <div class="flex items-center gap-0.5">
            <button v-for="action in nextActions" :key="action.id" :class="actionBtnClass(action)" :title="action.label">
              <Icon :icon="action.icon" class="size-4" />
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 3D cube formed by transform-origin offset — no translateZ, no perspective magnification */
.toolbar-cube {
  perspective: 1000px;
}

.toolbar-cube__wrapper {
  /* Origin pushed back by half the face height (44px / 2 = 22px) so the
     wrapper rotates around the cube's center — pure rotation, no translate. */
  transform-origin: 50% 50% -22px;
  transform-style: preserve-3d;
  will-change: transform;
}

.toolbar-cube__wrapper--animated {
  /* ease-in alone makes the cube slam into its final angle at full
     speed, and the JS snap from 90deg→0deg that follows reads as a
     bounce. cubic-bezier(.2, .0, .0, 1) accelerates quickly then
     decelerates firmly — classic material motion, feels like the
     face is being placed rather than thrown. Duration nudged down to
     420ms so the SPA swap feels responsive, not ceremonial. */
  transition: transform 420ms cubic-bezier(0.2, 0, 0, 1);
}

.toolbar-face {
  backface-visibility: hidden;
}

.toolbar-face--bottom {
  top: 100%;
  transform-origin: center top;
  transform: rotateX(-90deg);
  backface-visibility: hidden;
}
</style>
