/**
 * lib/autoIp.ts
 *
 * VLSM-based auto-IP assignment helper.
 *
 * Called after department add/update to silently assign a cidrPrefix.
 * Uses calculateVLSM with the config's baseIp + /16 as the parent block.
 * Returns the updated departments array — does NOT mutate the store directly.
 *
 * Algorithm files (vlsmCalculator.ts) are NOT modified.
 */

import { calculateVLSM } from '@/lib/algorithms/vlsmCalculator'
import type { Department, NetworkConfig } from '@/types'

/** Returns true if the given department needs IP assignment */
function needsIp(dept: Department): boolean {
  return !dept.cidrPrefix || !dept.subnet
}

/**
 * Run VLSM over all departments in the config and return updated departments
 * with cidrPrefix assigned. Silently no-ops if the address space is exhausted.
 */
export function autoAssignIps(config: NetworkConfig): Department[] {
  const { departments, baseIp } = config

  // Build VLSM requirements from all departments (even pre-assigned ones,
  // so we can recalculate consistently)
  const requirements = departments.map((d) => ({
    id: d.id,
    label: d.name,
    hosts: Math.max(d.deviceCount, 1),
  }))

  if (requirements.length === 0) return departments

  // Use baseIp/16 as the parent block — large enough for enterprise topologies
  const parentCidr = `${baseIp}/16`

  try {
    const result = calculateVLSM(parentCidr, requirements)

    if (!result.summary.success) {
      // Address space exhausted — return as-is, UI shows inline "No IP space" badge
      return departments
    }

    // Map results back to departments
    const resultMap = new Map(result.results.map((r) => [r.id, r]))

    return departments.map((dept) => {
      const vlsmResult = resultMap.get(dept.id)
      if (!vlsmResult) return dept

      return {
        ...dept,
        cidrPrefix: vlsmResult.prefix,
        subnet: vlsmResult.cidr,
        usableHosts: vlsmResult.allocatedHosts,
      }
    })
  } catch {
    // Any calculation error — return original unchanged
    return departments
  }
}

/**
 * Returns true if any department in the config has no assigned IP block.
 * Used to show the "No IP space" badge on canvas nodes.
 */
export function hasUnassignedIps(departments: Department[]): boolean {
  return departments.some((d) => !d.cidrPrefix || !d.subnet)
}
