// isolationVisualizer.ts
// Step-builder for connectivity / isolation diagnostic visualization.
// BFS-explores the graph from each connected component and marks nodes that
// are never reached (isolated) with the 'cycle' viz state so they pulse red.
//
// algorithm never re-runs per frame.

import type { NetworkNode, VisualizationStep, NodeVizState } from '@/types'

export type IsolationVisualizationResult = {
  steps: VisualizationStep[]
  isolatedNodeIds: string[]
  componentCount: number
}

export function buildIsolationSteps(
  departments: NetworkNode[]
): IsolationVisualizationResult {
  const steps: VisualizationStep[] = []

  if (departments.length === 0) {
    return { steps, isolatedNodeIds: [], componentCount: 0 }
  }

  const names = new Map(departments.map((d) => [d.id, d.name]))
  const idSet  = new Set(departments.map((d) => d.id))

  function lbl(id: string) { return `"${names.get(id) ?? id}"` }

  // Build undirected adjacency
  const adj = new Map<string, Set<string>>()
  for (const dept of departments) {
    if (!adj.has(dept.id)) adj.set(dept.id, new Set())
    for (const peer of dept.peers) {
      if (!idSet.has(peer)) continue
      adj.get(dept.id)!.add(peer)
      if (!adj.has(peer)) adj.set(peer, new Set())
      adj.get(peer)!.add(dept.id)
    }
  }

  // Node states helper
  type VisitState = 'unvisited' | 'inQueue' | 'settled' | 'isolated'
  const visitState = new Map<string, VisitState>()
  for (const d of departments) visitState.set(d.id, 'unvisited')

  function snapshot(extra?: Map<string, NodeVizState>): Record<string, NodeVizState> {
    const out: Record<string, NodeVizState> = {}
    for (const d of departments) {
      const ov = extra?.get(d.id)
      if (ov) { out[d.id] = ov; continue }
      const s = visitState.get(d.id)!
      if (s === 'unvisited') out[d.id] = 'unvisited'
      else if (s === 'inQueue') out[d.id] = 'inQueue'
      else if (s === 'settled') out[d.id] = 'settled'
      else out[d.id] = 'cycle'   // isolated → red pulse
    }
    return out
  }

  // Step 0 — init
  steps.push({
    stepIndex: 0,
    explanation: `Checking connectivity. All ${departments.length} node${departments.length !== 1 ? 's' : ''} start unvisited. BFS will sweep each component to find isolated nodes.`,
    hint: 'BFS floods outward from each reachable node. Any node never reached is isolated.',
    networkingContext: 'An isolated node has no path to any peer — its traffic cannot leave.',
    nodeStates: snapshot(),
  })

  const allVisited = new Set<string>()
  let componentCount = 0

  for (const dept of departments) {
    if (allVisited.has(dept.id)) continue

    // No peers at all → immediately isolated
    const hasAnyPeer = (adj.get(dept.id)?.size ?? 0) > 0
    if (!hasAnyPeer) {
      visitState.set(dept.id, 'isolated')
      steps.push({
        stepIndex: steps.length,
        explanation: `${lbl(dept.id)} has no connections — it is isolated. Packets sent to or from this node will be dropped.`,
        hint: 'A device with zero peers cannot participate in any network path.',
        networkingContext: `In a real network, ${names.get(dept.id)} has no uplink — it is effectively offline.`,
        nodeStates: snapshot(),
      })
      continue
    }

    // BFS from this node
    componentCount++
    const queue: string[] = [dept.id]
    visitState.set(dept.id, 'inQueue')
    allVisited.add(dept.id)

    steps.push({
      stepIndex: steps.length,
      explanation: `Starting BFS from ${lbl(dept.id)} — component #${componentCount}. Flooding outward via peer connections.`,
      hint: 'BFS explores all reachable nodes level by level.',
      networkingContext: `${names.get(dept.id)} is the BFS root for this network segment.`,
      nodeStates: snapshot(),
    })

    while (queue.length > 0) {
      const current = queue.shift()!
      visitState.set(current, 'settled')

      const neighbors = [...(adj.get(current) ?? [])]
      const unvisited = neighbors.filter((n) => !allVisited.has(n))

      if (unvisited.length > 0) {
        steps.push({
          stepIndex: steps.length,
          explanation: `Settled ${lbl(current)}. Enqueueing ${unvisited.length} unvisited neighbor${unvisited.length !== 1 ? 's' : ''}: ${unvisited.map(lbl).join(', ')}.`,
          hint: 'BFS marks reachable nodes as visited so they are not double-counted.',
          nodeStates: snapshot(),
        })
        for (const n of unvisited) {
          visitState.set(n, 'inQueue')
          allVisited.add(n)
          queue.push(n)
        }
      } else {
        steps.push({
          stepIndex: steps.length,
          explanation: `Settled ${lbl(current)} — all neighbors already visited or none exist.`,
          hint: 'No new nodes discovered from this node.',
          nodeStates: snapshot(),
        })
      }
    }
  }

  // Mark any remaining unvisited as isolated (shouldn't normally happen, but safety net)
  const isolatedNodeIds: string[] = []
  for (const d of departments) {
    if (visitState.get(d.id) === 'unvisited') {
      visitState.set(d.id, 'isolated')
      isolatedNodeIds.push(d.id)
    }
    if (visitState.get(d.id) === 'isolated') {
      if (!isolatedNodeIds.includes(d.id)) isolatedNodeIds.push(d.id)
    }
  }

  // Final step
  const hasSingleComponent = componentCount === 1 && isolatedNodeIds.length === 0
  steps.push({
    stepIndex: steps.length,
    explanation: hasSingleComponent
      ? `All ${departments.length} nodes are connected in a single component. No isolated devices found.`
      : `BFS complete. Found ${componentCount} separate component${componentCount !== 1 ? 's' : ''}${isolatedNodeIds.length > 0 ? ` and ${isolatedNodeIds.length} isolated node${isolatedNodeIds.length !== 1 ? 's' : ''}` : ''}. Highlighted nodes are unreachable from the rest of the network.`,
    hint: isolatedNodeIds.length > 0
      ? 'Add at least one peer connection to each isolated node to restore reachability.'
      : 'Network is fully connected.',
    networkingContext: isolatedNodeIds.length > 0
      ? `Isolated devices: ${isolatedNodeIds.map((id) => names.get(id) ?? id).join(', ')}. These nodes cannot exchange traffic with the rest of the topology.`
      : 'All devices can reach each other via at least one path.',
    nodeStates: snapshot(),
    impactSummary: {
      whatHappened: isolatedNodeIds.length > 0
        ? `${isolatedNodeIds.length} node${isolatedNodeIds.length !== 1 ? 's are' : ' is'} completely unreachable.`
        : 'All nodes are reachable.',
      whyItMatters: isolatedNodeIds.length > 0
        ? 'Isolated nodes cannot send or receive any traffic — they are effectively offline.'
        : 'A fully connected graph ensures all devices can communicate.',
      behindTheScenes: `BFS explored ${departments.length} nodes across ${componentCount} component${componentCount !== 1 ? 's' : ''}.`,
    },
  })

  return { steps, isolatedNodeIds, componentCount }
}
