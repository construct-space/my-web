import { ref, watch, type Ref } from 'vue'

/** Returns a debounced ref that updates after `ms` delay */
export function useDebounce<T>(source: Ref<T>, ms = 300): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(source, (val) => {
    clearTimeout(timer)
    timer = setTimeout(() => { debounced.value = val }, ms)
  })

  return debounced
}

/** Returns a throttled ref that updates at most once per `ms` */
export function useThrottle<T>(source: Ref<T>, ms = 300): Ref<T> {
  const throttled = ref(source.value) as Ref<T>
  let lastUpdate = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(source, (val) => {
    const now = Date.now()
    const remaining = ms - (now - lastUpdate)

    clearTimeout(timer)

    if (remaining <= 0) {
      throttled.value = val
      lastUpdate = now
    } else {
      timer = setTimeout(() => {
        throttled.value = val
        lastUpdate = Date.now()
      }, remaining)
    }
  })

  return throttled
}

/** Creates a debounced function */
export function debounce<T extends (...args: any[]) => any>(fn: T, ms = 300): T {
  let timer: ReturnType<typeof setTimeout> | undefined
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}
