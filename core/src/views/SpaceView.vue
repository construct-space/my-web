<script setup lang="ts">
import { computed, defineAsyncComponent, shallowRef, watch } from 'vue'
import { findSpace } from '../spaces'

const props = defineProps<{ spaceId: string; subPage?: string }>()
const component = shallowRef<ReturnType<typeof defineAsyncComponent> | null>(null)

const space = computed(() => findSpace(props.spaceId))

watch(
  () => space.value,
  (s) => {
    if (!s) { component.value = null; return }
    component.value = defineAsyncComponent(s.load)
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="!space" class="max-w-lg">
    <h2 class="text-xl font-semibold mb-2">Space not found</h2>
    <p class="text-sm text-[var(--app-muted)]">{{ spaceId }} isn't registered.</p>
  </div>
  <component v-else-if="component" :is="component" :sub-page="subPage" />
</template>
