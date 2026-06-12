// topologicalSort.ts
// Pure function — no side effects.
// Method: Kahn's algorithm (BFS-based, uses in-degree map)

import type { NetworkNode } from '@/types'

export function topologicalSort(departments: NetworkNode[]): string[] {
  if (departments.length === 0) return []
  if (departments.length === 1) return [departments[0].id]

  // Build in-degree map and adjacency list
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  // Initialize every node
  for (const dept of departments) {
    if (!inDegree.has(dept.id)) inDegree.set(dept.id, 0)
    if (!adj.has(dept.id)) adj.set(dept.id, [])
  }

  // Count in-degrees based on peer edges (dept → peer means peer depends on dept's existence)
  // A→B means A communicates with B, so B is a "downstream" neighbor of A
  for (const dept of departments) {
    for (const peerId of dept.peers) {
      if (!inDegree.has(peerId)) continue // skip dangling refs
      adj.get(dept.id)!.push(peerId)
      inDegree.set(peerId, (inDegree.get(peerId) ?? 0) + 1)
    }
  }

  // BFS queue: all nodes with zero in-degree
  const queue: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id)
  }

  const result: string[] = []

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    result.push(nodeId)

    for (const neighbor of adj.get(nodeId) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  // If result length < departments length, there was a cycle (shouldn't happen post-validation)
  // Return whatever we have
  return result
}
