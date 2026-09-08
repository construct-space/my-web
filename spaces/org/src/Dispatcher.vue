<script setup lang="ts">
/**
 * Org space dispatcher — maps every sub-nav id to a page. Overview is
 * eager (small, always hit); everything else is an async import so each
 * tab ships as its own chunk and cold-start stays cheap.
 */

import { defineAsyncComponent, computed } from 'vue'
import { Placeholder } from '@construct-space/infra-shell'
import Overview from './pages/Overview.vue'

const Members        = defineAsyncComponent(() => import('./pages/Members.vue'))
const Invites        = defineAsyncComponent(() => import('./pages/Invites.vue'))
const Roles          = defineAsyncComponent(() => import('./pages/Roles.vue'))
const Projects       = defineAsyncComponent(() => import('./pages/Projects.vue'))
const ProjectDetail  = defineAsyncComponent(() => import('./pages/ProjectDetail.vue'))
const Services       = defineAsyncComponent(() => import('./pages/Services.vue'))
const Providers      = defineAsyncComponent(() => import('./pages/Providers.vue'))
const Policies       = defineAsyncComponent(() => import('./pages/Policies.vue'))
const Billing        = defineAsyncComponent(() => import('./pages/Billing.vue'))

const props = defineProps<{ subPage?: string }>()

interface PageSpec {
  component: any
  props?: Record<string, unknown>
}

const page = computed<PageSpec>(() => {
  const sub = props.subPage || ''

  // Nested routes: /org/projects/:id → project detail. Same pattern the
  // developer space uses for /developer/spaces/:name — prefix-match here
  // rather than splitting list/detail at the vue-router level.
  if (sub.startsWith('projects/')) {
    const id = sub.slice('projects/'.length).replace(/\/+$/, '')
    if (id) {
      return { component: ProjectDetail, props: { projectId: id } }
    }
  }

  switch (sub) {
    case '':         return { component: Overview }
    case 'members':  return { component: Members }
    case 'invites':  return { component: Invites }
    case 'roles':    return { component: Roles }
    case 'projects': return { component: Projects }
    case 'services':  return { component: Services }
    case 'providers': return { component: Providers }
    case 'policies':  return { component: Policies }
    case 'billing':   return { component: Billing }

    default:
      return {
        component: Placeholder,
        props: { title: 'Not found', icon: 'search-x', description: `No sub-page "${sub}" on Organization.` },
      }
  }
})
</script>

<template>
  <component :is="page.component" v-bind="page.props" />
</template>
