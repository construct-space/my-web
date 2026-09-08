import { onMounted, onUnmounted } from 'vue'

export function useEscapeKey(callback: () => void) {
  function handler(e: KeyboardEvent) {
    if (e.key === 'Escape') callback()
  }
  onMounted(() => document.addEventListener('keydown', handler))
  onUnmounted(() => document.removeEventListener('keydown', handler))
}
