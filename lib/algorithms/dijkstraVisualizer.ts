// dijkstraVisualizer.ts
// Pure function — no side effects, no imports from stores or UI.
// Input: Department[], sourceId: string, targetId: string,
//        nodePositions: Map<string, { x: number; y: number }> (for A* comparison data)
// Output: DijkstraVisualizationResult containing a pre-computed step snapshot array.
// Method: Runs Dijkstra once and records every decision into VisualizationStep[].
//         The UI replays this array — the algorithm is never re-run per animation frame.

import type { Department, VisualizationStep, NodeVizState, PathResult } from '@/types'

export type DijkstraVisualizationResult = {
  steps: VisualizationStep[]
  finalPath: PathResult | null
  visitedNodeIds: Set<string> // All nodes Dijkstra settled (for A* comparison)
}

type HeapNode = { id: string; dist: number }

class MinHeap {
  private heap: HeapNode[] = []

  push(node: HeapNode): void {
    this.heap.push(node)
    this._bubbleUp(this.heap.length - 1)
  }

  pop(): HeapNode | undefined {
    if (this.heap.length === 0) return undefined
    const top = this.heap[0]
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      this._sinkDown(0)
    }
    return top
  }

  get size(): number { return this.heap.length }
  get contents(): HeapNode[] { return [...this.heap].sort((a, b) => a.dist - b.dist) }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2)
      if (this.heap[parent].dist <= this.heap[i].dist) break
      ;[this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]]
      i = parent
    }
  }

  private _sinkDown(i: number): void {
    const n = this.heap.length
    while (true) {
      let smallest = i
      const left = 2 * i + 1
      const right = 2 * i + 2
      if (left < n && this.heap[left].dist < this.heap[smallest].dist) smallest = left
      if (right < n && this.heap[right].dist < this.heap[smallest].dist) smallest = right
      if (smallest === i) break
      ;[this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]]
      i = smallest
    }
  }
}

// Returns a label for a node ID, falling back to the raw ID.
function label(id: string, names: Map<string, string>): string {
  return names.get(id) ?? id
}

function distStr(d: number): string {
  return d === Infinity ? '∞' : String(d)
}

export function buildDijkstraSteps(
  departments: Department[],
  sourceId: string,
  targetId: string
): DijkstraVisualizationResult {
  const steps: VisualizationStep[] = []
  const visitedNodeIds = new Set<string>()

  if (departments.length === 0) {
    return { steps, finalPath: null, visitedNodeIds }
  }

  const names = new Map(departments.map((d) => [d.id, d.name]))
  const idSet = new Set(departments.map((d) => d.id))

  // Build undirected adjacency list (respects physical link bidirectionality)
  const adj = new Map<string, string[]>()
  for (const dept of departments) {
    adj.set(dept.id, [])
  }

  for (const dept of departments) {
    for (const peerId of dept.peers) {
      if (!idSet.has(peerId)) continue
      if (!adj.get(dept.id)!.includes(peerId)) {
        adj.get(dept.id)!.push(peerId)
      }
      if (!adj.get(peerId)!.includes(dept.id)) {
        adj.get(peerId)!.push(dept.id)
      }
    }
  }

  const dist = new Map<string, number>()
  const prev = new Map<string, string | null>()

  for (const dept of departments) {
    dist.set(dept.id, Infinity)
    prev.set(dept.id, null)
  }

  if (!dist.has(sourceId) || !dist.has(targetId)) {
    return { steps, finalPath: null, visitedNodeIds }
  }

  dist.set(sourceId, 0)
  const heap = new MinHeap()
  heap.push({ id: sourceId, dist: 0 })

  // Helper to snapshot all node states
  const snapshotNodeStates = (
    settled: Set<string>,
    inQueue: Set<string>,
    pathNodes?: Set<string>
  ): Record<string, NodeVizState> => {
    const states: Record<string, NodeVizState> = {}
    for (const dept of departments) {
      if (pathNodes?.has(dept.id)) states[dept.id] = 'path'
      else if (settled.has(dept.id)) states[dept.id] = 'settled'
      else if (inQueue.has(dept.id)) states[dept.id] = 'inQueue'
      else states[dept.id] = 'unvisited'
    }
    return states
  }

  const settled = new Set<string>()
  const inQueue = new Set<string>([sourceId])

  // Step 0: Initialization
  steps.push({
    stepIndex: 0,
    explanation: `Starting route analysis from "${label(sourceId, names)}" to "${label(targetId, names)}". Setting source cost to 0 — all other devices start at unknown (\u221e). This is how OSPF begins calculating next-hops.`,
    networkingContext: `Source: ${label(sourceId, names)} → Destination: ${label(targetId, names)}`,
    hint: `Just like a real router calculating OSPF routes, we start from the source device and fan out to discover the cheapest path to every other device.`,
    storyPhase: 'before',
    nodeStates: snapshotNodeStates(settled, inQueue),
    priorityQueue: heap.contents.map((n) => ({ id: n.id, dist: n.dist })),
    distances: Object.fromEntries(dist),
    currentNode: sourceId,
  })

  while (heap.size > 0) {
    const current = heap.pop()!

    // Skip stale entries
    if (current.dist > (dist.get(current.id) ?? Infinity)) continue

    settled.add(current.id)
    inQueue.delete(current.id)
    visitedNodeIds.add(current.id)

    if (current.id === targetId) {
      steps.push({
        stepIndex: steps.length,
        explanation: `Reached "${label(targetId, names)}"! Route confirmed with a total cost of ${distStr(dist.get(targetId) ?? Infinity)}. This is the lowest-cost path — the same result OSPF would have selected.`,
        hint: `Because we always process the lowest-cost device first, the first time we reach the destination it is guaranteed to be via the optimal route.`,
        storyPhase: 'during',
        nodeStates: snapshotNodeStates(settled, inQueue),
        priorityQueue: heap.contents.map((n) => ({ id: n.id, dist: n.dist })),
        distances: Object.fromEntries(dist),
        currentNode: current.id,
      })
      break
    }

    const neighbors = adj.get(current.id) ?? []
    const updatedNeighbors: string[] = []

    for (const neighbor of neighbors) {
      const newDist = current.dist + 1
      if (newDist < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, newDist)
        prev.set(neighbor, current.id)
        heap.push({ id: neighbor, dist: newDist })
        inQueue.add(neighbor)
        updatedNeighbors.push(label(neighbor, names))
      }
    }

    const explanation = updatedNeighbors.length > 0
      ? `Evaluating links from "${label(current.id, names)}" (path cost: ${distStr(current.dist)}). Updated route cost to: ${updatedNeighbors.join(', ')}.`
      : `Checked all links from "${label(current.id, names)}" (path cost: ${distStr(current.dist)}). No cheaper routes found through this device.`

    steps.push({
      stepIndex: steps.length,
      explanation,
      hint: `A real router checks all its neighbors and picks the best next-hop. NetForge does the same — updating a device's cost only if a cheaper path is found through the current device.`,
      storyPhase: 'during',
      nodeStates: snapshotNodeStates(settled, inQueue),
      priorityQueue: heap.contents.map((n) => ({ id: n.id, dist: n.dist })),
      distances: Object.fromEntries(dist),
      currentNode: current.id,
    })
  }

  // Reconstruct final path
  const finalDist = dist.get(targetId)
  if (finalDist === undefined || finalDist === Infinity) {
    steps.push({
      stepIndex: steps.length,
      explanation: `No route exists from "${label(sourceId, names)}" to "${label(targetId, names)}". All reachable devices were checked and the destination was never reached. In a real network, this means there is no configured path between these devices.`,
      hint: `Check whether the devices are connected through any shared path in the topology.`,
      storyPhase: 'after',
      nodeStates: snapshotNodeStates(settled, inQueue),
      distances: Object.fromEntries(dist),
    })
    return { steps, finalPath: null, visitedNodeIds }
  }

  const path: string[] = []
  let node: string | null = targetId
  while (node !== null) {
    path.push(node)
    node = prev.get(node) ?? null
  }
  path.reverse()

  if (path[0] !== sourceId) {
    return { steps, finalPath: null, visitedNodeIds }
  }

  const pathSet = new Set(path)

  // Final step: show the path
  steps.push({
    stepIndex: steps.length,
    explanation: `Best route found: ${path.map((id) => `"${label(id, names)}"`).join(' \u2192 ')} — ${path.length - 1} hop${path.length - 1 !== 1 ? 's' : ''}. This is the same route OSPF would select. Highlighted in blue on the topology.`,
    hint: `The path is reconstructed by tracing back from the destination to the source using the predecessor map built during route analysis.`,
    storyPhase: 'after',
    nodeStates: snapshotNodeStates(settled, new Set(), pathSet),
    distances: Object.fromEntries(dist),
  })

  return {
    steps,
    finalPath: { path, hops: path.length - 1 },
    visitedNodeIds,
  }
}
