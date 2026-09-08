<script setup lang="ts">
/**
 * Developer space dispatcher — maps every sub-nav id to a page. Async
 * imports so each page (especially GraphQL playground and schema/data
 * browsers, when they land) ships as its own chunk and Overview stays
 * fast to first paint.
 */

import { defineAsyncComponent, computed } from 'vue'
import { Placeholder } from '@construct-space/infra-shell'
import Overview from './pages/Overview.vue'

const Profile      = defineAsyncComponent(() => import('./pages/Profile.vue'))
const Spaces       = defineAsyncComponent(() => import('./pages/Spaces.vue'))
const SpaceDetail  = defineAsyncComponent(() => import('./pages/SpaceDetail.vue'))
const Bundles      = defineAsyncComponent(() => import('./pages/Bundles.vue'))
const BundleDetail = defineAsyncComponent(() => import('./pages/BundleDetail.vue'))
const Keys         = defineAsyncComponent(() => import('./pages/Keys.vue'))
const Publish      = defineAsyncComponent(() => import('./pages/Publish.vue'))
const Transfers    = defineAsyncComponent(() => import('./pages/Transfers.vue'))
const Schemas      = defineAsyncComponent(() => import('./pages/Schemas.vue'))
const Playground   = defineAsyncComponent(() => import('./pages/Playground.vue'))
const Usage        = defineAsyncComponent(() => import('./pages/Usage.vue'))

const props = defineProps<{ subPage?: string }>()

interface PageSpec {
  component: any
  props?: Record<string, unknown>
}

const page = computed<PageSpec>(() => {
  const sub = props.subPage || ''

  // Nested route: /developer/spaces/:name → SpaceDetail. Handle the
  // prefix match here rather than duplicating the list/detail split
  // in vue-router; Shell already hands us the raw subPage string.
  if (sub.startsWith('spaces/')) {
    const spaceId = sub.slice('spaces/'.length)
    if (!spaceId) {
      return { component: Spaces }
    }
    return {
      component: SpaceDetail,
      props: { spaceId },
    }
  }
  if (sub.startsWith('bundles/')) {
    const bundleId = sub.slice('bundles/'.length)
    if (!bundleId) {
      return { component: Bundles }
    }
    return {
      component: BundleDetail,
      props: { bundleId },
    }
  }

  switch (sub) {
    case '':           return { component: Overview }
    case 'profile':    return { component: Profile }
    case 'spaces':     return { component: Spaces }
    case 'bundles':    return { component: Bundles }
    case 'keys':       return { component: Keys }
    case 'publish':    return { component: Publish }
    case 'transfers':  return { component: Transfers }
    case 'schemas':    return { component: Schemas }
    case 'playground': return { component: Playground }
    case 'usage':      return { component: Usage }

    default:
      return {
        component: Placeholder,
        props: { title: 'Not found', icon: 'search-x', description: `No sub-page "${sub}" on Developer.` },
      }
  }
})
</script>

<template>
  <component :is="page.component" v-bind="page.props" />
</template>
