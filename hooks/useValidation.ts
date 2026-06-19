// useValidation.ts
// Runs all 4 validation checks on the active config.
// Calls: cycleDetection → subnetAllocator overlap check → bfsValidator → VLAN uniqueness

import { useMemo } from 'react'
import { detectCycles } from '@/lib/algorithms/cycleDetection'
import { checkSubnetOverlap } from '@/lib/algorithms/subnetAllocator'
import { validateConnectivity } from '@/lib/algorithms/bfsValidator'
import type { NetworkNode, ValidationResult } from '@/types'

export function useValidation(departments: NetworkNode[]): ValidationResult {
  return useMemo(() => {
    // 1. Cycle detection
    const { hasCycle, cycle } = detectCycles(departments)
    
    // A physical cycle is only a broadcast storm (L2 loop) if it consists entirely of L2 devices.
    // If the cycle contains at least one L3 boundary (router/firewall/wan), it's L3 redundancy, which is safe.
    let isL3Redundancy = false
    if (hasCycle) {
      isL3Redundancy = cycle.some(nodeName => {
        const node = departments.find(d => d.name === nodeName || d.id === nodeName)
        return node?.type === 'router' || node?.type === 'firewall' || node?.type === 'wan'
      })
    }

    const cycleCheck = {
      passed: !hasCycle || isL3Redundancy,
      message: hasCycle
        ? (isL3Redundancy 
            ? `L3 redundancy detected: ${cycle.join(' → ')} (Safe with OSPF/BGP)` 
            : `Routing loop detected: ${cycle.join(' → ')}`)
        : 'No routing loops detected in graph topology.',
      affected: hasCycle && !isL3Redundancy ? cycle : undefined,
    }

    // 2. Subnet allocation overlap check
    const allocated = departments.filter((d) => d.subnet !== undefined)
    let allocationCheck = {
      passed: true,
      message: 'All departments assigned non-overlapping subnets.',
      affected: undefined as string[] | undefined,
    }

    if (allocated.length < departments.length && departments.length > 0) {
      allocationCheck = {
        passed: false,
        message: 'Some departments have not been allocated subnets (cycle may be blocking allocation).',
        affected: departments.filter((d) => !d.subnet).map((d) => d.name),
      }
    } else if (allocated.length > 0) {
      const { overlapping, conflicts } = checkSubnetOverlap(departments)
      if (overlapping) {
        allocationCheck = {
          passed: false,
          message: `${conflicts.length} overlapping IP range${conflicts.length !== 1 ? 's' : ''} detected.`,
          affected: conflicts,
        }
      }
    }

    // 3. Connectivity check — BFS reachability only.
    // Routing simulation is intentionally NOT included here because it fails
    // for valid topologies that don't have switch-port VLAN configs or router
    // static routes (i.e. most user-built topologies). BFS is the ground truth
    // for whether nodes are topologically reachable.
    const { allReachable, isolated } = validateConnectivity(departments)

    const connectivityCheck = {
      passed: allReachable,
      message: allReachable
        ? 'All nodes reachable via BFS.'
        : `${isolated.length} isolated node${isolated.length !== 1 ? 's' : ''} detected.`,
      affected: allReachable ? undefined : isolated,
    }

    // 4. VLAN uniqueness check
    const vlanIds = departments.filter((d) => d.vlanId !== undefined).map((d) => d.vlanId!)
    const vlanSet = new Set(vlanIds)
    const duplicateVlans = vlanIds.filter((v, i) => vlanIds.indexOf(v) !== i)
    const vlanCheck = {
      passed: duplicateVlans.length === 0,
      message:
        duplicateVlans.length === 0
          ? 'All VLAN IDs assigned uniquely.'
          : `Duplicate VLAN IDs detected: ${[...new Set(duplicateVlans)].join(', ')}`,
      affected: duplicateVlans.length > 0
        ? departments
            .filter((d) => d.vlanId !== undefined && duplicateVlans.includes(d.vlanId))
            .map((d) => d.name)
        : undefined,
    }

    // Suppress TS unused-variable warning for vlanSet
    void vlanSet

    return { cycleCheck, allocationCheck, connectivityCheck, vlanCheck }
  }, [departments])
}
