<script setup lang="ts">
/**
 * Domains space dispatcher. DomainDetail + DNS setup are deep-linked with
 * the domain name embedded in the sub-page path (domains/<name> and
 * domains/<name>/dns). Shell hands the raw sub-page string down; we parse
 * it into `{component, props}` so pages stay router-free.
 */

import { computed, defineAsyncComponent } from 'vue'
import { Placeholder } from '@construct-space/infra-shell'
import Overview from './pages/Overview.vue'

const Domains      = defineAsyncComponent(() => import('./pages/Domains.vue'))
const DomainDetail = defineAsyncComponent(() => import('./pages/DomainDetail.vue'))
const Search       = defineAsyncComponent(() => import('./pages/Search.vue'))
const Orders       = defineAsyncComponent(() => import('./pages/Orders.vue'))

const props = defineProps<{ subPage?: string }>()

interface PageSpec {
  component: any
  props?: Record<string, unknown>
}

const page = computed<PageSpec>(() => {
  const p = props.subPage || ''

  // domains/<name> → DomainDetail, possibly with a section tail. The detail
  // page self-switches on props.section so one component handles Overview,
  // DNS, Forwarding, SSL tabs without further routing here.
  if (p.startsWith('domains/')) {
    const rest = p.slice('domains/'.length)
    const [name, ...tail] = rest.split('/')
    return {
      component: DomainDetail,
      props: { name, section: tail.join('/') || 'overview' },
    }
  }

  switch (p) {
    case '':        return { component: Overview }
    case 'domains': return { component: Domains }
    case 'search':  return { component: Search }
    case 'orders':  return { component: Orders }

    default:
      return {
        component: Placeholder,
        props: { title: 'Not found', icon: 'search-x', description: `No sub-page "${p}" on Domains.` },
      }
  }
})
</script>

<template>
  <component :is="page.component" v-bind="page.props" />
</template>
