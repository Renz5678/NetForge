// articulationPoints.ts
// Pure function — no side effects, no imports from stores or UI.
// Input:  Department[]
// Output: ArticulationResult  { articulationPoints: string[]; bridges: [string, string][] }
//
// Method: Depth-first Search — Decrease & Conquer.
//   Articulation points and bridges are discovered in a single DFS pass.
//   The graph is treated as UNDIRECTED (peer relationships are bidirectional).
//
//   DFS tree bookkeeping:
//     disc[u]  — discovery time of node u (order in which DFS first visits it).
//     low[u]   — lowest disc value reachable from the subtree rooted at u
//               via zero or more tree edges followed by at most one back edge.
//
//   Articulation point rules derived from the DFS tree:
//     • Non-root node u is an AP if any DFS-child v satisfies low[v] ≥ disc[u]
//       (v's subtree cannot reach an ancestor of u without going through u).
//     • Root of the DFS tree is an AP if it has more than one DFS-tree child.
//     • An edge (u, v) is a bridge if low[v] > disc[u].
//
//   Handles disconnected graphs by restarting DFS from every unvisited node.

import type { Department } from '@/types'

export interface ArticulationResult {
  /** Department IDs that are single points of failure. */
  articulationPoints: string[]
  /** Pairs of [deptId, deptId] representing bridge edges. */
  bridges: [string, string][]
}

export function findArticulationPoints(departments: Department[]): ArticulationResult {
  if (departments.length === 0) {
    return { articulationPoints: [], bridges: [] }
  }

  if (departments.length === 1) {
    return { articulationPoints: [], bridges: [] }
  }

  // Build undirected adjacency list from peer relationships.
  // Department.peers is a directed list, but physical links are bidirectional.
  const adj = new Map<string, Set<string>>()
  const idSet = new Set(departments.map((d) => d.id))

  for (const dept of departments) {
    if (!adj.has(dept.id)) adj.set(dept.id, new Set())
  }

  for (const dept of departments) {
    for (const peerId of dept.peers) {
      if (!idSet.has(peerId)) continue // skip dangling references
      adj.get(dept.id)!.add(peerId)
      if (!adj.has(peerId)) adj.set(peerId, new Set())
      adj.get(peerId)!.add(dept.id)
    }
  }

  // DFS state
  const disc = new Map<string, number>()  // discovery time
  const low  = new Map<string, number>()  // lowest reachable disc
  const parent = new Map<string, string | null>()

  const apSet = new Set<string>()         // articulation points
  const bridgeSet = new Set<string>()     // "srcId→tgtId" bridge edge keys

  let timer = 0

  const dfs = (u: string): void => {
    disc.set(u, timer)
    low.set(u, timer)
    timer++

    let childCount = 0 // DFS-tree children (not back-edge revisits)

    for (const v of adj.get(u) ?? []) {
      if (!disc.has(v)) {
        // Tree edge — v is unvisited
        childCount++
        parent.set(v, u)
        dfs(v)

        // Update low[u] after subtree of v is fully explored
        const lowU = low.get(u)!
        const lowV = low.get(v)!
        low.set(u, Math.min(lowU, lowV))

        // AP check: non-root node u with low[v] >= disc[u]
        const parentU = parent.get(u) ?? null
        if (parentU !== null && lowV >= disc.get(u)!) {
          apSet.add(u)
        }

        // Bridge check: low[v] > disc[u]  →  edge (u, v) is a bridge
        if (lowV > disc.get(u)!) {
          // Normalise to lexicographic order so we don't add both (u,v) and (v,u)
          const key = u < v ? `${u}→${v}` : `${v}→${u}`
          bridgeSet.add(key)
        }
      } else if (v !== (parent.get(u) ?? null)) {
        // Back edge — v is already visited and is not the direct parent
        // Update low[u] via the back edge
        const lowU = low.get(u)!
        const discV = disc.get(v)!
        low.set(u, Math.min(lowU, discV))
      }
    }

    // AP check for root node: root is AP if it has > 1 DFS-tree child
    const parentU = parent.get(u) ?? null
    if (parentU === null && childCount > 1) {
      apSet.add(u)
    }
  }

  // Run DFS from every unvisited node to handle disconnected graphs
  for (const dept of departments) {
    if (!disc.has(dept.id)) {
      parent.set(dept.id, null)
      dfs(dept.id)
    }
  }

  // Convert bridge set back to [string, string][] pairs
  const bridges: [string, string][] = []
  for (const key of bridgeSet) {
    const [a, b] = key.split('→') as [string, string]
    bridges.push([a, b])
  }

  return {
    articulationPoints: [...apSet],
    bridges,
  }
}
