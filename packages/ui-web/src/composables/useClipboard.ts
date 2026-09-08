import { ref } from 'vue'

const copied = ref(false)
const text = ref('')
let resetTimer: ReturnType<typeof setTimeout> | undefined

async function copy(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    text.value = value
    copied.value = true
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => { copied.value = false }, 2000)
    return true
  } catch {
    // Fallback for older browsers
    try {
      const el = document.createElement('textarea')
      el.value = value
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      text.value = value
      copied.value = true
      clearTimeout(resetTimer)
      resetTimer = setTimeout(() => { copied.value = false }, 2000)
      return true
    } catch {
      return false
    }
  }
}

export function useClipboard() {
  return { copied, text, copy }
}
