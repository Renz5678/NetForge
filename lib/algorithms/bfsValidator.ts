// bfsValidator.ts
// Pure function — no side effects.
// Method: BFS from every node, treating edges as undirected for reachability
// Collects all department names unreachable from any starting node

import type { NetworkNode } from '@/types'

type BfsResult = {
  allReachable: boolean
  isolated: string[]
}

export function validateConnectivity(departments: NetworkNode[]): BfsResult {
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

  // Find all connected components via multi-source BFS
  const globallyVisited = new Set<string>()
  const components: string[][] = []

  for (const dept of departments) {
    if (globallyVisited.has(dept.id)) continue

    const component: string[] = []
    const queue: string[] = [dept.id]
    globallyVisited.add(dept.id)

    while (queue.length > 0) {
      const current = queue.shift()!
      component.push(current)

      for (const neighbor of adj.get(current) ?? []) {
        if (!globallyVisited.has(neighbor)) {
          globallyVisited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    components.push(component)
  }

  // If there is only one component, all nodes are reachable
  if (components.length === 1) {
    return { allReachable: true, isolated: [] }
  }

  // Find the largest component — all nodes NOT in the largest are "isolated"
  // When all components have the same size (fully disconnected graph), all are isolated
  const largestSize = Math.max(...components.map((c) => c.length))
  const componentsSameSize = components.every((c) => c.length === largestSize)

  if (componentsSameSize && components.length > 1) {
    // All nodes are equally disconnected — all are isolated
    const isolated = departments.map((d) => idToName.get(d.id) ?? d.id)
    return { allReachable: false, isolated }
  }

  const largestComponent = components.find((c) => c.length === largestSize)!
  const largestSet = new Set(largestComponent)

  const isolated: string[] = []
  for (const dept of departments) {
    if (!largestSet.has(dept.id)) {
      isolated.push(idToName.get(dept.id) ?? dept.id)
    }
  }

  return {
    allReachable: isolated.length === 0,
    isolated,
  }
}

