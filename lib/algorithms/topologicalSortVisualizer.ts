// topologicalSortVisualizer.ts
// Pure function — no side effects, no imports from stores or UI.
// Input: Department[] (should be cycle-free; run cycle detection first)
// Output: TopoSortVisualizationResult with pre-computed step snapshots.
// Method: Runs Kahn's algorithm (BFS-based) and records every enqueue/dequeue,
//         in-degree decrement, and result expansion into VisualizationStep[].
//         The UI replays this array — the algorithm is never re-run per frame.

import type { Department, VisualizationStep, NodeVizState } from '@/types'

export type TopoSortVisualizationResult = {
  steps: VisualizationStep[]
  sortedOrder: string[] // final sorted department IDs
}

export function buildTopologicalSortSteps(
  departments: Department[]
): TopoSortVisualizationResult {
  const steps: VisualizationStep[] = []

  if (departments.length === 0) {
    return { steps, sortedOrder: [] }
  }

  const names = new Map(departments.map((d) => [d.id, d.name]))

  function lbl(id: string): string {
    return `"${names.get(id) ?? id}"`
  }

  // Build in-degree map and adjacency list
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  const idSet = new Set(departments.map((d) => d.id))

  for (const dept of departments) {
    if (!inDegree.has(dept.id)) inDegree.set(dept.id, 0)
    if (!adj.has(dept.id)) adj.set(dept.id, [])
  }

  for (const dept of departments) {
    for (const peerId of dept.peers) {
      if (!idSet.has(peerId)) continue
      adj.get(dept.id)!.push(peerId)
      inDegree.set(peerId, (inDegree.get(peerId) ?? 0) + 1)
    }
  }

  // Track which nodes are in each state for visualization
  const settled = new Set<string>()   // dequeued and added to result
  const inQueue = new Set<string>()   // currently in BFS queue
  const sortedResult: string[] = []

  function snapshotStates(): Record<string, NodeVizState> {
    const states: Record<string, NodeVizState> = {}
    for (const dept of departments) {
      if (settled.has(dept.id)) states[dept.id] = 'settled'
      else if (inQueue.has(dept.id)) states[dept.id] = 'inQueue'
      else states[dept.id] = 'unvisited'
    }
    return states
  }

  // Seed queue: all nodes with zero in-degree
  const queue: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id)
      inQueue.add(id)
    }
  }

  // Step 0: initialization
  steps.push({
    stepIndex: 0,
    explanation: `Initializing Kahn's algorithm. Computed in-degrees for all nodes. ${queue.length} node${queue.length !== 1 ? 's' : ''} start with in-degree 0: ${queue.map(lbl).join(', ')}. These go into the queue first — they have no dependencies.`,
    hint: `We count incoming links (in-degree) for each node. Nodes with in-degree 0 have no dependencies and can be processed immediately.`,
    nodeStates: snapshotStates(),
    inDegreeMap: Object.fromEntries(inDegree),
    topoQueue: [...queue],
    sortedResult: [],
  })

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    inQueue.delete(nodeId)
    settled.add(nodeId)
    sortedResult.push(nodeId)

    const neighbors = adj.get(nodeId) ?? []

    steps.push({
      stepIndex: steps.length,
      explanation: `Dequeuing ${lbl(nodeId)} — it has in-degree 0, so all its dependencies are resolved. Adding it to position ${sortedResult.length} in the sorted order. Now decrementing in-degree of its ${neighbors.length} downstream neighbor${neighbors.length !== 1 ? 's' : ''}.`,
      hint: `Pop a node from the queue, append it to the sorted list, and check all its outgoing connections to update their remaining dependencies.`,
      nodeStates: snapshotStates(),
      inDegreeMap: Object.fromEntries(inDegree),
      topoQueue: [...queue],
      sortedResult: [...sortedResult],
      currentNode: nodeId,
    })

    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDeg)

      if (newDeg === 0) {
        queue.push(neighbor)
        inQueue.add(neighbor)

        steps.push({
          stepIndex: steps.length,
          explanation: `${lbl(neighbor)}'s in-degree dropped to 0 — all its prerequisites are now sorted. Enqueuing it.`,
          hint: `Since this node's last dependency is resolved, its in-degree becomes 0 and it is ready to be queued for sorting.`,
          nodeStates: snapshotStates(),
          inDegreeMap: Object.fromEntries(inDegree),
          topoQueue: [...queue],
          sortedResult: [...sortedResult],
          currentNode: neighbor,
        })
      } else {
        steps.push({
          stepIndex: steps.length,
          explanation: `Decrementing ${lbl(neighbor)}'s in-degree: ${newDeg + 1} → ${newDeg}. Still waiting on ${newDeg} more predecessor${newDeg !== 1 ? 's' : ''}.`,
          hint: `We remove the connection from the resolved node by decrementing the target's in-degree count by 1.`,
          nodeStates: snapshotStates(),
          inDegreeMap: Object.fromEntries(inDegree),
          topoQueue: [...queue],
          sortedResult: [...sortedResult],
          currentNode: neighbor,
        })
      }
    }
  }

  // Final step
  steps.push({
    stepIndex: steps.length,
    explanation:
      sortedResult.length === departments.length
        ? `Topological sort complete! Sorted order: ${sortedResult.map(lbl).join(' → ')}. This order guarantees all dependencies are configured before the nodes that depend on them.`
        : `Sort terminated early — only ${sortedResult.length} of ${departments.length} nodes processed. A cycle likely exists in the remaining nodes.`,
    hint: `Kahn's algorithm finishes successfully when all nodes are sorted. If any remain unsorted, a circular dependency exists.`,
    nodeStates: snapshotStates(),
    inDegreeMap: Object.fromEntries(inDegree),
    topoQueue: [],
    sortedResult: [...sortedResult],
  })

  return { steps, sortedOrder: sortedResult }
}
