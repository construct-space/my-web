import { ref } from 'vue'

export interface Notification {
  id: string
  title: string
  description?: string
  color?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  action?: { label: string; onClick: () => void }
}

const notifications = ref<Notification[]>([])

let idCounter = 0

function add(notification: Omit<Notification, 'id'>) {
  const id = `notification-${++idCounter}-${Date.now()}`
  const duration = notification.duration ?? 5000

  notifications.value.push({ ...notification, id })

  if (duration > 0) {
    setTimeout(() => {
      remove(id)
    }, duration)
  }

  return id
}

function remove(id: string) {
  const index = notifications.value.findIndex((t) => t.id === id)
  if (index !== -1) {
    notifications.value.splice(index, 1)
  }
}

function clear() {
  notifications.value.splice(0, notifications.value.length)
}

export function useNotification() {
  return {
    notifications,
    add,
    remove,
    clear,
    notification: { add, remove, clear },
  }
}

/** Quick notification helper — `notify('Saved!')` or `notify('Error', 'error')` */
export function notify(title: string, color?: Notification['color'], description?: string) {
  return add({ title, color: color || 'info', description })
}
