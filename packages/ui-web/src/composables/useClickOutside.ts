import { onMounted, onUnmounted, type Ref } from 'vue'

export function useClickOutside(target: Ref<HTMLElement | null>, handler: (e: MouseEvent) => void) {
  function onClick(e: MouseEvent) {
    if (!target.value) return
    if (target.value.contains(e.target as Node)) return
    handler(e)
  }

  onMounted(() => document.addEventListener('mousedown', onClick))
  onUnmounted(() => document.removeEventListener('mousedown', onClick))
}
