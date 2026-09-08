import type { RouteRecordRaw } from 'vue-router'
import { infraSpaces } from './spaces'

const spaceRoutes: RouteRecordRaw[] = infraSpaces.map((space) => ({
  path: `/${space.id}/:subPage(.*)?`,
  name: space.id,
  component: () => import('./views/SpaceView.vue'),
  props: (route) => ({ spaceId: space.id, subPage: route.params.subPage || '' }),
  meta: { requiresAuth: true },
}))

// Public routes (no session required). The shell's auth guard lets these
// render without a redirect; everything else bounces to /login?next=…
const publicPaths = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/oauth/callback',
  '/consent',
])
export function isPublicRoute(path: string): boolean {
  return publicPaths.has(path)
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('./views/Home.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('./views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('./views/Register.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('./views/ForgotPassword.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('./views/ResetPassword.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/oauth/callback',
    name: 'oauth-callback',
    component: () => import('./views/OAuthCallback.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/consent',
    name: 'consent',
    component: () => import('./views/Consent.vue'),
    meta: { requiresAuth: true },
  },
  // Back-compat: old /signin links resolve to the new /login.
  { path: '/signin', redirect: (to) => ({ path: '/login', query: to.query }) },
  ...spaceRoutes,
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]
