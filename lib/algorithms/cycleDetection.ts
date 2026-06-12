// cycleDetection.ts
// Pure function — no side effects, no imports from stores or UI.
// Uses DFS with white/gray/black node coloring.
// Handles disconnected subgraphs by processing every node.

import type { NetworkNode } from '@/types'

type CycleResult = {
  hasCycle: boolean
  cycle: string[]
}

type NodeColor = 'white' | 'gray' | 'black'

export function detectCycles(departments: NetworkNode[]): CycleResult {
  if (departments.length === 0) {
    return { hasCycle: false, cycle: [] }
  }

  // Build adjacency list: id → peer ids
  const adj = new Map<string, string[]>()
  const idToName = new Map<string, string>()

  for (const dept of departments) {
    adj.set(dept.id, dept.peers)
    idToName.set(dept.id, dept.name)
  }

  const color = new Map<string, NodeColor>()
  const parent = new Map<string, string | null>()

  for (const dept of departments) {
    color.set(dept.id, 'white')
    parent.set(dept.id, null)
  }

  let cycleStart = ''
  let cycleEnd = ''

  function dfs(nodeId: string, parentId: string | null = null): boolean {
    color.set(nodeId, 'gray')

    const neighbors = adj.get(nodeId) ?? []
    for (const neighborId of neighbors) {
      // Skip edges to nodes not in our department list (dangling refs)
      if (!color.has(neighborId)) continue

      // Skip the immediate parent to avoid treating bidirectional links as cycles
      if (neighborId === parentId) continue

      if (color.get(neighborId) === 'gray') {
        // Back edge — cycle found
        cycleStart = neighborId
        cycleEnd = nodeId
        return true
      }

      if (color.get(neighborId) === 'white') {
        parent.set(neighborId, nodeId)
        if (dfs(neighborId, nodeId)) return true
      }
    }

    color.set(nodeId, 'black')
    return false
  }

  // Process every node to handle disconnected subgraphs
  for (const dept of departments) {
    if (color.get(dept.id) === 'white') {
      if (dfs(dept.id, null)) {
        // Reconstruct the cycle path
        const cycle: string[] = []
        let current: string | undefined = cycleEnd

        // Walk back through parent map until we reach cycleStart
        while (current !== undefined && current !== cycleStart) {
          cycle.push(idToName.get(current) ?? current)
          const p = parent.get(current)
          current = p ?? undefined
        }

        if (current === cycleStart) {
          // Successfully traced back to cycle start
          cycle.push(idToName.get(cycleStart) ?? cycleStart)
          cycle.reverse()
          // Complete the cycle by appending start again
          if (cycle.length > 0) {
            cycle.push(cycle[0])
          }
        } else {
          // Walk ended without reaching cycleStart — return minimal valid cycle
          cycle.length = 0
          cycle.push(idToName.get(cycleStart) ?? cycleStart)
          cycle.push(idToName.get(cycleEnd) ?? cycleEnd)
        }

        return { hasCycle: true, cycle }
      }
    }
  }

  return { hasCycle: false, cycle: [] }
}
