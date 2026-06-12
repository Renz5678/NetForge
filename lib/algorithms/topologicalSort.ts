// topologicalSort.ts
// Pure function — no side effects.
// Method: BFS traversal from a preferred root (router/firewall > first node).
//
// NOTE: Kahn's algorithm (in-degree based) fails on bidirectional peer graphs
// because every connected node has non-zero in-degree, leaving Kahn's queue
// empty and returning an empty array. Since AGENTS.md mandates bidirectional
// peers, we use BFS instead to produce a deterministic deployment order.

import type { NetworkNode } from '@/types'

export function topologicalSort(departments: NetworkNode[]): string[] {
  if (departments.length === 0) return []
  if (departments.length === 1) return [departments[0].id]

  // Build undirected adjacency list from peer relationships
  const adj = new Map<string, string[]>()
  const idSet = new Set(departments.map((d) => d.id))

  for (const dept of departments) {
    if (!adj.has(dept.id)) adj.set(dept.id, [])
  }

  for (const dept of departments) {
    for (const peerId of dept.peers) {
      if (!idSet.has(peerId)) continue // skip dangling refs
      adj.get(dept.id)!.push(peerId)
      if (!adj.get(peerId)!.includes(dept.id)) {
        adj.get(peerId)!.push(dept.id)
      }
    }
  }

  // Prefer a routing-capable device as root for a meaningful deployment order
  const PREFERRED_TYPES = ['wan', 'firewall', 'router', 'switch']
  let rootId = departments[0].id
  for (const type of PREFERRED_TYPES) {
    const found = departments.find((d) => d.type === type)
    if (found) { rootId = found.id; break }
  }

  const visited = new Set<string>()
  const result: string[] = []

  // BFS from root
  const queue: string[] = [rootId]
  visited.add(rootId)

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    result.push(nodeId)

    for (const neighbor of adj.get(nodeId) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  // Handle disconnected components — restart BFS from any unvisited node
  for (const dept of departments) {
    if (!visited.has(dept.id)) {
      const subQueue: string[] = [dept.id]
      visited.add(dept.id)
      while (subQueue.length > 0) {
        const nodeId = subQueue.shift()!
        result.push(nodeId)
        for (const neighbor of adj.get(nodeId) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            subQueue.push(neighbor)
          }
        }
      }
    }
  }

  return result
}

