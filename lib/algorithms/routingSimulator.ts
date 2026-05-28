// routingSimulator.ts
// Pure function — no side effects.
// Implements Longest Prefix Match, OSPF Dynamic Area propagation, L2 VLAN switch forwarding, and Dijkstra path tracing.

import type { Department, InterfacePort, StaticRoute, OspfConfig } from '@/types'
import { ipToUint32, uint32ToIp, cidrToMask, ipInSubnet } from '@/lib/ipUtils'
import { evaluateAcl, findMatchingRule, type AclPacket } from '@/lib/algorithms/aclEngine'

export type RoutingTableEntry = {
  destination: string;   // e.g. "10.0.1.0/24"
  nextHop: string;       // e.g. "10.0.0.2" or "DIRECT"
  interfaceId?: string;  // egress port ID
  type: 'DIRECT' | 'STATIC' | 'OSPF';
  prefixLength: number;
}

export type HopDetail = {
  nodeId: string;
  nodeName: string;
  ingressPortId?: string;
  ingressPortName?: string;
  egressPortId?: string;
  egressPortName?: string;
  routeType?: 'DIRECT' | 'STATIC' | 'OSPF' | 'L2';
  // The winning route decision at this hop — surfaced in the path result UI
  decisionReason?: {
    matchedPrefix: string;       // e.g. "10.0.1.0/24"
    prefixLength: number;        // e.g. 24 (longer = higher priority)
    nextHop: string;             // e.g. "10.0.0.2" or "DIRECT"
    routeType: 'DIRECT' | 'STATIC' | 'OSPF';
    aclVerdict?: 'permit' | 'deny';
    aclRuleSeq?: number;
    vlanId?: number;
  };
}

export type PathTraceResult = {
  success: boolean;
  path: string[];        // node IDs
  hops: HopDetail[];     // detailed hop information
  message: string;       // status message
}

export function compileRoutingTables(nodes: Department[]): Map<string, RoutingTableEntry[]> {
  const tables = new Map<string, RoutingTableEntry[]>()

  // 1. Initialize with Direct and Static routes
  for (const node of nodes) {
    const entries: RoutingTableEntry[] = []

    // Directly connected routes from ports
    if (node.ports) {
      for (const port of node.ports) {
        if (port.ipAddress) {
          const [ip, prefixStr] = port.ipAddress.split('/')
          const prefix = parseInt(prefixStr, 10)
          const mask = cidrToMask(prefix)
          const netNum = (ipToUint32(ip) & mask) >>> 0
          const subnetStr = `${uint32ToIp(netNum)}/${prefix}`

          entries.push({
            destination: subnetStr,
            nextHop: 'DIRECT',
            interfaceId: port.id,
            type: 'DIRECT',
            prefixLength: prefix
          })
        }
      }
    }

    // Fallback directly connected route for departments
    if (node.subnet) {
      const [ip, prefixStr] = node.subnet.split('/')
      const prefix = parseInt(prefixStr ?? '24', 10)
      entries.push({
        destination: node.subnet,
        nextHop: 'DIRECT',
        type: 'DIRECT',
        prefixLength: prefix
      })
    }

    // Static routes
    if (node.staticRoutes) {
      for (const route of node.staticRoutes) {
        const [_, prefixStr] = route.destination.split('/')
        const prefix = parseInt(prefixStr ?? '24', 10)
        entries.push({
          destination: route.destination,
          nextHop: route.nextHop,
          interfaceId: route.interfaceId,
          type: 'STATIC',
          prefixLength: prefix
        })
      }
    }

    tables.set(node.id, entries)
  }

  // 2. OSPF Dynamic Route Propagation (Shortest Path First in OSPF Area)
  const ospfNodes = nodes.filter((n) => n.type === 'router' && n.ospf?.enabled)

  if (ospfNodes.length > 1) {
    // Build adjacencies in same OSPF areas
    const links: { sourceId: string; targetId: string; areaId: number; sourcePortId: string; targetPortId: string; sourceIp: string; targetIp: string }[] = []

    for (let i = 0; i < ospfNodes.length; i++) {
      for (let j = i + 1; j < ospfNodes.length; j++) {
        const rA = ospfNodes[i]
        const rB = ospfNodes[j]
        if (rA.ospf?.areaId !== rB.ospf?.areaId) continue
        const areaId = rA.ospf!.areaId

        if (rA.ports && rB.ports) {
          for (const pA of rA.ports) {
            for (const pB of rB.ports) {
              if (
                pA.connectedToNodeId === rB.id &&
                pA.connectedToPortId === pB.id &&
                pA.ipAddress &&
                pB.ipAddress
              ) {
                const [ipA, prefixA] = pA.ipAddress.split('/')
                const [ipB, prefixB] = pB.ipAddress.split('/')

                if (prefixA === prefixB && ipInSubnet(ipA, pB.ipAddress)) {
                  links.push({
                    sourceId: rA.id,
                    targetId: rB.id,
                    areaId,
                    sourcePortId: pA.id,
                    targetPortId: pB.id,
                    sourceIp: ipA,
                    targetIp: ipB
                  })
                }
              }
            }
          }
        }
      }
    }

    for (const startRouter of ospfNodes) {
      const startArea = startRouter.ospf!.areaId
      
      const dist = new Map<string, number>()
      const prev = new Map<string, { routerId: string; nextHopIp: string; exitPortId: string }>()
      const visited = new Set<string>()

      for (const r of ospfNodes) {
        dist.set(r.id, Infinity)
      }
      dist.set(startRouter.id, 0)

      const queue = [{ id: startRouter.id, d: 0 }]

      while (queue.length > 0) {
        queue.sort((a, b) => a.d - b.d)
        const curr = queue.shift()!
        if (visited.has(curr.id)) continue
        visited.add(curr.id)

        const activeLinks = links.filter((l) => l.areaId === startArea && (l.sourceId === curr.id || l.targetId === curr.id))
        for (const link of activeLinks) {
          const neighborId = link.sourceId === curr.id ? link.targetId : link.sourceId
          const exitPortId = link.sourceId === curr.id ? link.sourcePortId : link.targetPortId
          const nextHopIp = link.sourceId === curr.id ? link.targetIp : link.sourceIp

          const newDist = curr.d + 1
          if (newDist < (dist.get(neighborId) ?? Infinity)) {
            dist.set(neighborId, newDist)
            
            const firstHopInfo = curr.id === startRouter.id 
              ? { routerId: neighborId, nextHopIp, exitPortId }
              : prev.get(curr.id)!

            prev.set(neighborId, firstHopInfo)
            queue.push({ id: neighborId, d: newDist })
          }
        }
      }

      const startEntries = tables.get(startRouter.id) ?? []
      for (const [destRouterId, firstHop] of prev.entries()) {
        const destEntries = tables.get(destRouterId) ?? []
        const directSubnets = destEntries.filter((e) => e.type === 'DIRECT')

        for (const subnetRoute of directSubnets) {
          const alreadyDirect = startEntries.some((e) => e.type === 'DIRECT' && e.destination === subnetRoute.destination)
          if (alreadyDirect) continue

          startEntries.push({
            destination: subnetRoute.destination,
            nextHop: firstHop.nextHopIp,
            interfaceId: firstHop.exitPortId,
            type: 'OSPF',
            prefixLength: subnetRoute.prefixLength
          })
        }
      }
      tables.set(startRouter.id, startEntries)
    }
  }

  return tables
}

export function simulateRoute(
  nodes: Department[],
  sourceId: string,
  targetIp: string,
  packet?: AclPacket
): PathTraceResult {
  // Build a default packet descriptor if none provided
  const activePacket: AclPacket = packet ?? {
    protocol: 'ip',
    srcIp: nodes.find((n) => n.id === sourceId)?.subnet?.split('/')[0] ?? '0.0.0.0',
    dstIp: targetIp,
  }
  const tables = compileRoutingTables(nodes)
  const path: string[] = [sourceId]
  const hops: HopDetail[] = []

  let currentId = sourceId
  const visitedNodes = new Set<string>([sourceId])

  const getNode = (id: string) => nodes.find((n) => n.id === id)
  let currentIngress: InterfacePort | undefined = undefined

  // Track the active VLAN tag of the packet as it travels
  let currentVlan = getNode(sourceId)?.vlanId ?? 10

  // Pre-resolve target IP owner: if a specific device port owns this IP, that device is the true destination
  const portOwner = nodes.find((n) =>
    n.ports?.some((p) => p.ipAddress && p.ipAddress.split('/')[0] === targetIp)
  )

  for (let step = 0; step < 20; step++) {
    const node = getNode(currentId)
    if (!node) {
      return {
        success: false,
        path,
        hops,
        message: `Routing failed: Node not found in topology.`
      }
    }

    // Update active VLAN if entering an access port with a specific VLAN assignment
    if (currentIngress?.vlanAccessId !== undefined) {
      currentVlan = currentIngress.vlanAccessId
    }

    const hop: HopDetail = {
      nodeId: node.id,
      nodeName: node.name,
      ingressPortId: currentIngress?.id,
      ingressPortName: currentIngress?.name
    }

    let isDestination = false
    
    if (portOwner) {
      isDestination = (node.id === portOwner.id)
    } else {
      if (node.subnet && ipInSubnet(targetIp, node.subnet)) {
        isDestination = true
      }
    }

    if (isDestination) {
      hop.routeType = 'DIRECT'
      hops.push(hop)
      return {
        success: true,
        path,
        hops,
        message: `Route trace successful! Packet reached ${node.name} at IP ${targetIp}.`
      }
    }

    // ACL evaluation for firewall nodes
    if (node.type === 'firewall' && node.aclRules && node.aclRules.length > 0) {
      const verdict = evaluateAcl(node.aclRules, activePacket)
      if (verdict === 'deny') {
        const matchedRule = findMatchingRule(node.aclRules, activePacket)
        const ruleInfo = matchedRule
          ? ` (seq ${matchedRule.sequence}: ${matchedRule.action} ${matchedRule.protocol} ${matchedRule.srcCidr} → ${matchedRule.dstCidr}${matchedRule.dstPort !== undefined ? ` port ${matchedRule.dstPort}` : ''})`
          : ' (implicit deny)'
        hop.routeType = 'DIRECT'
        hop.decisionReason = {
          matchedPrefix: matchedRule?.dstCidr ?? 'any',
          prefixLength: 0,
          nextHop: 'BLOCKED',
          routeType: 'DIRECT',
          aclVerdict: 'deny',
          aclRuleSeq: matchedRule?.sequence,
        }
        hops.push(hop)
        return {
          success: false,
          path,
          hops,
          message: `Packet blocked by ACL on Firewall "${node.name}"${ruleInfo}.`
        }
      }
      // ACL permit — record the matching rule and continue forwarding
      const permitRule = findMatchingRule(node.aclRules, activePacket)
      if (permitRule) {
        hop.decisionReason = {
          matchedPrefix: permitRule.dstCidr,
          prefixLength: 0,
          nextHop: 'PERMIT',
          routeType: 'DIRECT',
          aclVerdict: 'permit',
          aclRuleSeq: permitRule.sequence,
        }
      }
    }

    // Default Gateway peer routing for client PC departments
    if ((node.type === 'department' || !node.type) && node.peers.length > 0) {
      const nextNodeId = node.peers[0]
      hop.routeType = 'DIRECT'
      hop.decisionReason = {
        matchedPrefix: node.subnet ?? '0.0.0.0/0',
        prefixLength: node.subnet ? parseInt(node.subnet.split('/')[1] ?? '24', 10) : 0,
        nextHop: 'Default Gateway',
        routeType: 'DIRECT',
        vlanId: node.vlanId,
      }

      const egressPort = node.ports?.find((p) => p.connectedToNodeId === nextNodeId)
      if (egressPort) {
        hop.egressPortId = egressPort.id
        hop.egressPortName = egressPort.name
      }

      hops.push(hop)
      
      if (visitedNodes.has(nextNodeId)) {
        return {
          success: false,
          path: [...path, nextNodeId],
          hops,
          message: `Routing loop detected! Packet returned to ${getNode(nextNodeId)?.name ?? nextNodeId}.`
        }
      }
      
      const nextNode = getNode(nextNodeId)
      currentIngress = egressPort
        ? nextNode?.ports?.find((p) => p.id === egressPort.connectedToPortId)
        : nextNode?.ports?.find((p) => p.connectedToNodeId === node.id)
      
      currentId = nextNodeId
      path.push(currentId)
      visitedNodes.add(currentId)
      continue
    }

    if (node.type === 'switch') {
      const targetNode = portOwner || nodes.find((n) => n.subnet && ipInSubnet(targetIp, n.subnet))
      const targetVlan = currentVlan // Forward dynamically inside the packet's active VLAN segment

      if (targetVlan === undefined) {
        hop.routeType = 'L2'
        hops.push(hop)
        return {
          success: false,
          path,
          hops,
          message: `L2 Switch error: Cannot determine VLAN for destination IP ${targetIp}.`
        }
      }

      const switchPorts = node.ports ?? []
      let egressPort: InterfacePort | undefined = undefined

      // 1. Prioritize a port directly connected to the targetNode
      if (targetNode) {
        egressPort = switchPorts.find((p) => p.connectedToNodeId === targetNode.id)
      }

      // 2. Fallback to any port in the target VLAN that doesn't loop back to the ingress port
      if (!egressPort) {
        for (const port of switchPorts) {
          if (
            port.connectedToNodeId &&
            port.connectedToNodeId !== currentId &&
            port.id !== currentIngress?.id // Skip the exact ingress port the packet arrived on
          ) {
            if (port.vlanMode === 'access' && port.vlanAccessId === targetVlan) {
              egressPort = port
              break
            } else if (port.vlanMode === 'trunk' && port.vlanTrunkAllowed?.includes(targetVlan)) {
              egressPort = port
              break
            }
          }
        }
      }

      if (!egressPort) {
        hop.routeType = 'L2'
        hops.push(hop)
        return {
          success: false,
          path,
          hops,
          message: `L2 Switch error: No port on Switch "${node.name}" configured for VLAN ${targetVlan}.`
        }
      }

      hop.egressPortId = egressPort.id
      hop.egressPortName = egressPort.name
      hop.routeType = 'L2'
      hops.push(hop)

      const nextNodeId = egressPort.connectedToNodeId!
      if (visitedNodes.has(nextNodeId)) {
        return {
          success: false,
          path: [...path, nextNodeId],
          hops,
          message: `Routing loop detected! Packet returned to ${getNode(nextNodeId)?.name ?? nextNodeId}.`
        }
      }

      const nextNode = getNode(nextNodeId)
      currentIngress = nextNode?.ports?.find((p) => p.id === egressPort!.connectedToPortId)
      currentId = nextNodeId
      path.push(currentId)
      visitedNodes.add(currentId)
      continue
    }

    const nodeTable = tables.get(node.id) ?? []
    const matches = nodeTable.filter((e) => ipInSubnet(targetIp, e.destination))

    if (matches.length === 0) {
      hop.routeType = 'DIRECT'
      hops.push(hop)
      return {
        success: false,
        path,
        hops,
        message: `Routing failure: Destination IP ${targetIp} is unreachable from "${node.name}" (No route found).`
      }
    }

    matches.sort((a, b) => {
      if (a.prefixLength !== b.prefixLength) {
        return b.prefixLength - a.prefixLength
      }
      const rank = (type: string) => (type === 'DIRECT' ? 0 : type === 'STATIC' ? 1 : 2)
      return rank(a.type) - rank(b.type)
    })

    const bestRoute = matches[0]
    hop.routeType = bestRoute.type
    hop.decisionReason = {
      matchedPrefix: bestRoute.destination,
      prefixLength: bestRoute.prefixLength,
      nextHop: bestRoute.nextHop,
      routeType: bestRoute.type,
    }

    if (node.type === 'router' || node.type === 'firewall') {
      const targetNode = portOwner || nodes.find((n) => n.subnet && ipInSubnet(targetIp, n.subnet))
      if (targetNode && targetNode.vlanId !== undefined) {
        currentVlan = targetNode.vlanId
      }
    }

    if (bestRoute.nextHop === 'DIRECT') {
      const egressPort = node.ports?.find((p) => p.id === bestRoute.interfaceId)
      
      if (egressPort?.connectedToNodeId) {
        hop.egressPortId = egressPort.id
        hop.egressPortName = egressPort.name
        hops.push(hop)

        const nextNodeId = egressPort.connectedToNodeId
        if (visitedNodes.has(nextNodeId)) {
          return {
            success: false,
            path: [...path, nextNodeId],
            hops,
            message: `Routing loop detected! Packet returned to ${getNode(nextNodeId)?.name ?? nextNodeId}.`
          }
        }

        const nextNode = getNode(nextNodeId)
        currentIngress = nextNode?.ports?.find((p) => p.id === egressPort.connectedToPortId)
        currentId = nextNodeId
        path.push(currentId)
        visitedNodes.add(currentId)
        continue
      }

      hops.push(hop)
      const destNode = nodes.find((n) => n.subnet && ipInSubnet(targetIp, n.subnet))
      if (destNode && destNode.id !== node.id) {
        path.push(destNode.id)
        hops.push({
          nodeId: destNode.id,
          nodeName: destNode.name,
          routeType: 'DIRECT'
        })
        return {
          success: true,
          path,
          hops,
          message: `Route successful! Packet reached ${destNode.name} at IP ${targetIp}.`
        }
      }

      return {
        success: true,
        path,
        hops,
        message: `Route successful! Packet reached destination subnet locally.`
      }
    }

    const nextHopIp = bestRoute.nextHop
    let egressPort: InterfacePort | undefined = undefined

    if (node.ports) {
      for (const port of node.ports) {
        if (port.ipAddress && ipInSubnet(nextHopIp, port.ipAddress)) {
          egressPort = port
          break
        }
      }
    }

    if (!egressPort || !egressPort.connectedToNodeId) {
      hops.push(hop)
      return {
        success: false,
        path,
        hops,
        message: `Routing error: Next-hop ${nextHopIp} is unreachable from "${node.name}" (no physical link matching next-hop subnet).`
      }
    }

    hop.egressPortId = egressPort.id
    hop.egressPortName = egressPort.name
    hops.push(hop)

    const nextNodeId = egressPort.connectedToNodeId
    if (visitedNodes.has(nextNodeId)) {
      return {
        success: false,
        path: [...path, nextNodeId],
        hops,
        message: `Routing loop detected! Packet returned to ${getNode(nextNodeId)?.name ?? nextNodeId}.`
      }
    }

    const nextNode = getNode(nextNodeId)
    currentIngress = nextNode?.ports?.find((p) => p.id === egressPort.connectedToPortId)
    currentId = nextNodeId
    path.push(currentId)
    visitedNodes.add(currentId)
  }

  return {
    success: false,
    path,
    hops,
    message: `TTL Expired: Maximum routing hop limit (20) exceeded.`
  }
}
