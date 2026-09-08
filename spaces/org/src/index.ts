import type { InfraSpace } from '@construct-space/infra-shell'

/**
 * Organization space — the "run your org" admin surface.
 *
 * Fronts api/source: members, invites, roles, projects, billing. Visible
 * only when the active scope is an org (the shell adds `scope:org` to the
 * capability set when scope === 'org'); falls away for personal scope.
 *
 * Third and final first-party space. Future org-admin surfaces (audit
 * log, SSO, provider keys) slot in as new items under the existing
 * sections or as new sections — the shell lays the rail out top-down.
 */
const space: InfraSpace = {
  id: 'org',
  name: 'Organization',
  description: 'Members, roles, projects, and billing for your org.',
  icon: 'building-2',
  requires: ['scope:org'],
  sections: [
    {
      label: 'OVERVIEW',
      items: [
        { id: '', label: 'Overview', icon: 'layout-dashboard' },
      ],
    },
    {
      label: 'MEMBERS',
      items: [
        { id: 'members', label: 'Members', icon: 'users' },
        { id: 'invites', label: 'Invites', icon: 'mail' },
        { id: 'roles',   label: 'Roles',   icon: 'shield' },
      ],
    },
    {
      label: 'PROJECTS',
      items: [
        { id: 'projects', label: 'Projects', icon: 'folder-kanban' },
      ],
    },
    {
      label: 'SETTINGS',
      items: [
        { id: 'services',  label: 'Services',     icon: 'layout-grid' },
        { id: 'providers', label: 'AI Providers', icon: 'cpu' },
        { id: 'policies',  label: 'Policies',     icon: 'shield-check' },
        { id: 'billing',   label: 'Billing',      icon: 'credit-card' },
      ],
    },
  ],
  load: () => import('./Dispatcher.vue'),
}

export default space
