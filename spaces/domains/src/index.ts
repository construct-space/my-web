import type { InfraSpace } from '@construct-space/infra-shell'

// Domains is available to any signed-in user — unlike Delivery, ownership is
// self-evident (if you have domains, you bought them; if you don't, the list
// is empty and Search is your entry point). No capability gate needed.
const space: InfraSpace = {
  id: 'domains',
  name: 'Domains',
  description: 'Search, register, and manage your domain names.',
  icon: 'globe-2',
  requires: ['identity'],
  sections: [
    {
      label: 'DOMAINS',
      items: [
        { id: '', label: 'Overview', icon: 'gauge' },
        { id: 'domains', label: 'My domains', icon: 'list' },
        { id: 'search', label: 'Search', icon: 'search' },
        { id: 'orders', label: 'Orders', icon: 'receipt' },
      ],
    },
  ],
  load: () => import('./Dispatcher.vue'),
}

export default space
