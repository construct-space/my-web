/**
 * Per-page Toolbar actions — right-side buttons in the 3D toolbar.
 *
 * Pages call usePageToolbar(actions) in setup(); the shell reads the
 * shared ref and hands it to Toolbar3D. Lifecycle is handled here:
 * when the page unmounts, actions are cleared.
 *
 * Accepts a plain array (static) or a Ref / ComputedRef (reactive —
 * needed for things like theme toggle where `active` changes with state).
 */

import { ref, onBeforeUnmount, watch, type Ref, type ComputedRef } from 'vue'

export interface ToolbarAction {
  id: string
  icon: string
  label: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  to?: string
}

const pageActions = ref<ToolbarAction[]>([])

type ActionsInput = ToolbarAction[] | Ref<ToolbarAction[]> | ComputedRef<ToolbarAction[]>

export function usePageToolbar(actions: ActionsInput): void {
  if (Array.isArray(actions)) {
    pageActions.value = actions
  } else {
    const stop = watch(actions, (v) => { pageActions.value = v }, { immediate: true })
    onBeforeUnmount(stop)
  }
  onBeforeUnmount(() => {
    pageActions.value = []
  })
}

/** Consumed by the shell — do not call from pages. */
export function usePageActions(): Ref<ToolbarAction[]> {
  return pageActions
}
