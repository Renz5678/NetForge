jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}))
jest.mock('@/lib/supabase', () => ({
  supabase: {},
}))
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
    fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  },
}))

import { ipToUint32, uint32ToIp, ipInSubnet } from '../lib/ipUtils'
import {
  compileRoutingTables,
  simulateRoute,
} from '../lib/algorithms/routingSimulator'
import type { NetworkNode } from '../types'
import { getDemoEnterpriseConfig } from '../stores/demoData'
import { detectCycles } from '../lib/algorithms/cycleDetection'
import { checkSubnetOverlap } from '../lib/algorithms/subnetAllocator'
import { validateConnectivity } from '../lib/algorithms/bfsValidator'

describe('routingSimulator tests', () => {
  test('IP conversion helpers', () => {
    expect(ipToUint32('10.0.0.1')).toBe(167772161)
    expect(uint32ToIp(167772161)).toBe('10.0.0.1')
    expect(ipToUint32('255.255.255.255')).toBe(4294967295)
    expect(uint32ToIp(4294967295)).toBe('255.255.255.255')
  })

  test('ipInSubnet checks', () => {
    expect(ipInSubnet('10.0.0.5', '10.0.0.0/24')).toBe(true)
    expect(ipInSubnet('10.0.1.5', '10.0.0.0/24')).toBe(false)
    expect(ipInSubnet('10.0.0.129', '10.0.0.128/25')).toBe(true)
    expect(ipInSubnet('10.0.0.1', '10.0.0.128/25')).toBe(false)
  })

  test('Longest Prefix Match & Dynamic OSPF area exchanges', () => {
    // Construct two OSPF routers connected together
    const routerA: NetworkNode = {
      id: 'rt_a',
      name: 'RouterA',
      deviceCount: 0,
      peers: ['rt_b'],
      type: 'router',
      ports: [
        {
          id: 'port_a_1',
          name: 'GigabitEthernet0/0',
          ipAddress: '10.0.0.1/24',
          connectedToNodeId: 'rt_b',
          connectedToPortId: 'port_b_1',
        },
        {
          id: 'port_a_2',
          name: 'GigabitEthernet0/1',
          ipAddress: '10.0.1.1/24', // directly connected subnet A
        },
      ],
      ospf: { enabled: true, areaId: 0 },
    }

    const routerB: NetworkNode = {
      id: 'rt_b',
      name: 'RouterB',
      deviceCount: 0,
      peers: ['rt_a'],
      type: 'router',
      ports: [
        {
          id: 'port_b_1',
          name: 'GigabitEthernet0/0',
          ipAddress: '10.0.0.2/24',
          connectedToNodeId: 'rt_a',
          connectedToPortId: 'port_a_1',
        },
        {
          id: 'port_b_2',
          name: 'GigabitEthernet0/1',
          ipAddress: '10.0.2.1/24', // directly connected subnet B
        },
      ],
      ospf: { enabled: true, areaId: 0 },
    }

    const nodes = [routerA, routerB]
    const tables = compileRoutingTables(nodes)

    const tableA = tables.get('rt_a') ?? []
    const tableB = tables.get('rt_b') ?? []

    // Router A should dynamically learn Router B's subnet 10.0.2.0/24 via OSPF!
    const ospfRouteOnA = tableA.find((e) => e.type === 'OSPF')
    expect(ospfRouteOnA).toBeDefined()
    expect(ospfRouteOnA?.destination).toBe('10.0.2.0/24')
    expect(ospfRouteOnA?.nextHop).toBe('10.0.0.2')

    // Router B should dynamically learn Router A's subnet 10.0.1.0/24 via OSPF!
    const ospfRouteOnB = tableB.find((e) => e.type === 'OSPF')
    expect(ospfRouteOnB).toBeDefined()
    expect(ospfRouteOnB?.destination).toBe('10.0.1.0/24')
    expect(ospfRouteOnB?.nextHop).toBe('10.0.0.1')
  })

  test('End-to-End Route Tracing with switch and loop detection', () => {
    const pc1: NetworkNode = {
      id: 'pc_1',
      name: 'ClientDept',
      deviceCount: 10,
      peers: ['sw_1'],
      type: 'department',
      subnet: '10.0.1.0/24',
      vlanId: 10,
    }

    const sw1: NetworkNode = {
      id: 'sw_1',
      name: 'Switch1',
      deviceCount: 0,
      peers: ['pc_1', 'rt_1'],
      type: 'switch',
      ports: [
        {
          id: 'sw_p1',
          name: 'FastEthernet0/1',
          vlanMode: 'access',
          vlanAccessId: 10,
          connectedToNodeId: 'pc_1',
        },
        {
          id: 'sw_p24',
          name: 'FastEthernet0/24',
          vlanMode: 'access',
          vlanAccessId: 10,
          connectedToNodeId: 'rt_1',
          connectedToPortId: 'rt_p1',
        },
      ],
    }

    const rt1: NetworkNode = {
      id: 'rt_1',
      name: 'Router1',
      deviceCount: 0,
      peers: ['sw_1'],
      type: 'router',
      ports: [
        {
          id: 'rt_p1',
          name: 'GigabitEthernet0/0',
          ipAddress: '10.0.1.254/24',
          connectedToNodeId: 'sw_1',
          connectedToPortId: 'sw_p24',
        },
      ],
      staticRoutes: [
        { destination: '192.168.5.0/24', nextHop: '10.0.1.1' }, // Dummy route
      ],
    }

    const nodes = [pc1, sw1, rt1]

    // Trace from PC1 to the Router1 interface IP 10.0.1.254
    const trace = simulateRoute(nodes, 'pc_1', '10.0.1.254')
    expect(trace.success).toBe(true)
    expect(trace.path).toContain('sw_1')
    expect(trace.path).toContain('rt_1')

    // Trace to a blackhole IP (completely unreachable subnet)
    const badTrace = simulateRoute(nodes, 'pc_1', '172.16.0.5')
    expect(badTrace.success).toBe(false)
    expect(badTrace.message).toContain('No route found')
  })

  test('Demo Enterprise Config V4 passes all validation checks and routing simulations', () => {
    const config = getDemoEnterpriseConfig('test-user')
    const depts = config.departments

    // 1. Cycle Check
    const cycleRes = detectCycles(depts)
    expect(cycleRes.hasCycle).toBe(false)

    // 2. Subnet Overlap Check
    const overlapRes = checkSubnetOverlap(depts)
    expect(overlapRes.overlapping).toBe(false)
    expect(overlapRes.conflicts).toEqual([])

    // 3. Connectivity Check (BFS)
    const connRes = validateConnectivity(depts)
    expect(connRes.allReachable).toBe(true)
    expect(connRes.isolated).toEqual([])

    // 4. Routing Trace between all client departments
    const clientDepts = depts.filter((d: NetworkNode) => d.type === 'department' || !d.type)
    expect(clientDepts.length).toBeGreaterThan(1)

    for (const src of clientDepts) {
      for (const dest of clientDepts) {
        if (src.id === dest.id) continue
        expect(dest.subnet).toBeDefined()
        
        const [baseIp] = dest.subnet!.split('/')
        const ipParts = baseIp.split('.').map((p: string) => parseInt(p, 10))
        ipParts[3] += 1 // Use host IP (e.g., 10.0.0.65)
        const destHostIp = ipParts.join('.')

        const trace = simulateRoute(depts, src.id, destHostIp)
        if (!trace.success) {
          console.error(`FAILED TRACE from ${src.name} to ${dest.name} (${destHostIp}):`, trace.message)
        }
        expect(trace.success).toBe(true)
      }
    }
  })

  // ── Task 4 Edge-Case Tests ──────────────────────────────────────────────────

  test('OSPF: routers in the same area but physically disconnected do not exchange routes', () => {
    // Two OSPF routers share areaId=0 but have NO physical link between them.
    // The OSPF propagation code requires connectedToNodeId/connectedToPortId to
    // form an adjacency, so no OSPF routes should appear on either router.
    const routerA: NetworkNode = {
      id: 'router_a',
      name: 'RouterA',
      deviceCount: 0,
      peers: [],  // No peers — physically isolated
      type: 'router',
      ports: [
        {
          id: 'port_a_1',
          name: 'GigabitEthernet0/0',
          ipAddress: '10.1.0.1/30',
          // connectedToNodeId is intentionally absent — no physical link
        },
      ],
      ospf: { enabled: true, areaId: 0 },
    }

    const routerB: NetworkNode = {
      id: 'router_b',
      name: 'RouterB',
      deviceCount: 0,
      peers: [],  // No peers — physically isolated
      type: 'router',
      ports: [
        {
          id: 'port_b_1',
          name: 'GigabitEthernet0/0',
          ipAddress: '10.2.0.1/30',
          // connectedToNodeId is intentionally absent — no physical link
        },
      ],
      ospf: { enabled: true, areaId: 0 },
    }

    const tables = compileRoutingTables([routerA, routerB])

    const tableA = tables.get('router_a') ?? []
    const tableB = tables.get('router_b') ?? []

    // Neither router should have any OSPF entry — they share the area ID but
    // have no physical adjacency through which to form an OSPF neighbour session.
    const ospfOnA = tableA.find((e) => e.type === 'OSPF')
    const ospfOnB = tableB.find((e) => e.type === 'OSPF')

    expect(ospfOnA).toBeUndefined()
    expect(ospfOnB).toBeUndefined()

    // Each should still have its own DIRECT route.
    const directOnA = tableA.find((e) => e.type === 'DIRECT')
    const directOnB = tableB.find((e) => e.type === 'DIRECT')
    expect(directOnA).toBeDefined()
    expect(directOnB).toBeDefined()
  })

  test('LPM: uses 0.0.0.0/0 default route when no more-specific match exists', () => {
    // A router has a specific static route (10.0.0.0/24 → DIRECT) and a
    // default route (0.0.0.0/0 → 10.0.0.2). A packet destined for 8.8.8.8
    // matches only the default route (prefixLength=0, lowest specificity).
    const router: NetworkNode = {
      id: 'rt_main',
      name: 'MainRouter',
      deviceCount: 0,
      peers: ['sw_edge'],
      type: 'router',
      ports: [
        {
          id: 'rt_port_1',
          name: 'GigabitEthernet0/0',
          ipAddress: '10.0.0.1/24',
          connectedToNodeId: 'sw_edge',
          connectedToPortId: 'sw_port_1',
        },
      ],
      staticRoutes: [
        // More-specific: matches 10.0.0.0/24 traffic directly
        { destination: '10.0.0.0/24', nextHop: 'DIRECT' },
        // Default: catches everything else (e.g. public internet)
        { destination: '0.0.0.0/0', nextHop: '10.0.0.2' },
      ],
    }

    const sw: NetworkNode = {
      id: 'sw_edge',
      name: 'EdgeSwitch',
      deviceCount: 0,
      peers: ['rt_main'],
      type: 'switch',
      ports: [
        {
          id: 'sw_port_1',
          name: 'FastEthernet0/1',
          connectedToNodeId: 'rt_main',
          connectedToPortId: 'rt_port_1',
        },
      ],
    }

    const tables = compileRoutingTables([router, sw])
    const routerTable = tables.get('rt_main') ?? []

    // Confirm the default route exists in the compiled table with prefixLength=0
    const defaultRoute = routerTable.find(
      (e) => e.destination === '0.0.0.0/0' && e.prefixLength === 0
    )
    expect(defaultRoute).toBeDefined()
    expect(defaultRoute?.nextHop).toBe('10.0.0.2')

    // Simulate a route to 8.8.8.8 — a public IP that matches only 0.0.0.0/0.
    // The simulator will fail (next-hop 10.0.0.2 is not a node ID), but the
    // first hop's decisionReason should record 0.0.0.0/0 as the matched prefix.
    const result = simulateRoute([router, sw], 'rt_main', '8.8.8.8')

    // Should fail — 10.0.0.2 is not reachable as a node in this topology
    expect(result.success).toBe(false)

    // The first hop decision should record 0.0.0.0/0 as the LPM match
    const firstHop = result.hops?.[0]
    expect(firstHop).toBeDefined()
    expect(firstHop?.decisionReason?.matchedPrefix).toBe('0.0.0.0/0')
  })

  test('TTL: simulateRoute returns TTL-expired after 20 hops on a linear chain', () => {
    // Build a chain of 21 routers: r0 → r1 → ... → r20.
    // Each router has a static route pointing to the next hop's subnet, so the
    // simulator will traverse hops until the TTL guard (step < 20) fires and
    // returns an explicit "TTL Expired" failure message.
    const CHAIN_LENGTH = 21
    const nodes: NetworkNode[] = []

    for (let i = 0; i < CHAIN_LENGTH; i++) {
      const isLast = i === CHAIN_LENGTH - 1
      const ports = []

      if (i > 0) {
        // Incoming port from the previous router
        ports.push({
          id: `r${i}_in`,
          name: `GigabitEthernet0/0`,
          ipAddress: `10.${i - 1}.0.2/30`,
          connectedToNodeId: `r${i - 1}`,
          connectedToPortId: `r${i - 1}_out`,
        })
      }

      if (!isLast) {
        // Outgoing port to the next router
        ports.push({
          id: `r${i}_out`,
          name: `GigabitEthernet0/1`,
          ipAddress: `10.${i}.0.1/30`,
          connectedToNodeId: `r${i + 1}`,
          connectedToPortId: `r${i + 1}_in`,
        })
      }

      const staticRoutes = isLast
        ? []
        : [
            {
              // Route to the final router's subnet, forcing the packet forward
              destination: `10.${CHAIN_LENGTH - 1}.0.0/30`,
              nextHop: `10.${i}.0.2`,
            },
          ]

      const peers: string[] = []
      if (i > 0) peers.push(`r${i - 1}`)
      if (!isLast) peers.push(`r${i + 1}`)

      nodes.push({
        id: `r${i}`,
        name: `Router${i}`,
        deviceCount: 0,
        peers,
        type: 'router',
        ports,
        staticRoutes,
      })
    }

    // Target IP belongs to the final router's subnet
    const targetIp = `10.${CHAIN_LENGTH - 1}.0.1`
    const result = simulateRoute(nodes, 'r0', targetIp)

    // TTL must expire — chain is 21 hops but the limit is 20
    expect(result.success).toBe(false)
    expect(result.message).toContain('TTL Expired')
  })
})
