import { ref, onMounted } from 'vue'

export interface AuthUser {
  id: string
  name: string
  email: string
  avatar?: string
  username?: string
}

export interface UseAuthOptions {
  /** Base URL for the auth API (e.g. '' for same-origin, or 'https://accounts.lisaos.dev') */
  apiBase?: string
  /** Path to check current user session */
  mePath?: string
  /** Path to redirect for login */
  loginPath?: string
  /** Path to redirect for logout */
  logoutPath?: string
  /** Whether to auto-check session on mount */
  autoCheck?: boolean
}

const defaultOptions: Required<UseAuthOptions> = {
  apiBase: '',
  mePath: '/api/auth/me',
  loginPath: '/api/auth/login',
  logoutPath: '/api/auth/logout',
  autoCheck: true,
}

export function useAuth(options: UseAuthOptions = {}) {
  const opts = { ...defaultOptions, ...options }
  const user = ref<AuthUser | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function checkSession(): Promise<AuthUser | null> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${opts.apiBase}${opts.mePath}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        user.value = null
        return null
      }
      const data = await res.json()
      user.value = data.user || data
      return user.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Auth check failed'
      user.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  function login() {
    window.location.href = `${opts.apiBase}${opts.loginPath}`
  }

  function logout() {
    window.location.href = `${opts.apiBase}${opts.logoutPath}`
  }

  if (opts.autoCheck) {
    onMounted(() => {
      checkSession()
    })
  }

  return {
    user,
    loading,
    error,
    checkSession,
    login,
    logout,
  }
}
