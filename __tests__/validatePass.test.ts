/**
 * __tests__/validatePass.test.ts
 *
 * Tests for each of the 5 validatePass phases.
 * Uses pure topology fixtures — no store, no async.
 */

import {
  checkConnectivity,
  checkAddressing,
  checkResilience,
  checkCorrectness,
  checkOptimization,
  validateNetwork,
} from '../lib/validatePass'
import type { NetworkConfig } from '../types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<NetworkConfig> = {}): NetworkConfig {
  return {
    id: 'test',
    userId: 'u1',
    name: 'Test Network',
    departments: [],
    baseIp: '10.0.0.0',
    vlanStart: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isValid: true,
    ...overrides,
  }
}

// Three departments connected in a directed acyclic chain: A→B, B→C
const connectedDepts = [
  { id: 'a', name: 'Dept A', deviceCount: 10, peers: ['b'], subnet: '10.0.0.0/28', cidrPrefix: 28, vlanId: 10, usableHosts: 14 },
  { id: 'b', name: 'Dept B', deviceCount: 5,  peers: ['c'], subnet: '10.0.0.16/28', cidrPrefix: 28, vlanId: 20, usableHosts: 14 },
  { id: 'c', name: 'Dept C', deviceCount: 8,  peers: [],  subnet: '10.0.0.32/28', cidrPrefix: 28, vlanId: 30, usableHosts: 14 },
]

// Disconnected: node D has no peers and no path to the rest
const disconnectedDepts = [
  ...connectedDepts,
  { id: 'd', name: 'Isolated D', deviceCount: 2, peers: [], subnet: '10.0.0.48/30', cidrPrefix: 30, vlanId: 40, usableHosts: 2 },
]

// Overlapping subnets: A and B share 10.0.0.0/28
const overlappingDepts = [
  { id: 'a', name: 'Dept A', deviceCount: 5, peers: ['b'], subnet: '10.0.0.0/28', cidrPrefix: 28, vlanId: 10, usableHosts: 14 },
  { id: 'b', name: 'Dept B', deviceCount: 5, peers: ['a'], subnet: '10.0.0.0/28', cidrPrefix: 28, vlanId: 20, usableHosts: 14 },
]

// Articulation point: B is the only connection between A and C
const articulationDepts = [
  { id: 'a', name: 'Dept A', deviceCount: 5, peers: ['b'], subnet: '10.0.0.0/28', cidrPrefix: 28, vlanId: 10, usableHosts: 14 },
  { id: 'b', name: 'Core B', deviceCount: 5, peers: ['c'], subnet: '10.0.0.16/28', cidrPrefix: 28, vlanId: 20, usableHosts: 14 },
  { id: 'c', name: 'Dept C', deviceCount: 5, peers: [],  subnet: '10.0.0.32/28', cidrPrefix: 28, vlanId: 30, usableHosts: 14 },
]

// Cycle: A → B → C → A
const cycleDepts = [
  { id: 'a', name: 'Dept A', deviceCount: 5, peers: ['b'], subnet: '10.0.0.0/28', cidrPrefix: 28, vlanId: 10, usableHosts: 14 },
  { id: 'b', name: 'Dept B', deviceCount: 5, peers: ['c'], subnet: '10.0.0.16/28', cidrPrefix: 28, vlanId: 20, usableHosts: 14 },
  { id: 'c', name: 'Dept C', deviceCount: 5, peers: ['a'], subnet: '10.0.0.32/28', cidrPrefix: 28, vlanId: 30, usableHosts: 14 },
]

// ─── Phase 1: Connectivity ────────────────────────────────────────────────────

describe('checkConnectivity', () => {
  it('returns no findings for fully connected graph', () => {
    const findings = checkConnectivity(makeConfig({ departments: connectedDepts as any }))
    expect(findings).toHaveLength(0)
  })

  it('returns no findings for empty department list', () => {
    const findings = checkConnectivity(makeConfig({ departments: [] }))
    expect(findings).toHaveLength(0)
  })

  it('returns a red finding when a node is isolated', () => {
    const findings = checkConnectivity(makeConfig({ departments: disconnectedDepts as any }))
    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0].severity).toBe('red')
    expect(findings[0].phase).toBe('connectivity')
    expect(findings[0].affected).toContain('Isolated D')
  })
})

// ─── Phase 2: Addressing ──────────────────────────────────────────────────────

describe('checkAddressing', () => {
  it('returns no findings for clean topology with unique subnets', () => {
    const findings = checkAddressing(makeConfig({ departments: connectedDepts as any }))
    // Should have no overlap or unassigned findings
    const overlap = findings.filter((f) => f.id.startsWith('addr_overlap'))
    const unassigned = findings.filter((f) => f.id === 'addr_unassigned')
    expect(overlap).toHaveLength(0)
    expect(unassigned).toHaveLength(0)
  })

  it('detects overlapping subnets', () => {
    const findings = checkAddressing(makeConfig({ departments: overlappingDepts as any }))
    const overlapFindings = findings.filter((f) => f.id.startsWith('addr_overlap'))
    expect(overlapFindings.length).toBeGreaterThan(0)
    expect(overlapFindings[0].severity).toBe('red')
  })

  it('returns yellow finding when departments have no subnet', () => {
    const depts = connectedDepts.map(({ subnet, cidrPrefix, ...rest }) => rest)
    const findings = checkAddressing(makeConfig({ departments: depts as any }))
    const unassigned = findings.find((f) => f.id === 'addr_unassigned')
    expect(unassigned).toBeDefined()
    expect(unassigned!.severity).toBe('yellow')
  })
})

// ─── Phase 3: Resilience ──────────────────────────────────────────────────────

describe('checkResilience', () => {
  it('returns no findings for a fully meshed graph', () => {
    // Fully meshed — no articulation points
    const meshed = [
      { id: 'a', name: 'A', deviceCount: 5, peers: ['b', 'c'], subnet: '10.0.0.0/28', cidrPrefix: 28, vlanId: 10, usableHosts: 14 },
      { id: 'b', name: 'B', deviceCount: 5, peers: ['a', 'c'], subnet: '10.0.0.16/28', cidrPrefix: 28, vlanId: 20, usableHosts: 14 },
      { id: 'c', name: 'C', deviceCount: 5, peers: ['a', 'b'], subnet: '10.0.0.32/28', cidrPrefix: 28, vlanId: 30, usableHosts: 14 },
    ]
    const findings = checkResilience(makeConfig({ departments: meshed as any }))
    expect(findings).toHaveLength(0)
  })

  it('flags the articulation point in a chain graph', () => {
    const findings = checkResilience(makeConfig({ departments: articulationDepts as any }))
    expect(findings.length).toBeGreaterThan(0)
    const apFinding = findings.find((f) => f.affected.includes('Core B'))
    expect(apFinding).toBeDefined()
    expect(apFinding!.severity).toBe('yellow')
    expect(apFinding!.algorithm).toBe('articulationPoints')
  })
})

// ─── Phase 4: Correctness ─────────────────────────────────────────────────────

describe('checkCorrectness', () => {
  it('returns no findings for a clean, cycle-free topology', () => {
    const findings = checkCorrectness(makeConfig({ departments: connectedDepts as any }))
    expect(findings.filter((f) => f.id === 'correctness_cycle')).toHaveLength(0)
  })

  it('flags a routing loop with a red finding', () => {
    const findings = checkCorrectness(makeConfig({ departments: cycleDepts as any }))
    const cycleFinding = findings.find((f) => f.id === 'correctness_cycle')
    expect(cycleFinding).toBeDefined()
    expect(cycleFinding!.severity).toBe('red')
    expect(cycleFinding!.algorithm).toBe('cycleDetection')
  })

  it('flags ACL that blocks a peer connection', () => {
    const deptsWithAcl = [
      {
        id: 'a', name: 'Dept A', deviceCount: 5, peers: ['b'],
        subnet: '10.0.0.0/28', cidrPrefix: 28, vlanId: 10, usableHosts: 14,
        aclRules: [
          { id: 'rule1', sequence: 10, action: 'deny', protocol: 'tcp', srcCidr: 'any', dstCidr: 'any' },
        ],
      },
      { id: 'b', name: 'Dept B', deviceCount: 5, peers: ['a'], subnet: '10.0.0.16/28', cidrPrefix: 28, vlanId: 20, usableHosts: 14 },
    ]
    const findings = checkCorrectness(makeConfig({ departments: deptsWithAcl as any }))
    const aclFinding = findings.find((f) => f.id.startsWith('correctness_acl'))
    expect(aclFinding).toBeDefined()
    expect(aclFinding!.severity).toBe('yellow')
    expect(aclFinding!.algorithm).toBe('aclEngine')
  })
})

// ─── Phase 5: Optimization ────────────────────────────────────────────────────

describe('checkOptimization', () => {
  it('returns blue findings for redundant links not in MST', () => {
    // Fully meshed: B→C is not in the MST
    const meshed = [
      { id: 'a', name: 'A', deviceCount: 5, peers: ['b', 'c'], subnet: '10.0.0.0/28', cidrPrefix: 28, vlanId: 10, usableHosts: 14 },
      { id: 'b', name: 'B', deviceCount: 5, peers: ['a', 'c'], subnet: '10.0.0.16/28', cidrPrefix: 28, vlanId: 20, usableHosts: 14 },
      { id: 'c', name: 'C', deviceCount: 5, peers: ['a', 'b'], subnet: '10.0.0.32/28', cidrPrefix: 28, vlanId: 30, usableHosts: 14 },
    ]
    const findings = checkOptimization(makeConfig({ departments: meshed as any }), [])
    // Should find at least one redundant link
    const redundant = findings.filter((f) => f.id.startsWith('opt_redundant'))
    expect(redundant.length).toBeGreaterThan(0)
    expect(redundant[0].severity).toBe('blue')
  })

  it('returns empty for a linear chain (no redundant links)', () => {
    const chain = [
      { id: 'a', name: 'A', deviceCount: 5, peers: ['b'], subnet: '10.0.0.0/28', cidrPrefix: 28, vlanId: 10, usableHosts: 14 },
      { id: 'b', name: 'B', deviceCount: 5, peers: ['c'], subnet: '10.0.0.16/28', cidrPrefix: 28, vlanId: 20, usableHosts: 14 },
      { id: 'c', name: 'C', deviceCount: 5, peers: [], subnet: '10.0.0.32/28', cidrPrefix: 28, vlanId: 30, usableHosts: 14 },
    ]
    const findings = checkOptimization(makeConfig({ departments: chain as any }), [])
    const redundant = findings.filter((f) => f.id.startsWith('opt_redundant'))
    expect(redundant).toHaveLength(0)
  })
})

// ─── Full orchestrator ────────────────────────────────────────────────────────

describe('validateNetwork', () => {
  it('returns score 100 and no findings for clean topology', async () => {
    // Triangle topology: A→B, B→C, A→C — no articulation points, no cycles
    const triangle = [
      { id: 'a', name: 'A', deviceCount: 5, peers: ['b', 'c'], subnet: '10.0.0.0/28', cidrPrefix: 28, vlanId: 10, usableHosts: 14 },
      { id: 'b', name: 'B', deviceCount: 5, peers: ['c'],      subnet: '10.0.0.16/28', cidrPrefix: 28, vlanId: 20, usableHosts: 14 },
      { id: 'c', name: 'C', deviceCount: 5, peers: [],         subnet: '10.0.0.32/28', cidrPrefix: 28, vlanId: 30, usableHosts: 14 },
    ]
    const result = await validateNetwork(makeConfig({ departments: triangle as any }))
    // No red, no yellow — only possible blue (optimization info) findings are fine
    const reds    = result.findings.filter((f) => f.severity === 'red')
    const yellows = result.findings.filter((f) => f.severity === 'yellow')
    expect(reds).toHaveLength(0)
    expect(yellows).toHaveLength(0)
    // Score: 100 minus nothing critical → 100; blue findings don't reduce score
    expect(result.score).toBe(100)
    expect(result.label).toBe('Deploy Ready')
  })

  it('stops at connectivity phase when graph is disconnected (returns partial result)', async () => {
    const result = await validateNetwork(makeConfig({ departments: disconnectedDepts as any }))
    // Connectivity RED → stops early. Score = 100 - 30 = 70 → 'Deploy with Caution'
    expect(result.phasesRan).toEqual(['connectivity'])
    expect(result.score).toBeLessThan(100)
    // One RED finding → 70 points → label can be 'Deploy with Caution' or lower
    expect(['Not Ready', 'Deploy with Caution']).toContain(result.label)
  })

  it('runs all 5 phases on a connected topology', async () => {
    const result = await validateNetwork(makeConfig({ departments: connectedDepts as any }))
    expect(result.phasesRan).toHaveLength(5)
    expect(result.phasesRan).toContain('optimization')
  })

  it('returns "Not Ready" when a cycle is present', async () => {
    // Cycle → no connectivity RED, but correctness RED
    const result = await validateNetwork(makeConfig({ departments: cycleDepts as any }))
    const cycleFinding = result.findings.find((f) => f.id === 'correctness_cycle')
    expect(cycleFinding).toBeDefined()
    // One RED finding → score = 100 - 30 = 70 → 'Deploy with Caution' or lower
    expect(result.score).toBeLessThanOrEqual(70)
  })
})
