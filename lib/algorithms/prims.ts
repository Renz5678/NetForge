// prims.ts
// Pure function — no side effects, no imports from stores or UI.
// Input: Department[], rootId: string (user-selected start node),
//        edgeWeights?: Map<string, number> (keyed as "srcId→targetId" for weighted edges)
// Output: PrimsResult | null (null = graph is empty or rootId not found)
// Method: Prim's algorithm using a min-heap priority queue.
//         Treats all peer edges as undirected (A→B and B→A share the same physical link).
//         Edge weight falls back to 1 (hop count) when no explicit weight is provided.
// Framing: "Optimal Wiring" — the minimum set of cables needed to connect all nodes
//           at the lowest total cost.

import type { Department, PrimsResult, MSTEdge } from '@/types'

type HeapEntry = {
  nodeId: string      // node being connected into MST
  cost: number        // weight of the cheapest edge connecting this node to MST
  fromId: string | null // which MST node this edge comes from (null for root)
}

class MinHeap {
  private heap: HeapEntry[] = []

  push(entry: HeapEntry): void {
    this.heap.push(entry)
    this._bubbleUp(this.heap.length - 1)
  }

  pop(): HeapEntry | undefined {
    if (this.heap.length === 0) return undefined
    const top = this.heap[0]
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      this._sinkDown(0)
    }
    return top
  }

  get size(): number {
    return this.heap.length
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2)
      if (this.heap[parent].cost <= this.heap[i].cost) break
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
      if (left < n && this.heap[left].cost < this.heap[smallest].cost) smallest = left
      if (right < n && this.heap[right].cost < this.heap[smallest].cost) smallest = right
      if (smallest === i) break
      ;[this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]]
      i = smallest
    }
  }
}

// Resolve edge weight for a given (src, target) pair.
// Checks both directions since the topology model is directed but
// physical wiring is undirected for MST purposes.
function getEdgeWeight(
  srcId: string,
  targetId: string,
  edgeWeights?: Map<string, number>
): number {
  if (!edgeWeights) return 1
  return (
    edgeWeights.get(`${srcId}→${targetId}`) ??
    edgeWeights.get(`${targetId}→${srcId}`) ??
    1
  )
}

export function findMinimumSpanningTree(
  departments: Department[],
  rootId: string,
  edgeWeights?: Map<string, number>
): PrimsResult | null {
  if (departments.length === 0) return null

  const idSet = new Set(departments.map((d) => d.id))
  if (!idSet.has(rootId)) return null

  if (departments.length === 1) {
    return { mstEdges: [], totalCost: 0, orderedNodes: [rootId] }
  }

  // Build undirected adjacency list: collect peers from both directions
  const adj = new Map<string, string[]>()
  for (const dept of departments) {
    if (!adj.has(dept.id)) adj.set(dept.id, [])
  }
  for (const dept of departments) {
    for (const peerId of dept.peers) {
      if (!idSet.has(peerId)) continue
      // Add both directions for undirected traversal
      adj.get(dept.id)!.push(peerId)
      if (!adj.get(peerId)!.includes(dept.id)) {
        adj.get(peerId)!.push(dept.id)
      }
    }
  }

  // Prim's initialization
  const inMST = new Set<string>()
  const mstEdges: MSTEdge[] = []
  const orderedNodes: string[] = []
  let totalCost = 0

  // Seed the heap from the root node
  inMST.add(rootId)
  orderedNodes.push(rootId)

  const heap = new MinHeap()

  for (const neighbor of adj.get(rootId) ?? []) {
    if (idSet.has(neighbor)) {
      heap.push({
        nodeId: neighbor,
        cost: getEdgeWeight(rootId, neighbor, edgeWeights),
        fromId: rootId,
      })
    }
  }

  // Grow the MST
  while (heap.size > 0 && inMST.size < departments.length) {
    const entry = heap.pop()!

    // Skip if this node was already absorbed into the MST (stale heap entry)
    if (inMST.has(entry.nodeId)) continue

    // Accept this edge — cheapest crossing edge into the MST
    inMST.add(entry.nodeId)
    orderedNodes.push(entry.nodeId)
    totalCost += entry.cost

    if (entry.fromId !== null) {
      mstEdges.push({
        source: entry.fromId,
        target: entry.nodeId,
        weight: entry.cost,
      })
    }

    // Explore neighbors of the newly added node
    for (const neighbor of adj.get(entry.nodeId) ?? []) {
      if (!inMST.has(neighbor) && idSet.has(neighbor)) {
        heap.push({
          nodeId: neighbor,
          cost: getEdgeWeight(entry.nodeId, neighbor, edgeWeights),
          fromId: entry.nodeId,
        })
      }
    }
  }

  return {
    mstEdges,
    totalCost,
    orderedNodes,
  }
}
