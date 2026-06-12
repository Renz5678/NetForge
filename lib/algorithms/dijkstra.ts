// dijkstra.ts
// Pure function — no side effects.
// Method: Min-heap Dijkstra, edge weight = 1 (hop count)
// Treats edges as directed (respects communication rules)

import type { NetworkNode, PathResult } from '@/types'
import { MinHeap } from '@/lib/dataStructures/MinHeap'

type HeapNode = {
  id: string
  dist: number
}



export function findShortestPath(
  departments: NetworkNode[],
  sourceId: string,
  targetId: string
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

  // Dijkstra initialization
  const dist = new Map<string, number>()
  const prev = new Map<string, string | null>()

  for (const dept of departments) {
    dist.set(dept.id, Infinity)
    prev.set(dept.id, null)
  }

  if (!dist.has(sourceId) || !dist.has(targetId)) return null

  dist.set(sourceId, 0)

  const heap = new MinHeap<HeapNode>((a, b) => a.dist - b.dist)
  heap.push({ id: sourceId, dist: 0 })

  while (heap.size > 0) {
    const current = heap.pop()!

    if (current.id === targetId) break

    // Skip stale heap entries
    if (current.dist > (dist.get(current.id) ?? Infinity)) continue

    for (const neighbor of adj.get(current.id) ?? []) {
      const newDist = current.dist + 1 // edge weight = 1 hop
      if (newDist < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, newDist)
        prev.set(neighbor, current.id)
        heap.push({ id: neighbor, dist: newDist })
      }
    }
  }

  // No path found
  const finalDist = dist.get(targetId)
  if (finalDist === undefined || finalDist === Infinity) return null

  // Reconstruct path from predecessor map
  const path: string[] = []
  let current: string | null = targetId

  while (current !== null) {
    path.push(current)
    current = prev.get(current) ?? null
  }

  path.reverse()

  // Verify path starts at source
  if (path[0] !== sourceId) return null

  return {
    path,
    hops: path.length - 1,
  }
}
