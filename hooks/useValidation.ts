// useValidation.ts
// Runs all 4 validation checks on the active config.
// Calls: cycleDetection → subnetAllocator overlap check → bfsValidator → VLAN uniqueness

import { useMemo } from 'react'
import { detectCycles } from '@/lib/algorithms/cycleDetection'
import { checkSubnetOverlap } from '@/lib/algorithms/subnetAllocator'
import { validateConnectivity } from '@/lib/algorithms/bfsValidator'
import { simulateRoute } from '@/lib/algorithms/routingSimulator'
import type { Department, ValidationResult } from '@/types'

export function useValidation(departments: Department[]): ValidationResult {
  return useMemo(() => {
    // 1. Cycle detection
    const { hasCycle, cycle } = detectCycles(departments)
    const cycleCheck = {
      passed: !hasCycle,
      message: hasCycle
        ? `Cycle detected: ${cycle.join(' → ')}`
        : 'No routing loops detected in graph topology.',
      affected: hasCycle ? cycle : undefined,
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

    // 3. Connectivity & Routing check (BFS + L3 Route Simulation)
    const { allReachable, isolated } = validateConnectivity(departments)
    
    // Perform pairwise route simulation between all departments
    const hasRouters = departments.some((d) => d.type === 'router')
    const routingFailures: string[] = []

    if (hasRouters && departments.length > 1) {
      const depts = departments.filter((d) => d.type === 'department' || !d.type)
      for (const src of depts) {
        for (const dest of depts) {
          if (src.id === dest.id) continue
          if (dest.subnet) {
            const [baseIp] = dest.subnet.split('/')
            const ipParts = baseIp.split('.').map((p) => parseInt(p, 10))
            // Clamp to ≤254 so we never produce an invalid octet (e.g. 256)
            ipParts[3] = Math.min(ipParts[3] + 1, 254)
            const testIp = ipParts.join('.')

            const trace = simulateRoute(departments, src.id, testIp)
            if (!trace.success) {
              routingFailures.push(`${src.name} ➔ ${dest.name} (${trace.message})`)
            }
          }
        }
      }
    }

    const connectivityPassed = allReachable && routingFailures.length === 0
    let connectivityMessage = 'All departments reachable via BFS.'
    if (!allReachable) {
      connectivityMessage = `${isolated.length} isolated node${isolated.length !== 1 ? 's' : ''} detected.`
    } else if (routingFailures.length > 0) {
      connectivityMessage = `Routing trace failures: ${routingFailures[0]}${routingFailures.length > 1 ? ` (+${routingFailures.length - 1} more)` : ''}`
    }

    const connectivityCheck = {
      passed: connectivityPassed,
      message: connectivityMessage,
      affected: allReachable ? (routingFailures.length > 0 ? routingFailures : undefined) : isolated,
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
