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

import { ipToUint32, uint32ToIp, ipInSubnet } from '../lib/ipUtils'
import {
  compileRoutingTables,
  simulateRoute,
} from '../lib/algorithms/routingSimulator'
import type { Department } from '../types'
import { getDemoEnterpriseConfig } from '../stores/useConfigStore'
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
    const routerA: Department = {
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

    const routerB: Department = {
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
    const pc1: Department = {
      id: 'pc_1',
      name: 'ClientDept',
      deviceCount: 10,
      peers: ['sw_1'],
      subnet: '10.0.1.0/24',
      vlanId: 10,
    }

    const sw1: Department = {
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

    const rt1: Department = {
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
    const clientDepts = depts.filter((d) => d.type === 'department' || !d.type)
    expect(clientDepts.length).toBeGreaterThan(1)

    for (const src of clientDepts) {
      for (const dest of clientDepts) {
        if (src.id === dest.id) continue
        expect(dest.subnet).toBeDefined()
        
        const [baseIp] = dest.subnet!.split('/')
        const ipParts = baseIp.split('.').map((p) => parseInt(p, 10))
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
})
