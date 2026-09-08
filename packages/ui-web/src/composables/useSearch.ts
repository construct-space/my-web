import { ref, computed, watch, type Ref } from 'vue'

export interface UseSearchOptions<T> {
  /** Fields to search in (dot notation supported) */
  keys?: string[]
  /** Debounce delay in ms */
  debounce?: number
  /** Case sensitive */
  caseSensitive?: boolean
}

function getNestedValue(obj: any, path: string): string {
  return String(path.split('.').reduce((o, k) => o?.[k], obj) ?? '')
}

export function useSearch<T>(items: Ref<T[]>, options: UseSearchOptions<T> = {}) {
  const query = ref('')
  const debouncedQuery = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined
  const delay = options.debounce ?? 200

  watch(query, (val) => {
    clearTimeout(timer)
    timer = setTimeout(() => { debouncedQuery.value = val }, delay)
  })

  const results = computed(() => {
    const q = (options.caseSensitive ? debouncedQuery.value : debouncedQuery.value.toLowerCase()).trim()
    if (!q) return items.value

    return items.value.filter((item) => {
      if (options.keys?.length) {
        return options.keys.some((key) => {
          const val = options.caseSensitive
            ? getNestedValue(item, key)
            : getNestedValue(item, key).toLowerCase()
          return val.includes(q)
        })
      }
      // No keys specified — search all string values
      const str = options.caseSensitive ? JSON.stringify(item) : JSON.stringify(item).toLowerCase()
      return str.includes(q)
    })
  })

  const isEmpty = computed(() => results.value.length === 0 && query.value.length > 0)

  function clear() {
    query.value = ''
    debouncedQuery.value = ''
  }

  return { query, results, isEmpty, clear }
}
