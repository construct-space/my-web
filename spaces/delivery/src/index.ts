import type { InfraSpace } from '@construct-space/infra-shell'

const space: InfraSpace = {
  id: 'delivery',
  name: 'Delivery',
  description: 'Email infrastructure — sending domains, messages, API keys.',
  icon: 'mail',
  requires: ['identity', 'delivery'],
  sections: [
    {
      label: 'DELIVERY',
      items: [
        { id: '', label: 'Overview', icon: 'gauge' },
        { id: 'domains', label: 'Domains', icon: 'globe-2' },
        { id: 'messages', label: 'Messages', icon: 'send' },
        { id: 'api-keys', label: 'API keys', icon: 'key-square' },
      ],
    },
  ],
  load: () => import('./Dispatcher.vue'),
}

export default space
