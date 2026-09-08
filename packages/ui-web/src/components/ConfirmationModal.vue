<script setup lang="ts">
import Button from './Button.vue'
import Icon from './Icon.vue'
import Modal from './Modal.vue'

interface Props {
  modelValue: boolean
  title?: string
  message: string
  details?: string
  confirmText?: string
  cancelText?: string
  confirmColor?: 'primary' | 'error' | 'success' | 'warning' | 'info'
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm Action',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmColor: 'primary',
  loading: false,
  details: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const isDestructive = computed(() => props.confirmColor === 'error')

const iconName = computed(() => {
  switch (props.confirmColor) {
    case 'error': return 'i-lucide-alert-triangle'
    case 'success': return 'i-lucide-check-circle'
    case 'warning': return 'i-lucide-alert-circle'
    case 'info': return 'i-lucide-info'
    default: return 'i-lucide-help-circle'
  }
})

const iconColorClass = computed(() => {
  switch (props.confirmColor) {
    case 'error': return 'text-red-600 dark:text-red-400'
    case 'success': return 'text-green-600 dark:text-green-400'
    case 'warning': return 'text-yellow-600 dark:text-yellow-400'
    case 'info': return 'text-blue-600 dark:text-blue-400'
    default: return 'text-[var(--app-muted)]'
  }
})

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('cancel')
  isOpen.value = false
}

watch(isOpen, (newValue) => {
  if (!newValue) emit('cancel')
})
</script>

<template>
  <Modal v-model:open="isOpen">
    <template #header>
      <div class="flex items-center gap-3">
        <Icon :name="iconName" :class="iconColorClass" class="h-6 w-6" />
        <h3 class="text-lg font-semibold text-[var(--app-foreground)]">
          {{ title }}
        </h3>
      </div>
    </template>

    <template #body>
      <div class="space-y-4">
        <p class="text-[var(--app-muted)]">
          {{ message }}
        </p>

        <div v-if="details" class="rounded-lg bg-[var(--app-background)] p-3">
          <p class="text-sm text-[var(--app-muted)]">
            {{ details }}
          </p>
        </div>

        <div
          v-if="isDestructive"
          class="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"
        >
          <div class="flex items-start gap-2">
            <Icon name="i-lucide-alert-triangle" class="mt-0.5 h-4 w-4 text-red-600 dark:text-red-400" />
            <p class="text-sm text-red-700 dark:text-red-300">
              This action cannot be undone. Please proceed with caution.
            </p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-row items-center justify-start gap-3">
        <Button variant="outline" :disabled="loading" @click="handleCancel">
          {{ cancelText }}
        </Button>
        <Button :color="confirmColor" :loading="loading" @click="handleConfirm">
          {{ confirmText }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
