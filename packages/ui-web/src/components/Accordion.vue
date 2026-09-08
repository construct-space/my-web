<script setup lang="ts">
/**
 * Accordion - Plain implementation (no reka-ui)
 */
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'

export interface AccordionOption {
  label: string
  icon?: string
  content?: string
  defaultOpen?: boolean
  disabled?: boolean
  slot?: string
  value?: string
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  items?: AccordionOption[]
  type?: 'single' | 'multiple'
  defaultValue?: string | string[]
  ui?: Record<string, string>
}>(), {
  items: () => [],
  type: 'single',
})

function initOpenItems(): Set<string> {
  const set = new Set<string>()
  if (props.defaultValue) {
    const vals = Array.isArray(props.defaultValue) ? props.defaultValue : [props.defaultValue]
    vals.forEach(v => set.add(v))
  }
  props.items.forEach((item, i) => {
    if (item.defaultOpen) set.add(item.value || String(i))
  })
  return set
}

const openItems = ref<Set<string>>(initOpenItems())

function isOpen(key: string) {
  return openItems.value.has(key)
}

function toggle(key: string, disabled?: boolean) {
  if (disabled) return
  const next = new Set(openItems.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    if (props.type === 'single') {
      next.clear()
    }
    next.add(key)
  }
  openItems.value = next
}

function toIconify(name: string) {
  if (name.startsWith('i-')) {
    const stripped = name.slice(2)
    const idx = stripped.indexOf('-')
    if (idx > 0) return stripped.slice(0, idx) + ':' + stripped.slice(idx + 1)
    return stripped
  }
  return name
}
</script>

<template>
  <div class="w-full">
    <div
      v-for="(item, i) in items"
      :key="item.value || String(i)"
      class="border-b border-[var(--app-border)]"
    >
      <button
        :class="ui?.trigger || 'flex w-full items-center justify-between py-3 text-sm font-medium text-[var(--app-foreground)] hover:underline'"
        :disabled="item.disabled"
        @click="toggle(item.value || String(i), item.disabled)"
      >
        <div class="flex items-center gap-2">
          <slot name="leading" :item="item">
            <Icon v-if="item.icon" :icon="toIconify(item.icon)" class="size-4" />
          </slot>
          {{ item.label }}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16" height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0 transition-transform duration-200"
          :class="isOpen(item.value || String(i)) ? 'rotate-180' : ''"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <Transition
        enter-active-class="transition-all duration-200 ease-in-out"
        leave-active-class="transition-all duration-150 ease-in-out"
        enter-from-class="opacity-0 max-h-0"
        leave-to-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-[500px]"
        leave-from-class="opacity-100 max-h-[500px]"
      >
        <div v-if="isOpen(item.value || String(i))" class="overflow-hidden text-sm">
          <div class="text-[var(--app-muted)]">
            <slot name="body" :item="item">
              <div class="pb-3">
                <slot :name="item.slot || item.value || String(i)" :item="item">
                  {{ item.content }}
                </slot>
              </div>
            </slot>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
