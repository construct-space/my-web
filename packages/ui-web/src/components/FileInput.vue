<script setup lang="ts">
/**
 * FileInput — Construct UI
 * Drop zone + click-to-browse file picker.
 */
import { Icon } from '@iconify/vue'

const props = withDefaults(defineProps<{
  modelValue?: File | File[] | null
  accept?: string
  multiple?: boolean
  disabled?: boolean
  maxSize?: number // bytes
  placeholder?: string
}>(), {
  modelValue: null,
  multiple: false,
  disabled: false,
  placeholder: 'Drop files here or click to browse',
})

const emit = defineEmits<{
  'update:modelValue': [value: File | File[] | null]
  'error': [message: string]
}>()

const dragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

function handleFiles(fileList: FileList | null) {
  if (!fileList?.length) return
  const files = Array.from(fileList)

  if (props.maxSize) {
    const oversized = files.find(f => f.size > props.maxSize!)
    if (oversized) {
      emit('error', `${oversized.name} exceeds max size (${formatSize(props.maxSize)})`)
      return
    }
  }

  emit('update:modelValue', props.multiple ? files : files[0])
}

function onClick() {
  if (!props.disabled) inputRef.value?.click()
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (props.disabled) return
  handleFiles(e.dataTransfer?.files ?? null)
}

function onDragOver() {
  if (!props.disabled) {
    dragging.value = true
  }
}

function onDragLeave() {
  dragging.value = false
}

function onChange(e: Event) {
  handleFiles((e.target as HTMLInputElement).files)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const displayName = computed(() => {
  if (!props.modelValue) return null
  if (Array.isArray(props.modelValue)) {
    return props.modelValue.length === 1 ? props.modelValue[0].name : `${props.modelValue.length} files`
  }
  return props.modelValue.name
})
</script>

<template>
  <div
    class="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors"
    :class="[
      dragging ? 'border-[var(--app-accent)] bg-[color-mix(in_srgb,var(--app-accent)_5%,transparent)]' : 'border-[var(--app-border)] hover:border-[var(--app-muted)]',
      disabled ? 'opacity-50 cursor-not-allowed' : '',
    ]"
    @click="onClick"
    @drop.prevent="onDrop"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
  >
    <Icon icon="lucide:upload" class="size-5 text-[var(--app-muted)]" />
    <p v-if="displayName" class="text-sm font-medium text-[var(--app-foreground)]">{{ displayName }}</p>
    <p v-else class="text-xs text-[var(--app-muted)]">{{ placeholder }}</p>
    <p v-if="accept" class="text-[10px] text-[var(--app-muted)]">{{ accept }}</p>
    <input ref="inputRef" type="file" class="hidden" :accept="accept" :multiple="multiple" :disabled="disabled" @change="onChange" />
  </div>
</template>
