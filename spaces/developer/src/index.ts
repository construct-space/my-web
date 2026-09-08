import type { InfraSpace } from '@construct-space/infra-shell'

/**
 * Developer space — the "build & ship on Construct" surface.
 *
 * Covers what the old developer.lisaos.dev portal owned (publisher
 * profile, spaces registry, publish flow, transfers) AND what the old
 * graph.lisaos.dev admin console owned (schemas, data browse,
 * stats). One console, two backends, invisible to the user.
 *
 * Visible to anyone with the `developer` capability from /api/me/scope —
 * i.e. users with a personal Publisher or an org with Developer role.
 * Shell auto-hides it otherwise.
 */
const space: InfraSpace = {
  id: 'developer',
  name: 'Developer',
  description: 'Publish spaces, manage schemas + data, API keys.',
  icon: 'code',
  requires: ['developer'],
  sections: [
    {
      label: 'PUBLISHER',
      items: [
        { id: '', label: 'Overview', icon: 'layout-dashboard' },
        { id: 'profile', label: 'Profile', icon: 'user-round' },
        { id: 'keys', label: 'API keys', icon: 'key' },
      ],
    },
    {
      label: 'SPACES',
      items: [
        { id: 'spaces', label: 'My spaces', icon: 'package' },
        { id: 'bundles', label: 'Bundles', icon: 'package-2' },
        { id: 'publish', label: 'Publish', icon: 'upload-cloud' },
        { id: 'transfers', label: 'Transfers', icon: 'arrow-left-right' },
      ],
    },
    {
      label: 'DATA',
      items: [
        { id: 'schemas', label: 'Schemas', icon: 'database' },
        { id: 'playground', label: 'GraphQL', icon: 'terminal' },
        { id: 'usage', label: 'Usage', icon: 'activity' },
      ],
    },
  ],
  load: () => import('./Dispatcher.vue'),
}

export default space
