// bfsValidator.ts
// Pure function — no side effects.
// Input: Department[]
// Output: { allReachable: boolean; isolated: string[] }
// Method: BFS from every node, treating edges as undirected for reachability
// Collects all department names unreachable from any starting node

import type { Department } from '@/types'

type BfsResult = {
  allReachable: boolean
  isolated: string[]
}

export function validateConnectivity(departments: Department[]): BfsResult {
  if (departments.length === 0) return { allReachable: true, isolated: [] }
  if (departments.length === 1) return { allReachable: true, isolated: [] }

  // Build undirected adjacency list
  const adj = new Map<string, Set<string>>()
  const idToName = new Map<string, string>()

  for (const dept of departments) {
    adj.set(dept.id, new Set())
    idToName.set(dept.id, dept.name)
  }

  for (const dept of departments) {
    for (const peerId of dept.peers) {
      if (!adj.has(peerId)) continue // skip dangling refs
      adj.get(dept.id)!.add(peerId)
      adj.get(peerId)!.add(dept.id)
    }
  }

  // Track which nodes are reachable from at least one BFS traversal
  // A node is "isolated" if it can never be reached
  const globallyVisited = new Set<string>()

  // Run BFS from every unvisited node to find all connected components
  for (const dept of departments) {
    if (globallyVisited.has(dept.id)) continue

    // BFS from dept.id
    const queue: string[] = [dept.id]
    const visited = new Set<string>([dept.id])

    while (queue.length > 0) {
      const current = queue.shift()!
      globallyVisited.add(current)

      for (const neighbor of adj.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
  }

  // A node is isolated if it has no peers (degree 0 in undirected graph)
  const isolated: string[] = []
  for (const dept of departments) {
    const neighbors = adj.get(dept.id) ?? new Set()
    if (neighbors.size === 0) {
      isolated.push(dept.name)
    }
  }

  return {
    allReachable: isolated.length === 0,
    isolated,
  }
}
