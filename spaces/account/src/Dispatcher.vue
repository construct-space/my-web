<script setup lang="ts">
/**
 * Account space dispatcher — routes sub-pages from the Shell sub-nav to
 * the right page component. Pages are under ./pages and ./pages/settings.
 *
 * Dynamic imports so each settings view lands in its own chunk — this
 * space's landing page (Overview) doesn't drag 2FA's QR renderer along
 * with it.
 */

import { defineAsyncComponent, computed } from 'vue'
import { Placeholder } from '@construct-space/infra-shell'
import Overview from './pages/Overview.vue'
import Appearance from './pages/settings/Appearance.vue'

const Password      = defineAsyncComponent(() => import('./pages/settings/Password.vue'))
const Sessions      = defineAsyncComponent(() => import('./pages/settings/Sessions.vue'))
const Notifications = defineAsyncComponent(() => import('./pages/settings/Notifications.vue'))
const Services      = defineAsyncComponent(() => import('./pages/settings/Services.vue'))
const Privacy       = defineAsyncComponent(() => import('./pages/settings/Privacy.vue'))
const TwoFactor     = defineAsyncComponent(() => import('./pages/settings/TwoFactor.vue'))
const Passkeys      = defineAsyncComponent(() => import('./pages/settings/Passkeys.vue'))

const props = defineProps<{ subPage?: string }>()

interface PageSpec {
  component: any
  props?: Record<string, unknown>
}

const page = computed<PageSpec>(() => {
  switch (props.subPage || '') {
    case '':              return { component: Overview }
    case 'appearance':    return { component: Appearance }
    case 'password':      return { component: Password }
    case 'sessions':      return { component: Sessions }
    case 'notifications': return { component: Notifications }
    case 'services':      return { component: Services }
    case '2fa':           return { component: TwoFactor }
    case 'passkeys':      return { component: Passkeys }
    case 'privacy':       return { component: Privacy }

    default:
      return {
        component: Placeholder,
        props: { title: 'Not found', icon: 'search-x', description: `No sub-page "${props.subPage}" on Account.` },
      }
  }
})
</script>

<template>
  <component :is="page.component" v-bind="page.props" />
</template>
