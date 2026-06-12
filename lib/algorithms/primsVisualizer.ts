// primsVisualizer.ts
// Pure function — no side effects, no imports from stores or UI.
// Input: Department[], rootId: string, edgeWeights?: Map<string, number>
// Output: PrimsVisualizationResult with pre-computed step snapshots.
// Method: Runs Prim's MST algorithm and records the full cut state at each step:
//         which nodes are in the MST, which crossing edges are candidates,
//         and which edge is being accepted.
// Framing: "Optimal Wiring" — minimum cables to connect all nodes at lowest cost.

import type { Department, VisualizationStep, NodeVizState, MSTEdge } from '@/types'
import { MinHeap } from '@/lib/dataStructures/MinHeap'

export type PrimsVisualizationResult = {
  steps: VisualizationStep[]
  mstEdges: MSTEdge[]
  totalCost: number
  orderedNodes: string[]
}

type HeapEntry = {
  nodeId: string
  cost: number
  fromId: string | null
}




function getEdgeWeight(
  srcId: string,
  targetId: string,
  edgeWeights?: Map<string, number>
): number {
  if (!edgeWeights) return 1
  return (
    edgeWeights.get(`${srcId}\u2192${targetId}`) ??
    edgeWeights.get(`${targetId}\u2192${srcId}`) ??
    1
  )
}

export function buildPrimsSteps(
  departments: Department[],
  rootId: string,
  edgeWeights?: Map<string, number>
): PrimsVisualizationResult {
  const steps: VisualizationStep[] = []

  if (departments.length === 0) {
    return { steps, mstEdges: [], totalCost: 0, orderedNodes: [] }
  }

  const names = new Map(departments.map((d) => [d.id, d.name]))
  const idSet = new Set(departments.map((d) => d.id))

  function lbl(id: string): string {
    return `"${names.get(id) ?? id}"`
  }

  // Build undirected adjacency list
  const adj = new Map<string, string[]>()
  for (const dept of departments) {
    if (!adj.has(dept.id)) adj.set(dept.id, [])
  }
  for (const dept of departments) {
    for (const peerId of dept.peers) {
      if (!idSet.has(peerId)) continue
      adj.get(dept.id)!.push(peerId)
      if (!adj.get(peerId)!.includes(dept.id)) {
        adj.get(peerId)!.push(dept.id)
      }
    }
  }

  const inMST = new Set<string>()
  const mstEdges: MSTEdge[] = []
  const orderedNodes: string[] = []
  let totalCost = 0

  function snapshotStates(frontier: Set<string>, highlightNode?: string): Record<string, NodeVizState> {
    const states: Record<string, NodeVizState> = {}
    for (const dept of departments) {
      if (inMST.has(dept.id)) states[dept.id] = 'mstIncluded'
      else if (frontier.has(dept.id)) states[dept.id] = 'mstFrontier'
      else states[dept.id] = 'unvisited'
    }
    return states
  }

  // Seed from root
  inMST.add(rootId)
  orderedNodes.push(rootId)

  const heap = new MinHeap<HeapEntry>((a, b) => a.cost - b.cost)
  const frontier = new Set<string>()

  for (const neighbor of adj.get(rootId) ?? []) {
    if (idSet.has(neighbor) && !inMST.has(neighbor)) {
      const w = getEdgeWeight(rootId, neighbor, edgeWeights)
      heap.push({ nodeId: neighbor, cost: w, fromId: rootId })
      frontier.add(neighbor)
    }
  }

  steps.push({
    stepIndex: 0,
    explanation: `Starting Optimal Wiring from ${lbl(rootId)}. This node is now in the MST (green). We see ${frontier.size} reachable neighbor${frontier.size !== 1 ? 's' : ''} on the frontier (yellow). The cheapest crossing edge will be added next.`,
    hint: `Initialize the Minimum Spanning Tree from the root segment and add all adjacent outgoing links to the frontier.`,
    nodeStates: snapshotStates(frontier),
    mstEdges: [],
    mstCost: 0,
    candidateEdges: heap.getCandidates((e) => e.nodeId).map((e) => ({ source: e.fromId ?? '', target: e.nodeId, weight: e.cost })),
    currentNode: rootId,
  })

  while (heap.size > 0 && inMST.size < departments.length) {
    const entry = heap.pop()!

    if (inMST.has(entry.nodeId)) {
      // Stale entry
      steps.push({
        stepIndex: steps.length,
        explanation: `Considered adding ${lbl(entry.nodeId)} via ${lbl(entry.fromId ?? '')} (cost ${entry.cost}), but it's already in the MST. Skipping this crossing edge.`,
        hint: `We ignore this link because the node it connects to has already been absorbed into the spanning tree.`,
        nodeStates: snapshotStates(frontier),
        mstEdges: [...mstEdges],
        mstCost: totalCost,
        candidateEdges: heap.getCandidates((e) => e.nodeId).map((e) => ({ source: e.fromId ?? '', target: e.nodeId, weight: e.cost })),
      })
      continue
    }

    // Accept this edge
    inMST.add(entry.nodeId)
    frontier.delete(entry.nodeId)
    orderedNodes.push(entry.nodeId)
    totalCost += entry.cost

    if (entry.fromId !== null) {
      mstEdges.push({ source: entry.fromId, target: entry.nodeId, weight: entry.cost })
    }

    // Explore new neighbors from this node
    const newNeighbors: string[] = []
    for (const neighbor of adj.get(entry.nodeId) ?? []) {
      if (!inMST.has(neighbor) && idSet.has(neighbor)) {
        const w = getEdgeWeight(entry.nodeId, neighbor, edgeWeights)
        heap.push({ nodeId: neighbor, cost: w, fromId: entry.nodeId })
        if (!frontier.has(neighbor)) {
          frontier.add(neighbor)
          newNeighbors.push(neighbor)
        }
      }
    }

    const baseExp = `Adding ${lbl(entry.nodeId)} to the MST via the cheapest crossing edge from ${lbl(entry.fromId ?? '')} (cost ${entry.cost}). Running total: ${totalCost} hop${totalCost !== 1 ? 's' : ''}.`
    const frontierExp = newNeighbors.length > 0
      ? ` Revealed ${newNeighbors.length} new frontier node${newNeighbors.length !== 1 ? 's' : ''}: ${newNeighbors.map(lbl).join(', ')}.`
      : ''

    steps.push({
      stepIndex: steps.length,
      explanation: baseExp + frontierExp,
      hint: `We select the cheapest link on the frontier to connect a new node, then add its neighbors to expand the frontier.`,
      nodeStates: snapshotStates(frontier, entry.nodeId),
      mstEdges: [...mstEdges],
      mstCost: totalCost,
      currentEdge: { source: entry.fromId ?? '', target: entry.nodeId, weight: entry.cost },
      candidateEdges: heap.getCandidates((e) => e.nodeId).map((e) => ({ source: e.fromId ?? '', target: e.nodeId, weight: e.cost })),
      currentNode: entry.nodeId,
    })
  }

  // Final step
  const isComplete = inMST.size === departments.length
  steps.push({
    stepIndex: steps.length,
    explanation: isComplete
      ? `Optimal Wiring complete! The MST uses ${mstEdges.length} cable${mstEdges.length !== 1 ? 's' : ''} with a total cost of ${totalCost} hop${totalCost !== 1 ? 's' : ''}. This is the minimum number of links needed to keep all ${departments.length} nodes connected.`
      : `Wiring stopped — only ${inMST.size} of ${departments.length} nodes are connected. The remaining nodes may be in a disconnected subgraph.`,
    hint: `All nodes are connected in a loop-free tree using the minimum total path weight.`,
    nodeStates: snapshotStates(new Set()),
    mstEdges: [...mstEdges],
    mstCost: totalCost,
    candidateEdges: [],
  })

  return { steps, mstEdges, totalCost, orderedNodes }
}
