/**
 * Space catalog — each entry is an independent workspace package under
 * my/spaces/*. Core imports them here and hands the list to the
 * shell. Eventually this becomes dynamic IIFE loading (like construct-app's
 * SpaceLoader) so each space can be developed + published independently.
 */

import type { InfraSpace } from '@construct-space/infra-shell'
import account   from '@construct-space/space-account'
import delivery  from '@construct-space/space-delivery'
import developer from '@construct-space/space-developer'
import domains   from '@construct-space/space-domains'
import org       from '@construct-space/space-org'

export const infraSpaces: InfraSpace[] = [
  account,
  developer,
  org,
  delivery,
  domains,
]

export function findSpace(id: string): InfraSpace | undefined {
  return infraSpaces.find((s) => s.id === id)
}
