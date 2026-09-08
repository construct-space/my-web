<script setup lang="ts">
/**
 * Tabs - Plain implementation (no reka-ui)
 */
import {
  Comment,
  Fragment,
  Text,
  computed,
  defineComponent,
  type Component,
  type PropType,
  type Slot,
  type VNode,
  useSlots,
} from 'vue'
import Tab from './Tab.vue'

export interface TabItem {
  label: string
  value: string
  icon?: string | Component
  disabled?: boolean
}

interface ResolvedTab {
  label: string
  value: string
  icon?: string | Component
  disabled?: boolean
  content?: Slot
}

const props = withDefaults(
  defineProps<{
    modelValue?: string
    items?: TabItem[]
    variant?: 'line' | 'segmented'
  }>(),
  {
    modelValue: '',
    items: () => [],
    variant: 'line',
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const slots = useSlots()

const SlotContent = defineComponent({
  name: 'ConstructTabsSlotContent',
  props: {
    render: {
      type: Function as PropType<Slot>,
      required: true,
    },
  },
  setup(innerProps) {
    return () => innerProps.render()
  },
})

function flattenNodes(nodes: VNode[]): VNode[] {
  return nodes.flatMap((node) => {
    if (node.type === Comment || node.type === Text) return []
    if (node.type === Fragment && Array.isArray(node.children)) {
      return flattenNodes(node.children as VNode[])
    }
    return [node]
  })
}

function isTabNode(node: VNode) {
  const type = node.type as Component & { __name?: string; name?: string }
  return type === Tab || type?.name === 'ConstructTab' || type?.__name === 'ConstructTab'
}

const slotTabs = computed<ResolvedTab[]>(() => {
  const nodes = flattenNodes(slots.default?.() ?? [])
  return nodes.flatMap((node) => {
    if (!isTabNode(node)) return []

    const nodeProps = (node.props ?? {}) as {
      label?: string
      value?: string
      icon?: string | Component
      disabled?: boolean
    }

    if (!nodeProps.label || !nodeProps.value) return []

    const content = typeof node.children === 'object' && node.children && 'default' in node.children
      ? (node.children as { default?: Slot }).default
      : undefined

    return [{
      label: nodeProps.label,
      value: nodeProps.value,
      icon: nodeProps.icon,
      disabled: nodeProps.disabled,
      content,
    }]
  })
})

const resolvedTabs = computed<ResolvedTab[]>(() => {
  if (slotTabs.value.length > 0) return slotTabs.value
  return props.items
})

const listClass = computed(() => {
  if (props.variant === 'segmented') {
    return 'inline-flex w-fit gap-1 rounded-lg bg-[color-mix(in_srgb,var(--app-muted)_8%,transparent)] p-1'
  }
  return 'flex gap-1 border-b border-[var(--app-border)]'
})

function triggerClasses(item: ResolvedTab) {
  const isActive = props.modelValue === item.value
  const base = 'inline-flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer'
  const disabledCls = item.disabled ? 'pointer-events-none opacity-50' : ''

  if (props.variant === 'segmented') {
    const activeCls = isActive ? 'bg-[var(--app-accent)] text-white' : 'text-[var(--app-muted)] hover:text-[var(--app-foreground)]'
    return [base, 'rounded-md px-4 py-1.5', activeCls, disabledCls]
  }

  const activeCls = isActive
    ? 'text-[var(--app-accent)] border-[var(--app-accent)]'
    : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-foreground)]'
  return [base, 'border-b-2 px-3 py-2 -mb-px', activeCls, disabledCls]
}

const contentClass = computed(() => props.variant === 'segmented'
  ? 'mt-4 focus-visible:outline-none'
  : 'mt-3 focus-visible:outline-none'
)

function selectTab(item: ResolvedTab) {
  if (item.disabled) return
  emit('update:modelValue', item.value)
}
</script>

<template>
  <div>
    <div :class="listClass" role="tablist">
      <button
        v-for="item in resolvedTabs"
        :key="item.value"
        role="tab"
        :aria-selected="modelValue === item.value"
        :disabled="item.disabled"
        :class="triggerClasses(item)"
        @click="selectTab(item)"
      >
        <component
          :is="item.icon"
          v-if="item.icon"
          class="h-4 w-4"
        />
        {{ item.label }}
      </button>
    </div>

    <template v-for="item in resolvedTabs" :key="item.value">
      <div
        v-if="modelValue === item.value"
        role="tabpanel"
        :class="contentClass"
      >
        <SlotContent v-if="item.content" :render="item.content" />
        <slot v-else :name="item.value" />
      </div>
    </template>
  </div>
</template>
