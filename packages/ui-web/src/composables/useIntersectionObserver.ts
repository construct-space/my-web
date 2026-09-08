import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export function useIntersectionObserver(
  target: Ref<HTMLElement | null>,
  options?: IntersectionObserverInit,
) {
  const isVisible = ref(false)
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (!target.value) return
    observer = new IntersectionObserver(([entry]) => {
      isVisible.value = entry.isIntersecting
    }, options)
    observer.observe(target.value)
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return isVisible
}
