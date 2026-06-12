// aStarVisualizer.ts
// Pure function — no side effects, no imports from stores or UI.
// Input: Department[], sourceId: string, targetId: string,
//        nodePositions: Map<string, { x: number; y: number }>
// Output: AStarVisualizationResult with pre-computed step snapshots.
// Method: Runs A* once and records every decision into VisualizationStep[].
//         Also records visitedNodeIds for side-by-side comparison with Dijkstra.
//         The UI replays this array — the algorithm is never re-run per frame.

import type { Department, VisualizationStep, NodeVizState, PathResult } from '@/types'
import { MinHeap } from '@/lib/dataStructures/MinHeap'

export type AStarVisualizationResult = {
  steps: VisualizationStep[]
  finalPath: PathResult | null
  visitedNodeIds: Set<string> // Nodes A* settled (fewer than Dijkstra due to heuristic)
}

type HeapNode = { id: string; f: number; g: number }




function euclideanH(
  nodeId: string,
  targetId: string,
  positions: Map<string, { x: number; y: number }>
): number {
  const a = positions.get(nodeId)
  const b = positions.get(targetId)
  if (!a || !b) return 0
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy) / 120
}

function distStr(d: number): string {
  return d === Infinity ? '∞' : d.toFixed(2)
}

export function buildAStarSteps(
  departments: Department[],
  sourceId: string,
  targetId: string,
  nodePositions: Map<string, { x: number; y: number }>
): AStarVisualizationResult {
  const steps: VisualizationStep[] = []
  const visitedNodeIds = new Set<string>()

  if (departments.length === 0) {
    return { steps, finalPath: null, visitedNodeIds }
  }

  const names = new Map(departments.map((d) => [d.id, d.name]))
  const idSet = new Set(departments.map((d) => d.id))

  function lbl(id: string): string {
    return `"${names.get(id) ?? id}"`
  }

  // Build undirected adjacency list (respects physical link bidirectionality)
  const adj = new Map<string, string[]>()
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

  const gScore = new Map<string, number>()
  const prev = new Map<string, string | null>()
  const closed = new Set<string>()
  const inOpen = new Set<string>()

  for (const dept of departments) {
    gScore.set(dept.id, Infinity)
    prev.set(dept.id, null)
  }

  if (!gScore.has(sourceId) || !gScore.has(targetId)) {
    return { steps, finalPath: null, visitedNodeIds }
  }

  gScore.set(sourceId, 0)
  const h0 = euclideanH(sourceId, targetId, nodePositions)
  const openSet = new MinHeap<HeapNode>((a, b) => a.f - b.f)
  openSet.push({ id: sourceId, f: h0, g: 0 })
  inOpen.add(sourceId)

  function snapshotStates(pathNodes?: Set<string>): Record<string, NodeVizState> {
    const states: Record<string, NodeVizState> = {}
    for (const dept of departments) {
      if (pathNodes?.has(dept.id)) states[dept.id] = 'path'
      else if (closed.has(dept.id)) states[dept.id] = 'settled'
      else if (inOpen.has(dept.id)) states[dept.id] = 'inQueue'
      else states[dept.id] = 'unvisited'
    }
    return states
  }

  steps.push({
    stepIndex: 0,
    explanation: `Initializing A* from ${lbl(sourceId)} to ${lbl(targetId)}. g(start)=0, h(start)=${h0.toFixed(2)} (Euclidean estimate to target). f=g+h=${h0.toFixed(2)}.`,
    hint: `We initialize A* with g(start)=0 and estimate the remaining distance to target (h) using geometric coordinates.`,
    nodeStates: snapshotStates(),
    priorityQueue: openSet.contents.map((n) => ({ id: n.id, dist: n.g, f: n.f, h: euclideanH(n.id, targetId, nodePositions) })),
    distances: Object.fromEntries(gScore),
    currentNode: sourceId,
  })

  while (openSet.size > 0) {
    const current = openSet.pop()!

    if (closed.has(current.id)) continue
    if (current.g > (gScore.get(current.id) ?? Infinity)) continue

    closed.add(current.id)
    inOpen.delete(current.id)
    visitedNodeIds.add(current.id)

    if (current.id === targetId) {
      steps.push({
        stepIndex: steps.length,
        explanation: `Reached ${lbl(targetId)}! g=${distStr(current.g)} hops. A* is done — the heuristic guided us there efficiently.`,
        hint: `The target node was dequeued from the priority queue, showing that the shortest path has been calculated.`,
        nodeStates: snapshotStates(),
        priorityQueue: openSet.contents.map((n) => ({ id: n.id, dist: n.g, f: n.f, h: euclideanH(n.id, targetId, nodePositions) })),
        distances: Object.fromEntries(gScore),
        currentNode: current.id,
      })
      break
    }

    const h = euclideanH(current.id, targetId, nodePositions)
    const neighbors = adj.get(current.id) ?? []
    const updatedNeighbors: string[] = []

    for (const neighbor of neighbors) {
      if (closed.has(neighbor)) continue

      const tentativeG = current.g + 1
      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        gScore.set(neighbor, tentativeG)
        prev.set(neighbor, current.id)
        const hNeighbor = euclideanH(neighbor, targetId, nodePositions)
        const fNeighbor = tentativeG + hNeighbor
        openSet.push({ id: neighbor, f: fNeighbor, g: tentativeG })
        inOpen.add(neighbor)
        updatedNeighbors.push(lbl(neighbor))
      }
    }

    const explanation = updatedNeighbors.length > 0
      ? `Expanding ${lbl(current.id)}: g=${distStr(current.g)}, h=${h.toFixed(2)}, f=${(current.g + h).toFixed(2)}. Relaxed edges to: ${updatedNeighbors.join(', ')}.`
      : `Expanding ${lbl(current.id)}: g=${distStr(current.g)}, h=${h.toFixed(2)}, f=${(current.g + h).toFixed(2)}. No new shorter paths found.`

    steps.push({
      stepIndex: steps.length,
      explanation,
      hint: `We compute the estimated total cost f(n) = g(n) + h(n) for all neighbors, sorting the priority queue so we search towards the target first.`,
      nodeStates: snapshotStates(),
      priorityQueue: openSet.contents.map((n) => ({ id: n.id, dist: n.g, f: n.f, h: euclideanH(n.id, targetId, nodePositions) })),
      distances: Object.fromEntries(gScore),
      currentNode: current.id,
    })
  }

  const finalG = gScore.get(targetId)
  if (finalG === undefined || finalG === Infinity) {
    steps.push({
      stepIndex: steps.length,
      explanation: `No path found from ${lbl(sourceId)} to ${lbl(targetId)}.`,
      hint: `All possible directions have been evaluated, but no linked connection links the source and destination.`,
      nodeStates: snapshotStates(),
      distances: Object.fromEntries(gScore),
    })
    return { steps, finalPath: null, visitedNodeIds }
  }

  const path: string[] = []
  let node: string | null = targetId
  while (node !== null) {
    path.push(node)
    node = prev.get(node) ?? null
  }
  path.reverse()

  if (path[0] !== sourceId) {
    return { steps, finalPath: null, visitedNodeIds }
  }

  const pathSet = new Set(path)

  steps.push({
    stepIndex: steps.length,
    explanation: `A* path: ${path.map((id) => `"${names.get(id) ?? id}"`).join(' → ')} — ${path.length - 1} hop${path.length - 1 !== 1 ? 's' : ''}. A* explored only ${visitedNodeIds.size} node${visitedNodeIds.size !== 1 ? 's' : ''} — compare with Dijkstra to see the heuristic's efficiency.`,
    hint: `By backtracking through the previous parent node pointers, we trace the final path.`,
    nodeStates: snapshotStates(pathSet),
    distances: Object.fromEntries(gScore),
  })

  return {
    steps,
    finalPath: { path, hops: path.length - 1 },
    visitedNodeIds,
  }
}
