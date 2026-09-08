import type { InfraSpace } from '@construct-space/infra-shell'

const space: InfraSpace = {
  id: 'account',
  name: 'Account',
  description: 'Your profile, security, preferences, and services.',
  icon: 'user',
  sections: [
    {
      label: 'ACCOUNT',
      items: [
        { id: '', label: 'Overview', icon: 'user' },
        { id: 'services', label: 'Services', icon: 'layout-grid' },
      ],
    },
    {
      label: 'SECURITY',
      items: [
        { id: 'password', label: 'Password', icon: 'lock' },
        { id: '2fa', label: 'Two-Factor', icon: 'shield-check' },
        { id: 'passkeys', label: 'Passkeys', icon: 'key-round' },
        { id: 'sessions', label: 'Sessions', icon: 'monitor' },
      ],
    },
    {
      label: 'PREFERENCES',
      items: [
        { id: 'appearance', label: 'Appearance', icon: 'palette' },
        { id: 'notifications', label: 'Notifications', icon: 'bell' },
        { id: 'privacy', label: 'Privacy', icon: 'eye-off' },
      ],
    },
  ],
  load: () => import('./Dispatcher.vue'),
}

export default space
