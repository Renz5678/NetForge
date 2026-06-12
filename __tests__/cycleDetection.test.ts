import { detectCycles } from '../lib/algorithms/cycleDetection'
import type { NetworkNode } from '../types'

const makeDept = (id: string, name: string, peers: string[]): NetworkNode => ({
  id,
  name,
  deviceCount: 10,
  peers,
  type: 'department' as const,
})

describe('cycleDetection', () => {
  it('returns no cycle for empty input', () => {
    const result = detectCycles([])
    expect(result.hasCycle).toBe(false)
    expect(result.cycle).toEqual([])
  })

  it('returns no cycle for single department with no peers', () => {
    const result = detectCycles([makeDept('a', 'Alpha', [])])
    expect(result.hasCycle).toBe(false)
  })

  it('returns no cycle for a valid DAG (linear chain)', () => {
    const depts = [
      makeDept('a', 'Alpha', ['b']),
      makeDept('b', 'Beta', ['c']),
      makeDept('c', 'Gamma', []),
    ]
    const result = detectCycles(depts)
    expect(result.hasCycle).toBe(false)
  })

  it('returns no cycle for a diamond DAG', () => {
    const depts = [
      makeDept('a', 'A', ['b', 'c']),
      makeDept('b', 'B', ['d']),
      makeDept('c', 'C', ['d']),
      makeDept('d', 'D', []),
    ]
    const result = detectCycles(depts)
    expect(result.hasCycle).toBe(false)
  })

  it('detects a direct cycle (A → B → A)', () => {
    const depts = [
      makeDept('a', 'Alpha', ['b']),
      makeDept('b', 'Beta', ['a']),
    ]
    const result = detectCycles(depts)
    expect(result.hasCycle).toBe(true)
    expect(result.cycle.length).toBeGreaterThan(0)
  })

  it('detects a longer cycle (A → B → C → A)', () => {
    const depts = [
      makeDept('a', 'Alpha', ['b']),
      makeDept('b', 'Beta', ['c']),
      makeDept('c', 'Gamma', ['a']),
    ]
    const result = detectCycles(depts)
    expect(result.hasCycle).toBe(true)
  })

  it('detects cycle in a disconnected graph', () => {
    const depts = [
      makeDept('a', 'Alpha', []),
      makeDept('b', 'Beta', ['c']),
      makeDept('c', 'Gamma', ['b']),
    ]
    const result = detectCycles(depts)
    expect(result.hasCycle).toBe(true)
  })
})
