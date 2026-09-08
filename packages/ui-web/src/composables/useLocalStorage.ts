import { ref, watch, type Ref } from 'vue'

export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
  const stored = ref<T>(defaultValue) as Ref<T>

  // Read initial value
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      stored.value = JSON.parse(raw)
    }
  } catch { /* use default */ }

  // Persist on change
  watch(stored, (val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val))
    } catch { /* storage full or unavailable */ }
  }, { deep: true })

  // Listen for changes from other tabs
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== key) return
      try {
        stored.value = e.newValue ? JSON.parse(e.newValue) : defaultValue
      } catch { /* ignore */ }
    })
  }

  return stored
}
