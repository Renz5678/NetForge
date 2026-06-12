// edgeWeights.ts
// Professional link cost model for Dijkstra / A* path costing.
//
// Rationale (Network Engineer perspective):
//   - WAN links carry the highest cost: real-world latency, bandwidth constraints,
//     and OSPF metrics on WAN circuits are typically 10–100× higher than LAN.
//   - Router-to-Router peering: moderate cost (IGP peer adjacency).
//   - Router-to-Switch boundary: low cost (LAN routed link).
//   - Switch-to-Switch: very low (intra-LAN trunk).
//   - Switch-to-Dept endpoint: minimal (access port — 1 hop, full bandwidth).
//
// This table is symmetric (swap src/dst → same weight).

import type { NetworkNode } from '@/types'

type DeviceType = 'wan' | 'firewall' | 'router' | 'switch' | 'department'

const COST_MATRIX: Record<DeviceType, Record<DeviceType, number>> = {
  wan:        { wan: 10, firewall: 8, router: 7, switch: 6,  department: 5 },
  firewall:   { wan: 8,  firewall: 5, router: 4, switch: 4,  department: 4 },
  router:     { wan: 7,  firewall: 4, router: 5, switch: 3,  department: 2 },
  switch:     { wan: 6,  firewall: 4, router: 3, switch: 2,  department: 1 },
  department: { wan: 5,  firewall: 4, router: 2, switch: 1,  department: 2 },
}

function toType(dept: NetworkNode): DeviceType {
  return (dept.type as DeviceType) ?? 'department'
}

/**
 * Returns the link cost between two devices.
 * Lower = preferred path (like OSPF cost).
 */
export function getEdgeWeight(src: NetworkNode, tgt: NetworkNode): number {
  const st = toType(src)
  const tt = toType(tgt)
  return COST_MATRIX[st]?.[tt] ?? COST_MATRIX[tt]?.[st] ?? 2
}

/**
 * Returns the physical link classification used for visual differentiation.
 * - wan:    WAN circuit (thickest stroke, dashed)
 * - routed: Routed L3 link between router/firewall
 * - trunk:  802.1Q trunk between switches
 * - access: Access port to an endpoint department
 */
export function getLinkType(
  src: NetworkNode,
  tgt: NetworkNode,
): 'access' | 'trunk' | 'wan' | 'routed' {
  const st = toType(src)
  const tt = toType(tgt)

  if (st === 'wan' || tt === 'wan') return 'wan'
  if (
    st === 'router' || tt === 'router' ||
    st === 'firewall' || tt === 'firewall'
  ) return 'routed'
  if (st === 'switch' && tt === 'switch') return 'trunk'
  return 'access'
}
