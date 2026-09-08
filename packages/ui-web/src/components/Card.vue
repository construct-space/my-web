<script setup lang="ts">
/**
 * Card — NuxtUI-compatible surface primitive.
 *
 * Opinionated defaults: rounded border, app-tokened background, subtle
 * shadow, sensible body padding. Most pages just use `<Card>…</Card>`
 * and stop hand-rolling the same rounded-border-bg classes.
 *
 * For row-based layouts where each row handles its own padding (e.g.
 * settings field lists with divide-y), pass `padding="none"`.
 */

withDefaults(defineProps<{
  title?: string
  description?: string
  variant?: 'default' | 'outline'
  padding?: 'md' | 'none'
}>(), {
  title: '',
  description: '',
  variant: 'default',
  padding: 'md',
})
</script>

<template>
  <div
    :class="[
      'rounded-xl text-[var(--app-foreground)]',
      variant === 'outline'
        ? 'border border-[var(--app-border)]'
        : 'bg-[var(--app-card-bg)] border border-[var(--app-border)]',
    ]"
  >
    <div v-if="title || description || $slots.header" class="px-5 py-4 border-b border-[var(--app-border)]">
      <slot name="header">
        <h3 v-if="title" class="text-sm font-semibold">{{ title }}</h3>
        <p v-if="description" class="text-xs text-[var(--app-muted)] mt-0.5">{{ description }}</p>
      </slot>
    </div>
    <div :class="padding === 'none' ? '' : 'p-5'">
      <slot />
    </div>
    <div v-if="$slots.footer" class="px-5 py-4 border-t border-[var(--app-border)]">
      <slot name="footer" />
    </div>
  </div>
</template>
