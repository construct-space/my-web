import type { Component } from 'vue'

/**
 * Shared types for any Construct infra portal. Portals register a catalog
 * of spaces (domain UIs) and a catalog of core settings (app prefs) and
 * hand them to the shell. The shell handles routing + chrome.
 */

export interface SpaceSection {
  label: string                    // caps heading, e.g. "ACCOUNT", "SECURITY"
  items: SpaceNavItem[]
}

export interface SpaceNavItem {
  id: string                       // sub-page id — matches :subPage route param
  label: string
  icon: string                     // lucide name
}

export interface InfraSpace {
  id: string
  name: string
  description: string
  icon: string                     // lucide name for the icon-rail entry
  /** Optional capability gates — shell filters spaces the user can see. */
  requires?: string[]
  sections: SpaceSection[]
  load: () => Promise<{ default: Component }>
}

/**
 * Core settings entries — app-wide prefs that aren't tied to any space.
 * The shell renders these under a dedicated /settings route.
 */
export interface SettingsEntry {
  id: string
  label: string
  icon: string
  section?: string                 // optional group heading, default "GENERAL"
  load: () => Promise<{ default: Component }>
}
