<script setup lang="ts">
/**
 * ScrollArea - Plain implementation (no reka-ui)
 * Scrollbar styling injected at runtime to avoid bundled CSS.
 */
import { onMounted } from 'vue'

onMounted(() => {
  if (typeof document === 'undefined') return
  if (document.getElementById('cui-scrollarea-styles')) return
  const style = document.createElement('style')
  style.id = 'cui-scrollarea-styles'
  style.textContent = [
    '.cui-scroll{scrollbar-width:thin;scrollbar-color:var(--app-border) transparent}',
    '.cui-scroll:hover{scrollbar-color:var(--app-muted) transparent}',
    '.cui-scroll::-webkit-scrollbar{width:10px;height:10px}',
    '.cui-scroll::-webkit-scrollbar-track{background:transparent}',
    '.cui-scroll::-webkit-scrollbar-thumb{background-color:var(--app-border);border-radius:9999px;border:2px solid transparent;background-clip:content-box}',
    '.cui-scroll::-webkit-scrollbar-thumb:hover{background-color:var(--app-muted)}',
  ].join('')
  document.head.appendChild(style)
})
</script>

<template>
  <div class="relative overflow-auto cui-scroll">
    <slot />
  </div>
</template>
