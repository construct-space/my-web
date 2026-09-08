<script setup lang="ts">
/**
 * Modal - Plain implementation (no reka-ui)
 * Supports: #header, #body, #footer, #trigger slots + title/description props
 */
import { useEscapeKey } from '../composables/useEscapeKey'

const props = withDefaults(defineProps<{
  open?: boolean
  title?: string
  description?: string
  fullscreen?: boolean
  preventClose?: boolean
  closeOnClickOutside?: boolean
  ui?: Record<string, string>
}>(), {
  open: false,
  title: '',
  description: '',
  fullscreen: false,
  preventClose: false,
  closeOnClickOutside: true,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
}>()

function close() {
  if (props.preventClose) return
  emit('update:open', false)
  emit('close')
}

function onOverlayClick(e: MouseEvent) {
  if (props.closeOnClickOutside && e.target === e.currentTarget) close()
}

useEscapeKey(() => { if (props.open) close() })
</script>

<template>
  <slot v-if="$slots.trigger" name="trigger" />
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-in-out"
      leave-active-class="transition-opacity duration-150 ease-in-out"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center" @mousedown="onOverlayClick">
        <!-- Overlay -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        <!-- Content -->
        <div
          :class="[
            'relative z-10 bg-[var(--app-background)] shadow-xl overflow-hidden flex flex-col',
            fullscreen
              ? 'inset-2 absolute rounded-xl'
              : ['rounded-lg border border-[var(--app-border)]', ui?.content || 'w-full max-w-lg max-h-[85vh]'],
          ]"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 pt-6 pb-0 shrink-0">
            <div v-if="$slots.header || title || description" class="flex-1 min-w-0">
              <slot name="header">
                <div class="flex flex-col gap-1">
                  <h2 v-if="title" class="text-lg font-semibold text-[var(--app-foreground)]">{{ title }}</h2>
                  <p v-if="description" class="text-sm text-[var(--app-muted)]">{{ description }}</p>
                </div>
              </slot>
            </div>
            <button
              v-if="!preventClose"
              class="shrink-0 p-1 rounded-md transition-colors hover:bg-[color-mix(in_srgb,var(--app-muted)_15%,transparent)] focus:outline-none text-[var(--app-muted)] hover:text-[var(--app-foreground)]"
              @click="close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 text-[var(--app-foreground)] flex-1 overflow-auto">
            <slot name="body">
              <slot name="content">
                <slot />
              </slot>
            </slot>
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="px-6 pb-6 shrink-0">
            <slot name="footer" />
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>
