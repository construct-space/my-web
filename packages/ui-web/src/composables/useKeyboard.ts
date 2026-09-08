import { onMounted, onUnmounted } from 'vue'

export interface KeyBinding {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  handler: (e: KeyboardEvent) => void
  prevent?: boolean
}

export function useKeyboard(bindings: KeyBinding[]) {
  function handleKeydown(e: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().includes('MAC')

    for (const binding of bindings) {
      const wantsMod = binding.ctrl || binding.meta
      const modPressed = isMac ? e.metaKey : e.ctrlKey

      if (wantsMod && !modPressed) continue
      if (!wantsMod && (e.ctrlKey || e.metaKey)) continue
      if (binding.shift && !e.shiftKey) continue
      if (!binding.shift && e.shiftKey) continue
      if (binding.alt && !e.altKey) continue
      if (!binding.alt && e.altKey) continue

      if (e.key.toLowerCase() === binding.key.toLowerCase()) {
        if (binding.prevent !== false) e.preventDefault()
        binding.handler(e)
        return
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
}

/** Register a single keyboard shortcut */
export function useHotkey(key: string, handler: () => void, modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) {
  useKeyboard([{ key, handler, ...modifiers, meta: modifiers.ctrl }])
}
