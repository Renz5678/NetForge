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
import { detectCycles } from '@/lib/algorithms/cycleDetection'
import { evaluateAcl, findMatchingRule } from '@/lib/algorithms/aclEngine'
import type { AclPacket } from '@/lib/algorithms/aclEngine'
import { findMinimumSpanningTree } from '@/lib/algorithms/prims'
import { ipToUint32, uint32ToIp, cidrToMask } from '@/lib/ipUtils'
import type { NetworkConfig, Department } from '@/types'

// ─── Result Types ─────────────────────────────────────────────────────────────

export type FindingSeverity = 'red' | 'yellow' | 'blue'

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

// ─── Phase 1: Connectivity ────────────────────────────────────────────────────

export function checkConnectivity(config: NetworkConfig): Finding[] {
  const { departments } = config
  if (departments.length <= 1) return []

  const { allReachable, isolated } = validateConnectivity(departments)
  if (allReachable) return []

  return [
    {
      id: 'connectivity_isolated',
      phase: 'connectivity',
      severity: 'red',
      title: 'Network is not fully connected',
      detail: 'These devices have no path to the rest of the network.',
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
      affected: unassigned.map((d) => d.name),
      algorithm: 'vlsmCalculator',
      stepIndex: 0,
      vizInput: { departments, baseIp },
    })
  }

  // 2c. Address space capacity check (near capacity >90%)
  const assigned = departments.filter((d) => d.cidrPrefix !== undefined)
  if (assigned.length > 0 && baseIp) {
    try {
      const totalRequired = assigned.reduce((sum, d) => {
        const blockSize = Math.pow(2, 32 - (d.cidrPrefix ?? 30))
        return sum + blockSize
      }, 0)
      // Use /16 as default parent for capacity check
      const parentBlockSize = Math.pow(2, 32 - 16)
      const utilizationPct = (totalRequired / parentBlockSize) * 100
      if (utilizationPct > 90) {
        findings.push({
          id: 'addr_near_capacity',
          phase: 'addressing',
          severity: 'yellow',
          title: 'Address space is nearly full',
          detail: `Allocated subnets consume over 90% of the parent address block. Adding new devices may fail.`,
          affected: [],
          algorithm: 'vlsmCalculator',
          stepIndex: 0,
          vizInput: { departments, baseIp, utilizationPct },
        })
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

  if (result.articulationPoints.length === 0) return findings

  const idToName = new Map(departments.map((d) => [d.id, d.name]))
  const idToDept = new Map(departments.map((d) => [d.id, d]))

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
      severity: 'yellow',
      title: `${apName} is a single point of failure`,
      detail: `Removing it would isolate ${isolatedHostCount} hosts across ${isolatedNodes.length} department${isolatedNodes.length !== 1 ? 's' : ''}.`,
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
      affected: cycleResult.cycle,
      algorithm: 'cycleDetection',
      stepIndex: 0,
      vizInput: { departments, cycle: cycleResult.cycle },
    })
  }

  // 4b. ACL conflicts — check each device with ACL rules against its peers
  const idToName = new Map(departments.map((d) => [d.id, d.name]))

  for (const dept of departments) {
    if (!dept.aclRules || dept.aclRules.length === 0) continue
    if (!dept.subnet) continue

    const [deptBaseIp] = dept.subnet.split('/')

    for (const peerId of dept.peers) {
      const peer = departments.find((d) => d.id === peerId)
      if (!peer || !peer.subnet) continue

      const [peerBaseIp, peerPrefixStr] = peer.subnet.split('/')
      const peerPrefix = parseInt(peerPrefixStr, 10)

      // Generate a test packet: dept → peer, TCP port 443
      const testPacket: AclPacket = {
        protocol: 'tcp',
        srcIp: uint32ToIp(ipToUint32(deptBaseIp) + 1),
        dstIp: uint32ToIp(ipToUint32(peerBaseIp) + 1),
        dstPort: 443,
      }

      const decision = evaluateAcl(dept.aclRules, testPacket)
      if (decision === 'deny') {
        const matchingRule = findMatchingRule(dept.aclRules, testPacket)
        const ruleSeq = matchingRule?.sequence ?? '?'
        const peerName = idToName.get(peerId) ?? peerId

        findings.push({
          id: `correctness_acl_${dept.id}_${peerId}`,
          phase: 'correctness',
          severity: 'yellow',
          title: `ACL on ${dept.name} may block traffic to ${peerName}`,
          detail: `Rule ${ruleSeq} denies TCP from ${dept.subnet} to ${peer.subnet}.`,
          affected: [dept.name, peerName],
          algorithm: 'aclEngine',
          stepIndex: matchingRule ? dept.aclRules.findIndex((r) => r.id === matchingRule.id) : 0,
          vizInput: { departments, aclRules: dept.aclRules, testPacket, matchingRule },
        })
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
          affected: [nameA, nameB],
          algorithm: 'prims',
          stepIndex: mstResult.mstEdges.length,
          vizInput: { departments, mstEdges: mstResult.mstEdges, rootId },
        })
      }
    }
  }

  // Check critical nodes (from resilience phase) that have no redundant path in MST
  for (const apFinding of resilienceFindings) {
    const apName = apFinding.affected[0]
    const apDept = departments.find((d) => d.name === apName)
    if (!apDept) continue

    const normalizedKey1 = `${apDept.id}`
    // If this node appears in MST exactly once (single path), flag it
    const mstEdgeCount = mstResult.mstEdges.filter(
      (e) => e.source === apDept.id || e.target === apDept.id
    ).length

    if (mstEdgeCount <= 1) {
      findings.push({
        id: `opt_no_redundant_path_${apDept.id}`,
        phase: 'optimization',
        severity: 'blue',
        title: `No redundant path exists for ${apName}`,
        detail: 'Adding a second uplink would eliminate this single point of failure.',
        affected: [apName],
        algorithm: 'prims',
        stepIndex: mstResult.mstEdges.length,
        vizInput: { departments, mstEdges: mstResult.mstEdges, rootId },
      })
    }
  }

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
