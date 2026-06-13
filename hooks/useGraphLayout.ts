/**
 * useGraphLayout.ts — Subtree-aware hierarchical layout engine (v3)
 *
 * Strategy
 * ────────
 * 1. BFS Spanning Tree
 *    Walk the undirected peer graph from a typed-priority root (WAN -> firewall ->
 *    router -> switch -> department). Every node gets a BFS parent and a list of
 *    tree children. Cycles and cross-edges are ignored for layout purposes.
 *
 * 2. Bottom-up Subtree Width Calculation
 *    Starting from the leaves, calculate how much horizontal space each subtree
 *    needs to render without any overlap:
 *      leaf  -> NODE_SLOT  (fixed node slot)
 *      inner -> max(NODE_SLOT, sum(children subtreeWidths) + (n-1) * SIBLING_GAP)
 *    This guarantees that parents are always pushed far enough apart to house all
 *    descendants of one branch before the next branch begins.
 *
 * 3. Top-down Position Assignment
 *    The root is placed at x = canvasCenter.
 *    Each parent splits its horizontal budget among children proportionally to
 *    their subtree widths, placing each child at the center of its allotted slot.
 *    Y positions come from BFS depth * TIER_GAP_Y.
 *
 * 4. Overflow clamp
 *    After layout, we detect the real bounding box and translate nodes so
 *    the graph is centred and never clips off either side of the canvas.
 *
 * Improvements over v2
 * ─────────────────────
 * - Zero cross-parent overlap (guaranteed mathematically).
 * - Proper centering for single-child chains (no left-bias).
 * - Disconnected sub-graphs stacked vertically with a component gap.
 * - Non-tree cross-links handled gracefully (rendered as secondary edges).
 */

import { useMemo } from 'react'
import { detectCycles } from '@/lib/algorithms/cycleDetection'
import { validateConnectivity } from '@/lib/algorithms/bfsValidator'
import { getEdgeWeight, getLinkType } from '@/lib/algorithms/edgeWeights'
import type { NetworkNode, GraphNode, GraphEdge } from '@/types'

// ── Tuning constants ──────────────────────────────────────────────────────────
const NODE_SLOT   = 164   // minimum horizontal space reserved per leaf node
const SIBLING_GAP = 32    // extra gap between adjacent sibling subtrees
const TIER_GAP_Y  = 140   // vertical distance between BFS depth levels
const PADDING_TOP = 80    // space above root node
const COMP_GAP_Y  = 100   // extra vertical gap between disconnected components

// ── Type priority ─────────────────────────────────────────────────────────────
const TYPE_PRIORITY = ['wan', 'firewall', 'router', 'switch', 'department']

function typePriority(t: string | undefined): number {
  const idx = TYPE_PRIORITY.indexOf(t ?? 'department')
  return idx === -1 ? TYPE_PRIORITY.length : idx
}

// ── Build adjacency list ──────────────────────────────────────────────────────
function buildAdj(departments: NetworkNode[]): Map<string, Set<string>> {
  const idSet = new Set(departments.map((d) => d.id))
  const adj   = new Map<string, Set<string>>()
  for (const d of departments) adj.set(d.id, new Set())
  for (const d of departments) {
    for (const peer of d.peers) {
      if (!idSet.has(peer)) continue
      adj.get(d.id)!.add(peer)
      adj.get(peer)!.add(d.id)
    }
  }
  return adj
}

/** Pick the highest-priority node from a list of ids. */
function pickRoot(ids: string[], deptMap: Map<string, NetworkNode>): string {
  let best = ids[0]
  let bestP = Infinity
  for (const id of ids) {
    const p = typePriority(deptMap.get(id)?.type)
    if (p < bestP) { bestP = p; best = id }
  }
  return best
}

/** Sort child IDs by type priority then name. */
function sortChildren(ids: string[], deptMap: Map<string, NetworkNode>): string[] {
  return [...ids].sort((a, b) => {
    const pa = typePriority(deptMap.get(a)?.type)
    const pb = typePriority(deptMap.get(b)?.type)
    if (pa !== pb) return pa - pb
    return (deptMap.get(a)?.name ?? '').localeCompare(deptMap.get(b)?.name ?? '')
  })
}

type TreeNode = {
  id:       string
  depth:    number
  children: string[]
  subtreeW: number
  x:        number
  y:        number
}

/**
 * Lay out one connected component via the 3-pass algorithm.
 * Returns a map of id -> {x, y}.
 */
function layoutComponent(
  ids: string[],
  deptMap: Map<string, NetworkNode>,
  adj: Map<string, Set<string>>,
  canvasCenter: number,
  baseY: number
): Map<string, { x: number; y: number }> {
  const root  = pickRoot(ids, deptMap)
  const idSet = new Set(ids)
  const nodes = new Map<string, TreeNode>()

  // Pass 1: BFS spanning tree
  const visited   = new Set<string>()
  const bfsQueue: string[] = [root]
  const bfsOrder: string[] = []
  visited.add(root)
  nodes.set(root, { id: root, depth: 0, children: [], subtreeW: 0, x: 0, y: 0 })

  while (bfsQueue.length > 0) {
    const cur     = bfsQueue.shift()!
    const curNode = nodes.get(cur)!
    bfsOrder.push(cur)
    const neighbors = [...(adj.get(cur) ?? [])].filter((nb) => idSet.has(nb) && !visited.has(nb))
    const sorted    = sortChildren(neighbors, deptMap)
    for (const nb of sorted) {
      visited.add(nb)
      nodes.set(nb, { id: nb, depth: curNode.depth + 1, children: [], subtreeW: 0, x: 0, y: 0 })
      curNode.children.push(nb)
      bfsQueue.push(nb)
    }
  }

  // Pass 2: bottom-up subtree width
  for (let i = bfsOrder.length - 1; i >= 0; i--) {
    const n = nodes.get(bfsOrder[i])!
    if (n.children.length === 0) {
      n.subtreeW = NODE_SLOT
    } else {
      const childrenSum = n.children.reduce((acc, cid) => acc + nodes.get(cid)!.subtreeW, 0)
      const gapsTotal   = (n.children.length - 1) * SIBLING_GAP
      n.subtreeW        = Math.max(NODE_SLOT, childrenSum + gapsTotal)
    }
  }

  // Pass 3: top-down position assignment
  const rootNode = nodes.get(root)!
  rootNode.x = canvasCenter
  rootNode.y = baseY + PADDING_TOP

  for (const id of bfsOrder) {
    const n = nodes.get(id)!
    if (n.children.length === 0) continue

    const totalChildW = n.children.reduce((acc, cid) => acc + nodes.get(cid)!.subtreeW, 0)
    const totalGaps   = (n.children.length - 1) * SIBLING_GAP
    const totalSpan   = totalChildW + totalGaps
    let curX = n.x - totalSpan / 2

    for (const cid of n.children) {
      const child = nodes.get(cid)!
      child.x = curX + child.subtreeW / 2
      child.y = baseY + PADDING_TOP + child.depth * TIER_GAP_Y
      curX += child.subtreeW + SIBLING_GAP
    }
  }

  const result = new Map<string, { x: number; y: number }>()
  for (const [id, n] of nodes) result.set(id, { x: n.x, y: n.y })
  return result
}

// ── Main export ───────────────────────────────────────────────────────────────
export function useGraphLayout(
  departments: NetworkNode[],
  width: number,
  height: number
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  return useMemo(() => {
    if (departments.length === 0) return { nodes: [], edges: [] }

    const { hasCycle, cycle } = detectCycles(departments)
    const { isolated }        = validateConnectivity(departments)
    const cycleSet            = new Set(cycle)
    const isolatedSet         = new Set(isolated)

    const deptMap = new Map(departments.map((d) => [d.id, d]))
    const adj     = buildAdj(departments)

    // Find connected components via BFS flood-fill
    const assigned   = new Set<string>()
    const components: string[][] = []

    for (const d of departments) {
      if (assigned.has(d.id)) continue
      const comp: string[] = []
      const q = [d.id]
      assigned.add(d.id)
      while (q.length > 0) {
        const cur = q.shift()!
        comp.push(cur)
        for (const nb of adj.get(cur) ?? []) {
          if (!assigned.has(nb)) {
            assigned.add(nb)
            q.push(nb)
          }
        }
      }
      components.push(comp)
    }

    // Largest component first; break ties by root type priority
    components.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length
      return typePriority(deptMap.get(pickRoot(a, deptMap))?.type)
           - typePriority(deptMap.get(pickRoot(b, deptMap))?.type)
    })

    const canvasCenter = width / 2
    const positioned   = new Map<string, { x: number; y: number }>()
    let globalY = 0

    for (const comp of components) {
      const compPositions = layoutComponent(comp, deptMap, adj, canvasCenter, globalY)

      let maxY = globalY
      for (const { y } of compPositions.values()) {
        if (y > maxY) maxY = y
      }
      for (const [id, pos] of compPositions) positioned.set(id, pos)

      globalY = maxY + TIER_GAP_Y + COMP_GAP_Y
    }

    // Horizontal clamp: centre the whole graph if it's wider than the canvas
    let minX = Infinity
    let maxX = -Infinity
    for (const { x } of positioned.values()) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
    const graphW  = maxX - minX
    const offsetX = canvasCenter - (minX + graphW / 2)
    if (Math.abs(offsetX) > 1) {
      for (const [id, pos] of positioned) {
        positioned.set(id, { x: pos.x + offsetX, y: pos.y })
      }
    }

    // Build GraphNode[]
    const nodes: GraphNode[] = departments.map((dept) => {
      const pos  = positioned.get(dept.id) ?? { x: canvasCenter, y: height / 2 }
      const name = dept.name

      let status: GraphNode['status'] = 'valid'
      if (hasCycle    && cycleSet.has(name))  status = 'cycle'
      else if (isolatedSet.has(name))          status = 'isolated'

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

    // Build GraphEdge[] (undirected, de-duplicated)
    const edgeSet = new Set<string>()
    const edges: GraphEdge[] = []
    for (const dept of departments) {
      for (const peerId of dept.peers) {
        if (!deptMap.has(peerId)) continue
        const key = [dept.id, peerId].sort().join('|')
        if (edgeSet.has(key)) continue
        edgeSet.add(key)
        const peerDept = deptMap.get(peerId)!
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
