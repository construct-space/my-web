<script setup lang="ts">
const props = withDefaults(defineProps<{
  gap?: 'none' | 'xs' | 'sm' | 'md' | 'lg'
  direction?: 'row' | 'column'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between'
  wrap?: boolean
}>(), {
  gap: 'sm',
  direction: 'row',
  align: 'center',
  justify: 'start',
  wrap: false,
})

const gapClass = computed(() => ({
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
}[props.gap]))

const directionClass = computed(() => props.direction === 'column' ? 'flex-col' : 'flex-row')

const alignClass = computed(() => ({
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
}[props.align]))

const justifyClass = computed(() => ({
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
}[props.justify]))
</script>

<template>
  <div
    :class="[
      'flex',
      gapClass,
      directionClass,
      alignClass,
      justifyClass,
      wrap ? 'flex-wrap' : '',
    ]"
  >
    <slot />
  </div>
</template>
