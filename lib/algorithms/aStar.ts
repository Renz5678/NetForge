// aStar.ts
// Pure function — no side effects, no imports from stores or UI.
// Input: Department[], sourceId: string, targetId: string,
//        nodePositions: Map<string, { x: number; y: number }>
// Output: PathResult | null (null = no path exists)
// Method: A* search using Euclidean distance to target as heuristic.
//         g(n) = actual cost from source (hop count, weight = 1).
//         h(n) = Euclidean distance from n to target (admissible, never overestimates).
//         f(n) = g(n) + h(n) — priority in the open set min-heap.
// Treats edges as directed (respects communication rules, same as Dijkstra).

import type { Department, PathResult } from '@/types'
import { MinHeap } from '@/lib/dataStructures/MinHeap'

type HeapNode = {
  id: string
  f: number // f = g + h (total estimated cost)
  g: number // g = actual cost from source
}




// Euclidean distance heuristic between two node positions.
// Admissible: never overestimates since actual edge weight = 1 hop,
// and Euclidean distance in canvas-space is a consistent lower bound
// when node spacing approximates hop distance.
function euclideanHeuristic(
  nodeId: string,
  targetId: string,
  positions: Map<string, { x: number; y: number }>
): number {
  const a = positions.get(nodeId)
  const b = positions.get(targetId)
  if (!a || !b) return 0
  const dx = b.x - a.x
  const dy = b.y - a.y
  // Normalize to hop-count scale: assume ~120px average node spacing (d3-force link distance).
  // This keeps h(n) in the same unit space as g(n) = hop count.
  return Math.sqrt(dx * dx + dy * dy) / 120
}

export function findShortestPathAStar(
  departments: Department[],
  sourceId: string,
  targetId: string,
  nodePositions: Map<string, { x: number; y: number }>
): PathResult | null {
  if (departments.length === 0) return null
  if (sourceId === targetId) return { path: [sourceId], hops: 0 }

  // Build undirected adjacency list (respects physical link bidirectionality)
  const adj = new Map<string, string[]>()
  const idSet = new Set(departments.map((d) => d.id))

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

  // A* initialization
  const gScore = new Map<string, number>() // actual cost from source
  const prev = new Map<string, string | null>()
  const closed = new Set<string>() // settled nodes

  for (const dept of departments) {
    gScore.set(dept.id, Infinity)
    prev.set(dept.id, null)
  }

  if (!gScore.has(sourceId) || !gScore.has(targetId)) return null

  gScore.set(sourceId, 0)
  const h0 = euclideanHeuristic(sourceId, targetId, nodePositions)

  const openSet = new MinHeap<HeapNode>((a, b) => a.f - b.f)
  openSet.push({ id: sourceId, f: h0, g: 0 })

  while (openSet.size > 0) {
    const current = openSet.pop()!

    if (current.id === targetId) break
    if (closed.has(current.id)) continue

    // Skip stale heap entries (g-score was improved since this entry was pushed)
    if (current.g > (gScore.get(current.id) ?? Infinity)) continue

    closed.add(current.id)

    for (const neighbor of adj.get(current.id) ?? []) {
      if (closed.has(neighbor)) continue

      const tentativeG = current.g + 1 // edge weight = 1 hop
      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        gScore.set(neighbor, tentativeG)
        prev.set(neighbor, current.id)
        const h = euclideanHeuristic(neighbor, targetId, nodePositions)
        openSet.push({ id: neighbor, f: tentativeG + h, g: tentativeG })
      }
    }
  }

  // No path found
  const finalG = gScore.get(targetId)
  if (finalG === undefined || finalG === Infinity) return null

  // Reconstruct path from predecessor map
  const path: string[] = []
  let node: string | null = targetId

  while (node !== null) {
    path.push(node)
    node = prev.get(node) ?? null
  }

  path.reverse()

  // Verify path starts at source
  if (path[0] !== sourceId) return null

  return {
    path,
    hops: path.length - 1,
  }
}
