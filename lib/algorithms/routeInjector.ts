import { NetworkNode, RouterNode, FirewallNode } from '@/types'

/**
 * Automatically injects static routes into routers/firewalls so that
 * all departments are reachable in a generated template.
 */
export function injectTemplateRoutes(nodes: NetworkNode[]) {
  // Build adjacency list for BFS
  const adj = new Map<string, string[]>()
  for (const node of nodes) {
    adj.set(node.id, [])
  }
  for (const node of nodes) {
    for (const peerId of node.peers) {
      if (adj.has(peerId)) {
        adj.get(node.id)!.push(peerId)
        if (!adj.get(peerId)!.includes(node.id)) {
          adj.get(peerId)!.push(node.id)
        }
      }
    }
  }

  const routers = nodes.filter(n => n.type === 'router' || n.type === 'firewall')
  const depts = nodes.filter(n => n.type === 'department' || !n.type)

  for (const router of routers) {
    router.staticRoutes = router.staticRoutes || []
    
    // For each department, find the shortest path from this router
    for (const dept of depts) {
      if (!dept.subnet) continue
      
      const queue = [{ id: router.id, path: [router.id] }]
      const visited = new Set<string>([router.id])
      let nextNodeId: string | null = null

      while (queue.length > 0) {
        const curr = queue.shift()!
        if (curr.id === dept.id) {
          nextNodeId = curr.path[1] // The node immediately after the router
          break
        }
        for (const neighbor of adj.get(curr.id) || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            queue.push({ id: neighbor, path: [...curr.path, neighbor] })
          }
        }
      }

      if (nextNodeId) {
        // Find the port on the router that connects to nextNodeId
        const port = router.ports?.find(p => p.connectedToNodeId === nextNodeId)
        if (port) {
          // Check if route already exists
          const exists = router.staticRoutes.some(r => r.destination === dept.subnet)
          if (!exists) {
            router.staticRoutes.push({
              destination: dept.subnet,
              nextHop: 'DIRECT',
              interfaceId: port.id
            })
          }
        }
      }
    }
  }
}
