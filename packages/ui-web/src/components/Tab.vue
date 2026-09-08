<script setup lang="ts">
import type { Component } from 'vue'

defineOptions({
  name: 'ConstructTab',
})

defineProps<{
  label: string
  value: string
  icon?: string | Component
  disabled?: boolean
}>()
</script>

<template>
  <slot />
</template>
