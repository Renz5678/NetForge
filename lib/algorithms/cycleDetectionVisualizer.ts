// cycleDetectionVisualizer.ts
// Pure function — no side effects, no imports from stores or UI.
// Method: Runs DFS with white/gray/black coloring and records every node visit,
//         stack push/pop, and the back-edge that causes a cycle.
//         The UI replays this array — the algorithm is never re-run per frame.

import type { NetworkNode, VisualizationStep, NodeVizState } from '@/types'

export type CycleDetectionVisualizationResult = {
  steps: VisualizationStep[]
  hasCycle: boolean
  cycleNodeIds: string[] // IDs of nodes in the detected cycle
}

type NodeColor = 'white' | 'gray' | 'black'

export function buildCycleDetectionSteps(
  departments: NetworkNode[]
): CycleDetectionVisualizationResult {
  const steps: VisualizationStep[] = []

  if (departments.length === 0) {
    return { steps, hasCycle: false, cycleNodeIds: [] }
  }

  const names = new Map(departments.map((d) => [d.id, d.name]))
  const idSet = new Set(departments.map((d) => d.id))

  function lbl(id: string): string {
    return `"${names.get(id) ?? id}"`
  }

  // Build adjacency list
  const adj = new Map<string, string[]>()
  for (const dept of departments) {
    adj.set(dept.id, dept.peers.filter((p) => idSet.has(p)))
  }

  const color = new Map<string, NodeColor>()
  const parent = new Map<string, string | null>()
  const dfsStack: string[] = []

  for (const dept of departments) {
    color.set(dept.id, 'white')
    parent.set(dept.id, null)
  }

  let cycleStart = ''
  let cycleEnd = ''
  let cycleFound = false

  // Convert color map to NodeVizState snapshot
  function snapshotStates(
    highlightCycle?: Set<string>,
    backEdge?: { from: string; to: string }
  ): Record<string, NodeVizState> {
    const states: Record<string, NodeVizState> = {}
    for (const dept of departments) {
      if (highlightCycle?.has(dept.id)) {
        states[dept.id] = 'cycle'
      } else {
        const c = color.get(dept.id)
        if (c === 'white') states[dept.id] = 'unvisited'
        else if (c === 'gray') states[dept.id] = 'inStack'
        else states[dept.id] = 'settled'
      }
    }
    return states
  }

  // Step 0: initialization
  steps.push({
    stepIndex: 0,
    explanation: `Starting cycle detection. All ${departments.length} node${departments.length !== 1 ? 's' : ''} begin unvisited (white). We will run DFS from each unvisited node to find any back-edges.`,
    hint: `Initialize Depth-First Search. DFS color-codes nodes (white=unvisited, gray=exploring/in-stack, black=fully-explored) to trace paths.`,
    nodeStates: snapshotStates(),
    dfsStack: [],
  })

  function dfs(nodeId: string, parentId: string | null = null): boolean {
    color.set(nodeId, 'gray')
    dfsStack.push(nodeId)

    steps.push({
      stepIndex: steps.length,
      explanation: `Visiting ${lbl(nodeId)} — marking it gray (in DFS stack). Stack depth: ${dfsStack.length}. Now exploring its ${adj.get(nodeId)?.length ?? 0} neighbor${(adj.get(nodeId)?.length ?? 0) !== 1 ? 's' : ''}.`,
      hint: `Mark the current node as 'exploring' (gray) and push it to the active stack. A cycle exists if we run into a gray node again.`,
      nodeStates: snapshotStates(),
      dfsStack: [...dfsStack],
    })

    const neighbors = adj.get(nodeId) ?? []
    for (const neighborId of neighbors) {
      if (!color.has(neighborId)) continue

      if (neighborId === parentId) {
        steps.push({
          stepIndex: steps.length,
          explanation: `${lbl(neighborId)} is the node we just came from (parent). Skipping it to avoid false back-edges in an undirected graph.`,
          hint: `In an undirected network, the direct link back to the parent isn't considered a routing loop.`,
          nodeStates: snapshotStates(),
          dfsStack: [...dfsStack],
        })
        continue
      }

      if (color.get(neighborId) === 'gray') {
        // Back-edge found — cycle!
        cycleStart = neighborId
        cycleEnd = nodeId
        cycleFound = true

        steps.push({
          stepIndex: steps.length,
          explanation: `Back-edge detected! ${lbl(nodeId)} → ${lbl(neighborId)}, but ${lbl(neighborId)} is already in the current DFS stack (gray). This means there is a cycle!`,
          hint: `A back-edge represents a dependency/link pointing back to an active ancestor, which forms a closed loop.`,
          nodeStates: snapshotStates(),
          dfsStack: [...dfsStack],
          backEdge: { from: nodeId, to: neighborId },
        })
        return true
      }

      if (color.get(neighborId) === 'white') {
        parent.set(neighborId, nodeId)

        steps.push({
          stepIndex: steps.length,
          explanation: `${lbl(nodeId)} has an unvisited neighbor ${lbl(neighborId)}. Recursing into it.`,
          hint: `Explore deeper by recursively visiting the unvisited neighbor node.`,
          nodeStates: snapshotStates(),
          dfsStack: [...dfsStack],
        })

        if (dfs(neighborId, nodeId)) return true
      } else {
        steps.push({
          stepIndex: steps.length,
          explanation: `${lbl(neighborId)} is already fully processed (black) — skipping.`,
          hint: `We ignore this neighbor because it has already been completely explored without forming any cycle.`,
          nodeStates: snapshotStates(),
          dfsStack: [...dfsStack],
        })
      }
    }

    color.set(nodeId, 'black')
    dfsStack.pop()

    steps.push({
      stepIndex: steps.length,
      explanation: `Finished exploring ${lbl(nodeId)} — all its neighbors processed. Marking it black and popping from stack.`,
      hint: `Since all outgoing paths from this node are exhausted, we mark it fully processed (black) and pop it from the stack.`,
      nodeStates: snapshotStates(),
      dfsStack: [...dfsStack],
    })

    return false
  }

  for (const dept of departments) {
    if (color.get(dept.id) === 'white') {
      steps.push({
        stepIndex: steps.length,
        explanation: `Starting new DFS tree from ${lbl(dept.id)} (it hasn't been visited yet).`,
        hint: `In a disconnected graph, we must start a new search from any remaining unvisited node to check all components.`,
        nodeStates: snapshotStates(),
        dfsStack: [],
      })

      if (dfs(dept.id, null)) break
    }
  }

  if (!cycleFound) {
    steps.push({
      stepIndex: steps.length,
      explanation: `DFS complete. All nodes processed with no back-edges found. This graph is acyclic — no routing loops exist!`,
      hint: `All nodes have been successfully explored, and no closed path loops were found.`,
      nodeStates: snapshotStates(),
      dfsStack: [],
    })
    return { steps, hasCycle: false, cycleNodeIds: [] }
  }

  // Reconstruct the cycle path
  const cycleNodeIds: string[] = []
  let cur: string | undefined = cycleEnd

  while (cur !== undefined && cur !== cycleStart) {
    cycleNodeIds.push(cur)
    const p = parent.get(cur)
    cur = p ?? undefined
  }
  if (cur === cycleStart) {
    cycleNodeIds.push(cycleStart)
    cycleNodeIds.reverse()
    if (cycleNodeIds.length > 0) cycleNodeIds.push(cycleNodeIds[0])
  } else {
    cycleNodeIds.length = 0
    cycleNodeIds.push(cycleStart, cycleEnd)
  }

  const cycleSet = new Set(cycleNodeIds)

  steps.push({
    stepIndex: steps.length,
    explanation: `Cycle traced: ${cycleNodeIds.map((id) => `"${names.get(id) ?? id}"`).join(' → ')}. These nodes form a routing loop. Remove one of the highlighted edges to fix it.`,
    hint: `The cycle path is traced by backtracking through the DFS parent pointers from the end node to the start node.`,
    nodeStates: snapshotStates(cycleSet),
    dfsStack: [],
    backEdge: { from: cycleEnd, to: cycleStart },
  })

  return { steps, hasCycle: true, cycleNodeIds }
}
