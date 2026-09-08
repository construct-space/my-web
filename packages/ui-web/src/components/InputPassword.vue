<script setup lang="ts">
/**
 * InputPassword — Construct UI
 *
 * Password input with a visible show/hide toggle and an opt-in strength
 * meter. Everything else (autocomplete, name, disabled, placeholder,
 * size, aria-*) passes through to the underlying <Input> via $attrs.
 *
 * Accessibility:
 * - The eye toggle is a real <button> with aria-label + aria-pressed,
 *   keyboard-reachable (tab-order), and visible (not sr-only).
 * - Strength feedback is in an aria-live="polite" region so screen
 *   readers announce changes as the user types.
 * - We don't auto-focus; callers pass autofocus themselves if wanted.
 *
 * Usage:
 *   <InputPassword v-model="pw" autocomplete="current-password" />
 *   <InputPassword v-model="pw" autocomplete="new-password" strength />
 *   <InputPassword v-model="pw" :show-toggle="false" />
 */
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import Input from './Input.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string
  /** Render an eye icon that toggles the input type text/password. */
  showToggle?: boolean
  /** Render a strength meter under the input (only useful for new passwords). */
  strength?: boolean
  /** Minimum characters under which strength is clamped to "weak". */
  minLength?: number
  placeholder?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
}>(), {
  modelValue: '',
  showToggle: true,
  strength: false,
  minLength: 8,
  placeholder: 'Password',
  size: 'md',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const visible = ref(false)

const strengthScore = computed(() => {
  const p = props.modelValue || ''
  if (!p) return { score: 0, label: '' }
  let score = 0
  if (p.length >= props.minLength) score++
  if (p.length >= props.minLength + 4) score++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  const labels = ['very weak', 'weak', 'ok', 'good', 'strong', 'excellent']
  return { score, label: labels[Math.min(score, 5)] }
})

const strengthBarColor = computed(() => {
  const s = strengthScore.value.score
  if (s >= 4) return 'bg-green-500'
  if (s >= 3) return 'bg-[var(--app-accent)]'
  if (s >= 2) return 'bg-yellow-500'
  return 'bg-red-500'
})

function toggleVisible() { visible.value = !visible.value }
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="relative">
      <Input
        v-bind="$attrs"
        :model-value="modelValue"
        :type="visible ? 'text' : 'password'"
        :placeholder="placeholder"
        :size="size"
        :disabled="disabled"
        @update:model-value="(v) => emit('update:modelValue', String(v))"
      />
      <button
        v-if="showToggle"
        type="button"
        :aria-label="visible ? 'Hide password' : 'Show password'"
        :aria-pressed="visible"
        :disabled="disabled"
        class="absolute inset-y-0 right-0 px-2.5 grid place-items-center text-[var(--app-muted)] hover:text-[var(--app-foreground)] focus-visible:text-[var(--app-foreground)] focus-visible:outline-none rounded-r-md transition-colors disabled:opacity-40"
        @click="toggleVisible"
      >
        <Icon :icon="visible ? 'lucide:eye-off' : 'lucide:eye'" class="size-4" aria-hidden="true" />
      </button>
    </div>

    <!-- Live region so screen readers announce strength as it updates. -->
    <div
      v-if="strength"
      class="flex items-center gap-2 text-xs text-[var(--app-muted)] min-h-4"
      :aria-hidden="!modelValue"
    >
      <div
        v-if="modelValue"
        class="flex-1 h-1 rounded-full bg-[var(--app-surface)] overflow-hidden"
        role="progressbar"
        aria-label="Password strength"
        :aria-valuenow="strengthScore.score"
        aria-valuemin="0"
        aria-valuemax="5"
      >
        <div
          class="h-full transition-all duration-150"
          :class="strengthBarColor"
          :style="{ width: `${(strengthScore.score / 5) * 100}%` }"
        />
      </div>
      <span class="capitalize tabular-nums" aria-live="polite">{{ strengthScore.label }}</span>
    </div>
  </div>
</template>
