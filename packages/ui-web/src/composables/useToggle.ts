import { ref, type Ref } from 'vue'

export function useToggle(initial = false): [Ref<boolean>, (value?: boolean) => void] {
  const state = ref(initial)

  function toggle(value?: boolean) {
    state.value = value !== undefined ? value : !state.value
  }

  return [state, toggle]
}

export function useCounter(initial = 0, options?: { min?: number; max?: number }) {
  const count = ref(initial)

  function increment(delta = 1) {
    const next = count.value + delta
    count.value = options?.max !== undefined ? Math.min(next, options.max) : next
  }

  function decrement(delta = 1) {
    const next = count.value - delta
    count.value = options?.min !== undefined ? Math.max(next, options.min) : next
  }

  function reset() {
    count.value = initial
  }

  function set(value: number) {
    let v = value
    if (options?.min !== undefined) v = Math.max(v, options.min)
    if (options?.max !== undefined) v = Math.min(v, options.max)
    count.value = v
  }

  return { count, increment, decrement, reset, set }
}
