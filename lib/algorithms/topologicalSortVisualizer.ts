// topologicalSortVisualizer.ts
// Pure function — no side effects, no imports from stores or UI.
// Method: Runs BFS (matching topologicalSort.ts) and records every enqueue/dequeue
//         and result expansion into VisualizationStep[].
//         The UI replays this array — the algorithm is never re-run per frame.

import type { NetworkNode, VisualizationStep, NodeVizState } from '@/types'

export type TopoSortVisualizationResult = {
  steps: VisualizationStep[]
  sortedOrder: string[] // final sorted department IDs
}

export function buildTopologicalSortSteps(
  departments: NetworkNode[]
): TopoSortVisualizationResult {
  const steps: VisualizationStep[] = []

  if (departments.length === 0) {
    return { steps, sortedOrder: [] }
  }

  const names = new Map(departments.map((d) => [d.id, d.name]))

  function lbl(id: string): string {
    return `"${names.get(id) ?? id}"`
  }

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

  const queue: string[] = []

  function runBfsFrom(startNode: string) {
    queue.push(startNode)
    inQueue.add(startNode)

    steps.push({
      stepIndex: steps.length,
      explanation: `Starting BFS traversal from root node ${lbl(startNode)}. Enqueuing it to determine the deployment sequence.`,
      hint: `Since this network uses bidirectional peer connections, we use a Breadth-First Search (BFS) to establish a deterministic startup order radiating outwards from core infrastructure.`,
      nodeStates: snapshotStates(),
      topoQueue: [...queue],
      sortedResult: [...sortedResult],
    })

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      inQueue.delete(nodeId)
      settled.add(nodeId)
      sortedResult.push(nodeId)

      const neighbors = adj.get(nodeId) ?? []

      steps.push({
        stepIndex: steps.length,
        explanation: `Dequeuing ${lbl(nodeId)} and adding it to the sorted deployment order at position ${sortedResult.length}.`,
        hint: `Pop a node from the queue and append it to the sorted list. This node is now fully scheduled for deployment.`,
        nodeStates: snapshotStates(),
        topoQueue: [...queue],
        sortedResult: [...sortedResult],
        currentNode: nodeId,
      })

      const newlyDiscovered: string[] = []
      for (const neighbor of neighbors) {
        if (!settled.has(neighbor) && !inQueue.has(neighbor)) {
          inQueue.add(neighbor)
          queue.push(neighbor)
          newlyDiscovered.push(neighbor)
        }
      }

      if (newlyDiscovered.length > 0) {
        steps.push({
          stepIndex: steps.length,
          explanation: `Discovered ${newlyDiscovered.length} unvisited neighbor${newlyDiscovered.length !== 1 ? 's' : ''} of ${lbl(nodeId)}: ${newlyDiscovered.map(lbl).join(', ')}. Added to queue.`,
          hint: `Explore all adjacent nodes that haven't been visited yet, adding them to the queue to be scheduled later.`,
          nodeStates: snapshotStates(),
          topoQueue: [...queue],
          sortedResult: [...sortedResult],
          currentNode: nodeId,
        })
      }
    }
  }

  // BFS from primary root
  runBfsFrom(rootId)

  // Handle disconnected components
  for (const dept of departments) {
    if (!settled.has(dept.id) && !inQueue.has(dept.id)) {
      runBfsFrom(dept.id)
    }
  }

  // Final step
  steps.push({
    stepIndex: steps.length,
    explanation: `Startup Order computation complete! Sorted order: ${sortedResult.map(lbl).join(' → ')}. This sequence ensures core infrastructure comes online before dependent leaf nodes.`,
    hint: `The BFS traversal successfully mapped every node. The resulting list is the recommended order to bring network devices online.`,
    nodeStates: snapshotStates(),
    topoQueue: [],
    sortedResult: [...sortedResult],
  })

  return { steps, sortedOrder: sortedResult }
}
