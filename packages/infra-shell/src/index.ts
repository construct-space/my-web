/**
 * @construct-space/infra-shell — reusable primitives for any Construct
 * infra portal (the core "Construct Account" today, potentially others
 * tomorrow). Contains:
 *   - Types that describe spaces and their sub-nav
 *   - A shared Pinia session store consumed by core + spaces
 *   - Reusable UI pieces (Placeholder for work-in-progress pages)
 *
 * Spaces and the core host should never import the host's internals
 * directly — everything shared flows through this package.
 */

export type {
  InfraSpace,
  SpaceSection,
  SpaceNavItem,
  SettingsEntry,
} from './types.js'

export { useSessionStore } from './session.js'
export { useSession, type UseSession } from './useSession.js'

export { usePageToolbar, usePageActions, type ToolbarAction } from './pageToolbar.js'

export { default as Placeholder } from './Placeholder.vue'
