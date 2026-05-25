import { generateCiscoConfig, generateFullTopologyConfig } from '../lib/configGenerator'
import type { Department, NetworkConfig, AclRule } from '../types'

const makeRouter = (): Department => ({
  id: 'router1',
  name: 'Core Router',
  deviceCount: 0,
  peers: ['switch1'],
  type: 'router',
  ospf: { enabled: true, areaId: 0 },
  ports: [
    {
      id: 'p1',
      name: 'GigabitEthernet0/0',
      ipAddress: '10.0.0.1/24',
      connectedToNodeId: 'switch1',
    },
    {
      id: 'p2',
      name: 'GigabitEthernet0/1',
      ipAddress: '192.168.1.1/30',
    },
  ],
  staticRoutes: [{ destination: '0.0.0.0/0', nextHop: '192.168.1.2' }],
})

const makeSwitch = (): Department => ({
  id: 'switch1',
  name: 'Access Switch',
  deviceCount: 0,
  peers: ['router1', 'dept1'],
  type: 'switch',
  ports: [
    { id: 'p1', name: 'FastEthernet0/1', vlanMode: 'access', vlanAccessId: 10, connectedToNodeId: 'router1' },
    { id: 'p2', name: 'FastEthernet0/2', vlanMode: 'trunk', vlanTrunkAllowed: [10, 20], connectedToNodeId: 'dept1' },
  ],
})

const makeFirewall = (): Department => ({
  id: 'fw1',
  name: 'Edge Firewall',
  deviceCount: 0,
  peers: [],
  type: 'firewall',
  ports: [
    { id: 'p1', name: 'GigabitEthernet0/0', ipAddress: '203.0.113.1/30' },
  ],
  aclRules: [
    { id: 'r1', sequence: 10, action: 'deny', protocol: 'tcp', srcCidr: 'any', dstCidr: 'any', dstPort: 80 },
    { id: 'r2', sequence: 20, action: 'permit', protocol: 'ip', srcCidr: '10.0.0.0/8', dstCidr: 'any' },
  ] as AclRule[],
})

const makeDept = (): Department => ({
  id: 'dept1',
  name: 'Engineering',
  deviceCount: 30,
  peers: ['switch1'],
  type: 'department',
  subnet: '10.0.10.0/24',
  vlanId: 10,
  cidrPrefix: 24,
  usableHosts: 254,
})

describe('configGenerator — generateCiscoConfig (Router)', () => {
  const router = makeRouter()
  const config = generateCiscoConfig(router, [router])

  it('contains hostname line', () => {
    expect(config).toContain('hostname Core_Router')
  })

  it('contains interface block with ip address', () => {
    expect(config).toContain('interface GigabitEthernet0/0')
    expect(config).toContain('ip address 10.0.0.1 255.255.255.0')
  })

  it('contains router ospf block', () => {
    expect(config).toContain('router ospf 1')
  })

  it('contains static route', () => {
    expect(config).toContain('ip route 0.0.0.0 0.0.0.0 192.168.1.2')
  })
})

describe('configGenerator — generateCiscoConfig (Switch)', () => {
  const sw = makeSwitch()
  const config = generateCiscoConfig(sw, [sw])

  it('contains hostname line', () => {
    expect(config).toContain('hostname Access_Switch')
  })

  it('contains vlan block', () => {
    expect(config).toContain('vlan 10')
    expect(config).toContain('vlan 20')
  })

  it('contains access port config', () => {
    expect(config).toContain('interface FastEthernet0/1')
    expect(config).toContain('switchport mode access')
    expect(config).toContain('switchport access vlan 10')
  })

  it('contains trunk port config', () => {
    expect(config).toContain('switchport mode trunk')
    expect(config).toContain('switchport trunk allowed vlan 10,20')
  })
})

describe('configGenerator — generateCiscoConfig (Firewall)', () => {
  const fw = makeFirewall()
  const config = generateCiscoConfig(fw, [fw])

  it('contains named ACL block', () => {
    expect(config).toContain('ip access-list extended NETFORGE_FW_EDGE_FIREWALL')
  })

  it('deny rule appears before permit rule', () => {
    const denyIdx = config.indexOf('deny tcp')
    const permitIdx = config.indexOf('permit ip')
    expect(denyIdx).toBeGreaterThanOrEqual(0)
    expect(permitIdx).toBeGreaterThanOrEqual(0)
    expect(denyIdx).toBeLessThan(permitIdx)
  })

  it('applies ACL to interface', () => {
    expect(config).toContain('ip access-group NETFORGE_FW_EDGE_FIREWALL in')
  })
})

describe('configGenerator — generateFullTopologyConfig', () => {
  const router = makeRouter()
  const sw = makeSwitch()
  const fw = makeFirewall()
  const dept = makeDept()

  const networkConfig: NetworkConfig = {
    id: 'cfg1',
    userId: 'user1',
    name: 'Test Topology',
    departments: [dept, sw, router, fw],
    baseIp: '10.0.0.0',
    vlanStart: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isValid: true,
  }

  const fullConfig = generateFullTopologyConfig(networkConfig)

  it('contains a banner for each device', () => {
    expect(fullConfig).toContain('!--- Device: Edge Firewall ---!')
    expect(fullConfig).toContain('!--- Device: Core Router ---!')
    expect(fullConfig).toContain('!--- Device: Access Switch ---!')
    expect(fullConfig).toContain('!--- Device: Engineering ---!')
  })

  it('WAN/Firewall devices come before Routers/Switches/Departments in output', () => {
    const fwIdx = fullConfig.indexOf('!--- Device: Edge Firewall ---!')
    const routerIdx = fullConfig.indexOf('!--- Device: Core Router ---!')
    const deptIdx = fullConfig.indexOf('!--- Device: Engineering ---!')
    expect(fwIdx).toBeLessThan(routerIdx)
    expect(routerIdx).toBeLessThan(deptIdx)
  })

  it('contains topology header comment', () => {
    expect(fullConfig).toContain('NetForge — Cisco IOS Configuration Export')
    expect(fullConfig).toContain('Topology: Test Topology')
  })

  it('ends with "! end"', () => {
    expect(fullConfig.trimEnd()).toMatch(/! end$/)
  })
})
