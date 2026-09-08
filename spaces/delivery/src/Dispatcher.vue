<script setup lang="ts">
/**
 * Delivery space dispatcher — routes sub-pages from the Shell sub-nav.
 * DomainDetail is reached via /delivery/domains/:id (route-param path),
 * detected here by any sub-page matching `domains/<id>`.
 */

import { computed, defineAsyncComponent } from 'vue'
import { Placeholder } from '@construct-space/infra-shell'
import Overview from './pages/Overview.vue'

const Domains      = defineAsyncComponent(() => import('./pages/Domains.vue'))
const DomainDetail = defineAsyncComponent(() => import('./pages/DomainDetail.vue'))
const Messages     = defineAsyncComponent(() => import('./pages/Messages.vue'))
const APIKeys      = defineAsyncComponent(() => import('./pages/APIKeys.vue'))

const props = defineProps<{ subPage?: string }>()

interface PageSpec {
  component: any
  props?: Record<string, unknown>
}

const page = computed<PageSpec>(() => {
  const p = props.subPage || ''

  // domains/:id detail view — extract id from the sub-page segment and
  // hand it as a prop so the detail page doesn't need vue-router.
  if (p.startsWith('domains/')) {
    const id = p.slice('domains/'.length).split('/')[0]
    return { component: DomainDetail, props: { id } }
  }

  switch (p) {
    case '':         return { component: Overview }
    case 'domains':  return { component: Domains }
    case 'messages': return { component: Messages }
    case 'api-keys': return { component: APIKeys }

    default:
      return {
        component: Placeholder,
        props: { title: 'Not found', icon: 'search-x', description: `No sub-page "${p}" on Delivery.` },
      }
  }
})
</script>

<template>
  <component :is="page.component" v-bind="page.props" />
</template>
