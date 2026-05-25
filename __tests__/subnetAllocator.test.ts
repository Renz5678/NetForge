import { allocateSubnets, checkSubnetOverlap } from '../lib/algorithms/subnetAllocator'
import type { Department } from '../types'

const makeDept = (id: string, name: string, deviceCount: number): Department => ({
  id,
  name,
  deviceCount,
  peers: [],
})

describe('subnetAllocator', () => {
  it('returns empty for empty input', () => {
    const result = allocateSubnets([], '10.0.0.0', 10)
    expect(result).toEqual([])
  })

  it('allocates correct subnet for a single department', () => {
    const depts = [makeDept('a', 'Alpha', 50)]
    const result = allocateSubnets(depts, '10.0.0.0', 10)
    expect(result[0].subnet).toBeDefined()
    // /26 = 62 usable, fits 50 devices
    expect(result[0].cidrPrefix).toBe(26)
    expect(result[0].usableHosts).toBe(62)
    expect(result[0].vlanId).toBe(10)
    expect(result[0].subnet).toBe('10.0.0.0/26')
  })

  it('allocates non-overlapping subnets for multiple departments', () => {
    const depts = [
      makeDept('a', 'Alpha', 10),   // /28 = 14 usable
      makeDept('b', 'Beta', 100),   // /25 = 126 usable
      makeDept('c', 'Gamma', 5),    // /29 = 6 usable
    ]
    const result = allocateSubnets(depts, '10.0.0.0', 10)
    expect(result.length).toBe(3)
    result.forEach((d) => {
      expect(d.subnet).toBeDefined()
      expect(d.vlanId).toBeDefined()
    })
    // VLANs should be sequential
    expect(result[0].vlanId).toBe(10)
    expect(result[1].vlanId).toBe(20)
    expect(result[2].vlanId).toBe(30)

    // No overlaps
    const { overlapping } = checkSubnetOverlap(result)
    expect(overlapping).toBe(false)
  })

  it('assigns minimum /30 for 1 device', () => {
    const depts = [makeDept('a', 'Alpha', 1)]
    const result = allocateSubnets(depts, '192.168.0.0', 100)
    expect(result[0].cidrPrefix).toBe(30)
    expect(result[0].usableHosts).toBe(2)
  })

  it('assigns /8 for the maximum device count', () => {
    const depts = [makeDept('a', 'Alpha', 16_000_000)]
    const result = allocateSubnets(depts, '10.0.0.0', 10)
    expect(result[0].cidrPrefix).toBe(8)
  })

  it('throws for device count exceeding maximum', () => {
    const depts = [makeDept('a', 'Alpha', 20_000_000)]
    expect(() => allocateSubnets(depts, '10.0.0.0', 10)).toThrow()
  })

  it('advances pointer correctly between departments', () => {
    const depts = [
      makeDept('a', 'Alpha', 2),  // /30 = 4 addresses (starts at 10.0.0.0)
      makeDept('b', 'Beta', 2),   // /30 = next 4 addresses (starts at 10.0.0.4)
    ]
    const result = allocateSubnets(depts, '10.0.0.0', 10)
    // Both /30 so no alignment needed — sequential
    expect(result[0].subnet).toBe('10.0.0.0/30')
    expect(result[1].subnet).toBe('10.0.0.4/30')
  })
})

describe('checkSubnetOverlap', () => {
  it('detects overlapping subnets', () => {
    const depts: Department[] = [
      { ...makeDept('a', 'Alpha', 10), subnet: '10.0.0.0/24', cidrPrefix: 24 },
      { ...makeDept('b', 'Beta', 10), subnet: '10.0.0.128/25', cidrPrefix: 25 },
    ]
    const result = checkSubnetOverlap(depts)
    expect(result.overlapping).toBe(true)
    expect(result.conflicts.length).toBeGreaterThan(0)
  })

  it('returns no conflict for non-overlapping subnets', () => {
    const depts: Department[] = [
      { ...makeDept('a', 'Alpha', 10), subnet: '10.0.0.0/24', cidrPrefix: 24 },
      { ...makeDept('b', 'Beta', 10), subnet: '10.0.1.0/24', cidrPrefix: 24 },
    ]
    const result = checkSubnetOverlap(depts)
    expect(result.overlapping).toBe(false)
  })
})
