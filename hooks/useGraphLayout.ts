// Hierarchical BFS layout assigning nodes to physical port-grouped tiers.
import { useMemo } from 'react'
import { detectCycles } from '@/lib/algorithms/cycleDetection'
import { validateConnectivity } from '@/lib/algorithms/bfsValidator'
import { getEdgeWeight, getLinkType } from '@/lib/algorithms/edgeWeights'
import type { NetworkNode, GraphNode, GraphEdge } from '@/types'

type GraphLayout = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// ── Constants ──────────────────────────────────────────────────────────────
const PADDING_TOP   = 80    // space above first tier
const PADDING_X     = 30    // left/right screen margin
const TIER_GAP_Y    = 130   // vertical distance between full tiers
const SUB_ROW_GAP   = 95    // vertical distance between wrapped sub-rows
const MAX_PER_ROW   = 3     // max nodes per row before wrapping
const MIN_SPACING   = 175   // minimum center-to-center horizontal spacing

// ── Helpers ────────────────────────────────────────────────────────────────
function buildUndirected(departments: NetworkNode[]): Map<string, string[]> {
  const idSet = new Set(departments.map((d) => d.id))
  const adj   = new Map<string, string[]>()
  for (const d of departments) adj.set(d.id, [])
  for (const d of departments) {
    for (const peer of d.peers) {
      if (!idSet.has(peer)) continue
      if (!adj.get(d.id)!.includes(peer))  adj.get(d.id)!.push(peer)
      if (!adj.get(peer)!.includes(d.id))  adj.get(peer)!.push(d.id)
    }
  }
  return adj
}

const TYPE_PRIORITY = ['wan', 'firewall', 'router', 'switch', 'department']

function pickRoot(depts: NetworkNode[]): string {
  for (const t of TYPE_PRIORITY) {
    const f = depts.find((d) => d.type === t)
    if (f) return f.id
  }
  return depts[0].id
}

function sortByType(ids: string[], depts: NetworkNode[]): string[] {
  return [...ids].sort((a, b) => {
    const ta = depts.find((d) => d.id === a)?.type ?? 'department'
    const tb = depts.find((d) => d.id === b)?.type ?? 'department'
    return TYPE_PRIORITY.indexOf(ta) - TYPE_PRIORITY.indexOf(tb)
  })
}

/** Center a row of `count` nodes, starting at `baseY`, evenly within `width`. */
function rowPositions(
  ids: string[],
  width: number,
  y: number
): { id: string; x: number; y: number }[] {
  const count   = ids.length
  const usable  = width - PADDING_X * 2
  const gap     = count === 1 ? 0 : Math.max(usable / (count - 1), MIN_SPACING)
  const totalW  = gap * (count - 1)
  const startX  = Math.max(PADDING_X, (width - totalW) / 2)

  return ids.map((id, i) => ({
    id,
    x: count === 1 ? width / 2 : startX + i * gap,
    y,
  }))
}

/**
 * For a wide tier: group nodes by their port-based physical parent, then
 * arrange each group as a sub-row centered under the parent's x position.
 * Falls back to a plain wrap if port info isn't available.
 */
function positionWideTier(
  ids: string[],
  departments: NetworkNode[],
  positioned: Map<string, { x: number; y: number }>,
  width: number,
  baseY: number
): { id: string; x: number; y: number }[] {
  const result: { id: string; x: number; y: number }[] = []

  // Group by physical port parent (connectedToNodeId of first port)
  const groups = new Map<string, string[]>()  // parentId → [childIds]
  const noParent: string[] = []

  for (const id of ids) {
    const dept = departments.find((d) => d.id === id)
    const parentId = dept?.ports?.[0]?.connectedToNodeId
    if (parentId && positioned.has(parentId)) {
      if (!groups.has(parentId)) groups.set(parentId, [])
      groups.get(parentId)!.push(id)
    } else {
      noParent.push(id)
    }
  }

  // If grouping didn't help (all unparented), fall back to plain wrapping
  if (groups.size === 0) {
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += MAX_PER_ROW) {
      chunks.push(ids.slice(i, i + MAX_PER_ROW))
    }
    chunks.forEach((chunk, ri) => {
      rowPositions(chunk, width, baseY + ri * SUB_ROW_GAP).forEach((p) => result.push(p))
    })
    return result
  }

  // Sort groups by parent x position (left to right)
  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const ax = positioned.get(a[0])?.x ?? 0
    const bx = positioned.get(b[0])?.x ?? 0
    return ax - bx
  })

  // Collect all children in left-to-right parent order
  const allSorted = sortedGroups.flatMap(([, children]) => children)
  // Append ungrouped at the end
  allSorted.push(...noParent)

  // Now wrap into rows of MAX_PER_ROW, centered overall
  const chunks: string[][] = []
  for (let i = 0; i < allSorted.length; i += MAX_PER_ROW) {
    chunks.push(allSorted.slice(i, i + MAX_PER_ROW))
  }
  chunks.forEach((chunk, ri) => {
    rowPositions(chunk, width, baseY + ri * SUB_ROW_GAP).forEach((p) => result.push(p))
  })

  return result
}

/** Total height consumed by a tier given its node count. */
function tierHeight(count: number): number {
  if (count <= MAX_PER_ROW) return 0
  const rows = Math.ceil(count / MAX_PER_ROW)
  return (rows - 1) * SUB_ROW_GAP
}

// ── Main export ────────────────────────────────────────────────────────────
export function useGraphLayout(
  departments: NetworkNode[],
  width: number,
  height: number
): GraphLayout {
  return useMemo(() => {
    if (departments.length === 0) return { nodes: [], edges: [] }

    const { hasCycle, cycle } = detectCycles(departments)
    const { isolated }        = validateConnectivity(departments)
    const cycleSet            = new Set(cycle)
    const isolatedSet         = new Set(isolated)

    const adjUndirected = buildUndirected(departments)
    const positioned    = new Map<string, { x: number; y: number }>()
    const unvisited     = new Set(departments.map((d) => d.id))

    let globalY = PADDING_TOP

    while (unvisited.size > 0) {
      const compDepts = departments.filter((d) => unvisited.has(d.id))
      const rootId    = pickRoot(compDepts)

      // BFS within this component
      const depths = new Map<string, number>()
      const queue  = [rootId]
      depths.set(rootId, 0)
      while (queue.length > 0) {
        const cur = queue.shift()!
        const d   = depths.get(cur)!
        for (const nb of adjUndirected.get(cur) ?? []) {
          if (unvisited.has(nb) && !depths.has(nb)) {
            depths.set(nb, d + 1)
            queue.push(nb)
          }
        }
      }

      const tierMap = new Map<number, string[]>()
      for (const [id, d] of depths) {
        if (!tierMap.has(d)) tierMap.set(d, [])
        tierMap.get(d)!.push(id)
      }

      const maxTier = Math.max(...tierMap.keys())
      let curY = globalY

      for (let tier = 0; tier <= maxTier; tier++) {
        const raw = tierMap.get(tier) ?? []
        const ids = sortByType(raw, departments)

        let placed: { id: string; x: number; y: number }[]

        if (ids.length <= MAX_PER_ROW) {
          // Simple centered row
          placed = rowPositions(ids, width, curY)
        } else {
          // Wide tier — use port-based grouping + wrapping
          placed = positionWideTier(ids, departments, positioned, width, curY)
        }

        for (const { id, x, y } of placed) {
          positioned.set(id, { x, y })
          unvisited.delete(id)
        }

        curY += tierHeight(ids.length) + TIER_GAP_Y
      }

      globalY = curY + 50
    }

    // ── GraphNode[] ──────────────────────────────────────────────────────
    const nodes: GraphNode[] = departments.map((dept) => {
      const pos  = positioned.get(dept.id) ?? { x: width / 2, y: height / 2 }
      const name = dept.name

      let status: GraphNode['status'] = 'valid'
      if (hasCycle    && cycleSet.has(name))   status = 'cycle'
      else if (isolatedSet.has(name))           status = 'isolated'

      return {
        id:     dept.id,
        label:  name,
        subnet: dept.subnet  ?? '—',
        vlanId: dept.vlanId  ?? 0,
        x:      pos.x,
        y:      pos.y,
        status,
        type:   dept.type,
      }
    })

    // ── Edges (undirected, de-duplicated, with link costs) ──────────────────────
    const edgeSet = new Set<string>()
    const edges: GraphEdge[] = []
    for (const dept of departments) {
      for (const peerId of dept.peers) {
        if (!departments.find((d) => d.id === peerId)) continue
        const key = [dept.id, peerId].sort().join('|')
        if (edgeSet.has(key)) continue
        edgeSet.add(key)
        const peerDept = departments.find((d) => d.id === peerId)!
        edges.push({
          source:   dept.id,
          target:   peerId,
          weight:   getEdgeWeight(dept, peerDept),
          linkType: getLinkType(dept, peerDept),
        })
      }
    }

    return { nodes, edges }
  }, [departments, width, height])
}
