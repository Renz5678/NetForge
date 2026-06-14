/**
 * lib/validatePass.ts
 *
 * The NetForge Validate Pass orchestrator.
 *
 * Runs five analysis phases in order:
 *   1. Connectivity  — BFS reachability
 *   2. Addressing    — VLSM / subnet overlap / unassigned blocks
 *   3. Resilience    — Tarjan articulation-point analysis
 *   4. Correctness   — cycle detection + ACL conflict check
 *   5. Optimization  — Prim's MST redundancy review
 *
 * Algorithm files are called as pure functions — none are modified.
 * All types defined here to avoid colliding with the legacy ValidationResult
 * in types/index.ts.
 */

import { validateConnectivity } from '@/lib/algorithms/bfsValidator'
import { checkSubnetOverlap } from '@/lib/algorithms/subnetAllocator'
import { findArticulationPoints } from '@/lib/algorithms/articulationPoints'
import { topologicalSort } from '@/lib/algorithms/topologicalSort'
import { detectCycles } from '@/lib/algorithms/cycleDetection'
import { evaluateAcl, findMatchingRule } from '@/lib/algorithms/aclEngine'
import type { AclPacket } from '@/lib/algorithms/aclEngine'
import { findMinimumSpanningTree } from '@/lib/algorithms/prims'
import { ipToUint32, uint32ToIp, cidrToMask } from '@/lib/ipUtils'
import type { NetworkConfig, NetworkNode } from '@/types'

// ─── Result Types ─────────────────────────────────────────────────────────────

export type FindingSeverity = 'red' | 'yellow' | 'blue' | 'tip'

export type FindingPhase =
  | 'connectivity'
  | 'addressing'
  | 'resilience'
  | 'correctness'
  | 'optimization'

export type AlgorithmKey =
  | 'bfsValidator'
  | 'vlsmCalculator'
  | 'articulationPoints'
  | 'cycleDetection'
  | 'aclEngine'
  | 'prims'

export type Finding = {
  id: string
  phase: FindingPhase
  severity: FindingSeverity
  title: string          // one line, plain English, no algorithm names
  detail: string         // one sentence explanation
  fixSteps: string[]     // ordered list of actionable remediation steps
  affected: string[]     // node names or subnet strings
  algorithm: AlgorithmKey
  stepIndex: number      // step number where this finding was produced
  vizInput: object       // pre-computed input to pass to visualizer
}

export type ValidatePassLabel = 'Deploy Ready' | 'Deploy with Caution' | 'Not Ready'

export type ValidatePassResult = {
  score: number
  label: ValidatePassLabel
  findings: Finding[]
  ranAt: string  // ISO timestamp
  phasesRan: FindingPhase[]
}

// ─── Topology Readiness Pre-check ─────────────────────────────────────────────
//
// Run this BEFORE validateNetwork() to guard against structurally incomplete
// topologies that would produce a misleadingly perfect score (0 findings).
//
// Hard requirements — all must pass before the 5-phase validate pass runs:
//   1. ≥ 2 nodes           — a single device isn't a network
//   2. ≥ 1 link            — at least two nodes must be connected
//   3. No isolated nodes   — every node must have ≥ 1 peer
//   4. ≥ 1 routing device  — router, firewall, or layer-3 switch needed for
//                            addressing and routing correctness checks

export type TopologyReadiness = {
  ready: boolean
  blocking: string[]   // hard failures — prevent the run
  warnings: string[]   // soft advisories — run is allowed, but note these
}

export function topologyReadiness(config: NetworkConfig): TopologyReadiness {
  const depts = config.departments
  const blocking: string[] = []
  const warnings: string[] = []

  // 1. Minimum node count
  if (depts.length < 2) {
    blocking.push(
      depts.length === 0
        ? 'Add at least 2 nodes — this topology has no devices yet.'
        : 'Add at least 2 nodes — a single device cannot form a network.'
    )
  }

  if (depts.length >= 2) {
    // 2. At least one link must exist
    const hasAnyLink = depts.some((d) => d.peers.length > 0)
    if (!hasAnyLink) {
      blocking.push('Connect at least 2 nodes — no links exist between devices.')
    }

    // 3. No isolated nodes (every node must have ≥1 peer in an undirected sense)
    const degree = new Map<string, number>()
    depts.forEach(d => degree.set(d.id, 0))
    depts.forEach(d => {
      d.peers.forEach(p => {
        if (degree.has(p)) {
          degree.set(d.id, degree.get(d.id)! + 1)
          degree.set(p, degree.get(p)! + 1)
        }
      })
    })

    const isolated = depts.filter((d) => degree.get(d.id) === 0)
    if (isolated.length > 0 && hasAnyLink) {
      const names = isolated.map((d) => d.name).join(', ')
      blocking.push(
        `${isolated.length} node${isolated.length > 1 ? 's are' : ' is'} not connected to anything: ${names}.`
      )
    }

    // 4. At least one routing-capable device
    const ROUTING_TYPES = ['router', 'firewall', 'wan']
    const hasRouter = depts.some((d) => d.type && ROUTING_TYPES.includes(d.type))
    if (!hasRouter) {
      warnings.push(
        'No router or firewall found. Routing correctness checks will be limited to L2 topology only.'
      )
    }
  }

  return { ready: blocking.length === 0, blocking, warnings }
}

// ─── Phase 1: Connectivity ────────────────────────────────────────────────────

export function checkConnectivity(config: NetworkConfig): Finding[] {
  const { departments } = config
  if (departments.length <= 1) return []

  const { allReachable, isolated } = validateConnectivity(departments)
  if (allReachable) {
    return [{
      id: 'connectivity_ok',
      phase: 'connectivity',
      severity: 'blue',
      title: 'Cabling & Reachability OK',
      detail: `The Breadth-First Search (BFS) algorithm successfully traversed the network starting from an arbitrary root node, confirming that all ${departments.length} devices are part of a single contiguous graph. No isolated segments exist.`,
      fixSteps: [
        'The BFS queue explored all neighbor connections layer by layer.',
        'Because the number of visited nodes equals the total number of devices, the network topology is fully connected.',
        'This ensures that physical cabling and data link layer paths are theoretically viable between any two points.'
      ],
      affected: [],
      algorithm: 'bfsValidator',
      stepIndex: 0,
      vizInput: { departments },
    }]
  }

  return [
    {
      id: 'connectivity_isolated',
      phase: 'connectivity',
      severity: 'red',
      title: 'Network is not fully connected',
      detail: 'These devices have no path to the rest of the network.',
      fixSteps: [
        'Open the Departments tab and select each isolated device shown below.',
        'Add at least one peer connection to a device that is already part of the main topology (a router or core switch works best).',
        'Re-run validation to confirm all nodes are reachable.',
      ],
      affected: isolated,
      algorithm: 'bfsValidator',
      stepIndex: 0,
      vizInput: { departments },
    },
  ]
}

// ─── Phase 2: Addressing ──────────────────────────────────────────────────────

export function checkAddressing(config: NetworkConfig): Finding[] {
  const { departments, baseIp } = config
  const findings: Finding[] = []
  if (departments.length === 0) return findings

  // 2a. Overlap check
  const { overlapping, conflicts } = checkSubnetOverlap(departments)
  if (overlapping) {
    for (const conflict of conflicts) {
      findings.push({
        id: `addr_overlap_${conflict.replace(/\s/g, '_')}`,
        phase: 'addressing',
        severity: 'red',
        title: `Address conflict between ${conflict.replace(' ↔ ', ' and ')}`,
        detail: 'These two subnets share overlapping IP address ranges. Devices would be unreachable.',
        fixSteps: [
          `Open the Departments tab and select one of the two conflicting segments.`,
          'Change its Base IP or CIDR prefix so the address ranges no longer overlap (e.g. move one segment from 10.0.0.0/24 to 10.0.1.0/24).',
          'Tap Allocate in the Canvas tab to recalculate subnets, then re-run validation.',
        ],
        affected: conflict.split(' ↔ '),
        algorithm: 'vlsmCalculator',
        stepIndex: 0,
        vizInput: { departments },
      })
    }
  }

  // 2b. Unassigned subnets
  const unassigned = departments.filter((d) => !d.subnet && !d.cidrPrefix)
  if (unassigned.length > 0) {
    findings.push({
      id: 'addr_unassigned',
      phase: 'addressing',
      severity: 'yellow',
      title: `${unassigned.length} device${unassigned.length !== 1 ? 's have' : ' has'} no IP address assigned`,
      detail: 'Run the allocation pass or manually assign a CIDR prefix to all devices before deploying.',
      fixSteps: [
        'Go to the Canvas tab and tap the Allocate button to auto-assign subnets to all unaddressed devices.',
        'If you prefer manual assignment, open each device in the Departments tab and set a CIDR prefix (e.g. /24, /26).',
        'Every device must have a unique, non-overlapping subnet before the topology can be deployed.',
      ],
      affected: unassigned.map((d) => d.name),
      algorithm: 'vlsmCalculator',
      stepIndex: 0,
      vizInput: { departments, baseIp },
    })
  }

  // 2c. Address space capacity check (near capacity >90%)
  // Only runs when baseIp is known so we can derive the parent block.
  const assigned = departments.filter((d) => d.cidrPrefix !== undefined && d.subnet !== undefined)
  if (assigned.length > 0 && baseIp) {
    try {
      const baseNum = ipToUint32(baseIp)
      let maxEnd = baseNum

      for (const d of assigned) {
        const netNum = ipToUint32(d.subnet!.split('/')[0])
        const blockSize = Math.pow(2, 32 - (d.cidrPrefix ?? 30))
        const endNum = netNum + blockSize
        if (endNum > maxEnd) maxEnd = endNum
      }

      const totalRequired = assigned.reduce((sum, d) => {
        const blockSize = Math.pow(2, 32 - (d.cidrPrefix ?? 30))
        return sum + blockSize
      }, 0)

      // Determine the smallest power-of-2 block that:
      //  a) starts at baseNum, and
      //  b) contains all allocated addresses (maxEnd <= baseNum + parentBlockSize)
      // This is the "natural" parent block — what you'd actually provision.
      const span = maxEnd - baseNum
      let parentPrefix = 32
      while (parentPrefix > 1 && Math.pow(2, 32 - (parentPrefix - 1)) < span) {
        parentPrefix--
      }
      const parentBlockSize = Math.pow(2, 32 - parentPrefix)

      // Only warn when we're consuming >90% of the inferred parent block
      // (i.e., there is less than 10% headroom for future growth)
      if (parentBlockSize > 0 && parentBlockSize > totalRequired) {
        const utilizationPct = (totalRequired / parentBlockSize) * 100
        if (utilizationPct > 90) {
          findings.push({
            id: 'addr_near_capacity',
            phase: 'addressing',
            severity: 'blue',
            title: 'Address space is nearly full',
            detail: `Allocated subnets consume over 90% of the parent address block. Adding new devices may fail.`,
            fixSteps: [
              'Consider switching to a larger parent block — for example, use a /15 instead of /16 to double the available space.',
              'Alternatively, split your network into multiple non-overlapping address spaces (e.g. 10.0.0.0/16 and 10.1.0.0/16).',
              'Reserve at least 20% headroom for future growth before deploying.',
            ],
            affected: [],
            algorithm: 'vlsmCalculator',
            stepIndex: 0,
            vizInput: { departments, baseIp, utilizationPct },
          })
        }
      }
    } catch {
      // Ignore capacity check errors
    }
  }

  return findings
}

// ─── Phase 3: Resilience ──────────────────────────────────────────────────────

export function checkResilience(config: NetworkConfig): Finding[] {
  const { departments } = config
  if (departments.length <= 2) return []

  const findings: Finding[] = []
  const result = findArticulationPoints(departments)
  const idToName = new Map(departments.map((d) => [d.id, d.name]))
  const idToDept = new Map(departments.map((d) => [d.id, d]))

  // Emitting Deployment Order
  const topoOrder = topologicalSort(departments)
  if (topoOrder.length > 0) {
    const topoNames = topoOrder.map(id => idToName.get(id) ?? id)
    findings.push({
      id: 'resilience_deployment_order',
      phase: 'resilience',
      severity: 'blue',
      title: 'Deployment Order Computed',
      detail: `A Topological Sort via Breadth-First Search determined the optimal provisioning sequence:\n\n${topoNames.join(' → ')}\n\nCore infrastructure is prioritized before edge nodes.`,
      fixSteps: [
        'The algorithm built an undirected adjacency list from all peer relationships.',
        'It identified a routing-capable device (like a Firewall or Core Router) to act as the root node.',
        'By traversing outwards radially, it guarantees that upstream dependencies are brought online before downstream leaf nodes.'
      ],
      affected: [],
      algorithm: 'bfsValidator',
      stepIndex: 0,
      vizInput: { departments },
    })
  }

  for (const apId of result.articulationPoints) {
    const apName = idToName.get(apId) ?? apId

    // Calculate how many hosts would be isolated
    // Simulate removal by finding nodes only reachable through this AP
    const adj = new Map<string, Set<string>>()
    for (const dept of departments) {
      if (!adj.has(dept.id)) adj.set(dept.id, new Set())
      for (const p of dept.peers) {
        if (!adj.has(p)) adj.set(p, new Set())
        adj.get(dept.id)!.add(p)
        adj.get(p)!.add(dept.id)
      }
    }

    // BFS from any node that isn't the AP, without traversing through AP
    const otherNodes = departments.filter((d) => d.id !== apId)
    if (otherNodes.length === 0) continue

    const visited = new Set<string>()
    const queue = [otherNodes[0].id]
    visited.add(otherNodes[0].id)

    while (queue.length > 0) {
      const cur = queue.shift()!
      for (const neighbor of adj.get(cur) ?? []) {
        if (neighbor === apId) continue
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    const isolatedNodes = otherNodes.filter((d) => !visited.has(d.id))
    const isolatedHostCount = isolatedNodes.reduce((sum, d) => sum + (d.deviceCount ?? 0), 0)

    findings.push({
      id: `resilience_ap_${apId}`,
      phase: 'resilience',
      severity: 'tip',
      title: `Tip: Consider Redundancy for ${apName}`,
      detail: `${apName} acts as a single point of failure. Removing it would isolate ${isolatedHostCount} hosts across ${isolatedNodes.length} department${isolatedNodes.length !== 1 ? 's' : ''}. This is normal in a tree topology, but adding a secondary link could improve resilience.`,
      fixSteps: [
        `If high availability is required, add a second uplink from the downstream devices to a different router or switch that bypasses ${apName}.`,
        `Alternatively, add a direct peer link between ${apName}'s downstream neighbours so they can reach each other without going through it.`,
      ],
      affected: [apName, ...isolatedNodes.map((d) => d.name)],
      algorithm: 'articulationPoints',
      stepIndex: result.articulationPoints.indexOf(apId),
      vizInput: { departments, articulationPoints: result.articulationPoints },
    })
  }

  return findings
}

// ─── Phase 4: Correctness ─────────────────────────────────────────────────────

export function checkCorrectness(config: NetworkConfig): Finding[] {
  const { departments } = config
  const findings: Finding[] = []

  // 4a. Cycle detection
  const cycleResult = detectCycles(departments)
  if (cycleResult.hasCycle) {
    findings.push({
      id: 'correctness_cycle',
      phase: 'correctness',
      severity: 'red',
      title: 'Routing loop detected',
      detail: 'Packets would circulate indefinitely between these devices.',
      fixSteps: [
        'Open the Departments tab and identify the peer links between the devices listed below.',
        'Remove the link that closes the loop — this is the "back edge": the connection that points from a downstream device back up to an ancestor.',
        'If you need redundancy here, use a separate switch with Spanning Tree Protocol (STP) enabled instead of a direct back-link.',
        'Re-run validation to confirm the loop is resolved.',
      ],
      affected: cycleResult.cycle,
      algorithm: 'cycleDetection',
      stepIndex: 0,
      vizInput: { departments, cycle: cycleResult.cycle },
    })
  } else {
    findings.push({
      id: 'correctness_no_loop',
      phase: 'correctness',
      severity: 'blue',
      title: 'Routing Loops: None detected',
      detail: `A Depth-First Search (DFS) traversal confirmed the graph is acyclic. The topology contains no physical loops that could cause broadcast storms.`,
      fixSteps: [
        'The DFS algorithm pushed each visited node onto a recursion stack and marked it as visited.',
        'As it explored outgoing links, it verified that no connection pointed back to a node currently active on the recursion stack (a "back-edge").',
        'Since no back-edges were found, complex routing metrics or STP blocking are not strictly required to prevent infinite loops.'
      ],
      affected: [],
      algorithm: 'cycleDetection',
      stepIndex: 0,
      vizInput: { departments, cycle: [] },
    })
  }

  // 4b. ACL conflicts — check each device with ACL rules against its peers
  const idToName = new Map(departments.map((d) => [d.id, d.name]))
  // Track finding IDs already generated to avoid symmetric duplicates
  const aclFindingIds = new Set<string>()

  for (const dept of departments) {
    if (!('aclRules' in dept) || !dept.aclRules || dept.aclRules.length === 0) continue
    if (!dept.subnet) continue

    const [deptBaseIp] = dept.subnet.split('/')

    for (const peerId of dept.peers) {
      const peer = departments.find((d) => d.id === peerId)
      if (!peer || !peer.subnet) continue

      const [peerBaseIp] = peer.subnet.split('/')

      // Check dept → peer (generic IP traffic, not just TCP/443)
      const testPacket: AclPacket = {
        protocol: 'ip',
        srcIp: uint32ToIp(ipToUint32(deptBaseIp) + 1),
        dstIp: uint32ToIp(ipToUint32(peerBaseIp) + 1),
      }

      const decision = evaluateAcl(dept.aclRules, testPacket)
      if (decision === 'deny') {
        const matchingRule = findMatchingRule(dept.aclRules, testPacket)
        const ruleSeq = matchingRule?.sequence ?? '?'
        const peerName = idToName.get(peerId) ?? peerId
        const findingId = `correctness_acl_${dept.id}_${peerId}`

        if (!aclFindingIds.has(findingId)) {
          aclFindingIds.add(findingId)
          findings.push({
            id: findingId,
            phase: 'correctness',
            severity: 'yellow',
            title: `ACL on ${dept.name} may block traffic to ${peerName}`,
            detail: `Rule ${ruleSeq} denies IP traffic from ${dept.subnet} to ${peer.subnet}.`,
            fixSteps: [
              `Open ${dept.name} in the Departments tab and review its ACL rules.`,
              `Find rule ${ruleSeq} (the deny rule) and either delete it or move it below a new \`permit ip any\` rule that allows traffic to ${peer.subnet}.`,
              'In a real ACL, the first matching rule wins — make sure a permit appears before any broad deny.',
              'Re-run validation to confirm traffic between these segments is now allowed.',
            ],
            affected: [dept.name, peerName],
            algorithm: 'aclEngine',
            stepIndex: matchingRule ? dept.aclRules.findIndex((r) => r.id === matchingRule.id) : 0,
            vizInput: { departments, aclRules: dept.aclRules, testPacket, matchingRule },
          })
        }
      }

      // Check reverse direction: peer → dept (if peer has ACL rules)
      if (!('aclRules' in peer) || !peer.aclRules || peer.aclRules.length === 0) continue

      const reversePacket: AclPacket = {
        protocol: 'ip',
        srcIp: uint32ToIp(ipToUint32(peerBaseIp) + 1),
        dstIp: uint32ToIp(ipToUint32(deptBaseIp) + 1),
      }

      const reverseDecision = evaluateAcl(peer.aclRules, reversePacket)
      if (reverseDecision === 'deny') {
        const matchingRule = findMatchingRule(peer.aclRules, reversePacket)
        const ruleSeq = matchingRule?.sequence ?? '?'
        const deptName = idToName.get(dept.id) ?? dept.id
        const peerName = idToName.get(peerId) ?? peerId
        // Use a canonical key (smaller id first) to deduplicate symmetric findings
        const canonKey = dept.id < peerId ? `correctness_acl_${dept.id}_${peerId}` : `correctness_acl_${peerId}_${dept.id}`
        const reverseFindingId = `correctness_acl_rev_${peerId}_${dept.id}`

        if (!aclFindingIds.has(reverseFindingId) && !aclFindingIds.has(canonKey)) {
          aclFindingIds.add(reverseFindingId)
          findings.push({
            id: reverseFindingId,
            phase: 'correctness',
            severity: 'yellow',
            title: `ACL on ${peerName} may block traffic to ${deptName}`,
            detail: `Rule ${ruleSeq} denies IP traffic from ${peer.subnet} to ${dept.subnet}.`,
            fixSteps: [
              `Open ${peerName} in the Departments tab and review its ACL rules.`,
              `Find rule ${ruleSeq} (the deny rule) and either delete it or move it below a new \`permit ip any\` rule.`,
              'In a real ACL, the first matching rule wins — make sure a permit appears before any broad deny.',
              'Re-run validation to confirm traffic between these segments is now allowed.',
            ],
            affected: [peerName, deptName],
            algorithm: 'aclEngine',
            stepIndex: matchingRule ? peer.aclRules.findIndex((r) => r.id === matchingRule.id) : 0,
            vizInput: { departments, aclRules: peer.aclRules, testPacket: reversePacket, matchingRule },
          })
        }
      }
    }
  }

  return findings
}

// ─── Phase 5: Optimization ────────────────────────────────────────────────────

export function checkOptimization(config: NetworkConfig, resilienceFindings: Finding[]): Finding[] {
  const { departments } = config
  if (departments.length <= 1) return []

  const findings: Finding[] = []

  // Need a root node for Prim's — use first department
  const rootId = departments[0].id
  const mstResult = findMinimumSpanningTree(departments, rootId)
  if (!mstResult) return findings

  // Build set of MST edge keys (normalised: smaller id first)
  const mstEdgeKeys = new Set<string>()
  for (const edge of mstResult.mstEdges) {
    const a = edge.source < edge.target ? edge.source : edge.target
    const b = edge.source < edge.target ? edge.target : edge.source
    mstEdgeKeys.add(`${a}→${b}`)
  }

  // Find all actual topology edges
  const idToName = new Map(departments.map((d) => [d.id, d.name]))
  const seenEdges = new Set<string>()

  const criticalIds = new Set(
    resilienceFindings
      .filter((f) => f.phase === 'resilience')
      .flatMap((f) => f.affected.slice(0, 1))
      .map((name) => {
        const dept = departments.find((d) => d.name === name)
        return dept?.id ?? ''
      })
      .filter(Boolean)
  )

  for (const dept of departments) {
    for (const peerId of dept.peers) {
      const a = dept.id < peerId ? dept.id : peerId
      const b = dept.id < peerId ? peerId : dept.id
      const key = `${a}→${b}`
      if (seenEdges.has(key)) continue
      seenEdges.add(key)

      if (!mstEdgeKeys.has(key)) {
        // Edge not in MST → potentially redundant
        const nameA = idToName.get(a) ?? a
        const nameB = idToName.get(b) ?? b
        findings.push({
          id: `opt_redundant_${a}_${b}`,
          phase: 'optimization',
          severity: 'blue',
          title: `Link between ${nameA} and ${nameB} may be redundant`,
          detail: 'This connection is not required for full connectivity.',
          fixSteps: [
            'This is informational — the link is safe to keep if you need failover or higher throughput (link aggregation).',
            `If cable or port cost matters, you can safely remove the link between ${nameA} and ${nameB} — all devices will remain connected.`,
            'If you keep it, enable Spanning Tree Protocol (STP) on the connecting switch to prevent broadcast loops from forming.',
          ],
          affected: [nameA, nameB],
          algorithm: 'prims',
          stepIndex: mstResult.mstEdges.length,
          vizInput: { departments, mstEdges: mstResult.mstEdges, rootId },
        })
      }
    }
  }

  // Critical nodes from the resilience phase are already flagged with
  // actionable uplink-addition steps. No additional dead-code check needed here.

  return findings
}

// ─── Score Calculator ─────────────────────────────────────────────────────────

function calcScore(findings: Finding[]): { score: number; label: ValidatePassLabel } {
  const redCount = findings.filter((f) => f.severity === 'red').length
  const yellowCount = findings.filter((f) => f.severity === 'yellow').length
  const raw = 100 - 30 * redCount - 10 * yellowCount
  const score = Math.max(0, Math.min(100, raw))

  const label: ValidatePassLabel =
    score >= 90 ? 'Deploy Ready' : score >= 70 ? 'Deploy with Caution' : 'Not Ready'

  return { score, label }
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function validateNetwork(config: NetworkConfig): Promise<ValidatePassResult> {
  const phasesRan: FindingPhase[] = []
  const allFindings: Finding[] = []

  // Phase 1 — Connectivity (blocks all further phases if RED)
  const connectivityFindings = checkConnectivity(config)
  phasesRan.push('connectivity')
  allFindings.push(...connectivityFindings)

  if (connectivityFindings.some((f) => f.severity === 'red')) {
    const { score, label } = calcScore(allFindings)
    return { score, label, findings: allFindings, ranAt: new Date().toISOString(), phasesRan }
  }

  // Phase 2 — Addressing
  const addressingFindings = checkAddressing(config)
  phasesRan.push('addressing')
  allFindings.push(...addressingFindings)

  // Phase 3 — Resilience
  const resilienceFindings = checkResilience(config)
  phasesRan.push('resilience')
  allFindings.push(...resilienceFindings)

  // Phase 4 — Correctness
  const correctnessFindings = checkCorrectness(config)
  phasesRan.push('correctness')
  allFindings.push(...correctnessFindings)

  // Phase 5 — Optimization (uses resilience results for context)
  const optimizationFindings = checkOptimization(config, resilienceFindings)
  phasesRan.push('optimization')
  allFindings.push(...optimizationFindings)

  const { score, label } = calcScore(allFindings)

  return {
    score,
    label,
    findings: allFindings,
    ranAt: new Date().toISOString(),
    phasesRan,
  }
}
