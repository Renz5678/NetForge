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

  it('does NOT treat a bidirectional peer link (A↔B) as a cycle (per AGENTS.md)', () => {
    // AGENTS.md mandates: peers are always bidirectional.
    // A lists B as peer AND B lists A as peer — this is a normal physical link, NOT a cycle.
    const depts = [
      makeDept('a', 'Alpha', ['b']),
      makeDept('b', 'Beta', ['a']),
    ]
    const result = detectCycles(depts)
    expect(result.hasCycle).toBe(false)
  })

  it('detects a longer cycle (A → B → C → A)', () => {
    // A 3-node ring where each node references the next — this is a genuine cycle
    // because it cannot be explained by a single bidirectional link.
    const depts = [
      makeDept('a', 'Alpha', ['b']),
      makeDept('b', 'Beta', ['c']),
      makeDept('c', 'Gamma', ['a']),
    ]
    const result = detectCycles(depts)
    expect(result.hasCycle).toBe(true)
  })

  it('detects cycle in a disconnected graph (B ↔ C forms a pair, D → E → F → D is a cycle)', () => {
    const depts = [
      makeDept('a', 'Alpha', []),
      makeDept('b', 'Beta', ['c']),   // bidirectional pair — not a cycle
      makeDept('c', 'Gamma', ['b']),
      makeDept('d', 'Delta', ['e']),  // 3-node cycle
      makeDept('e', 'Epsilon', ['f']),
      makeDept('f', 'Zeta', ['d']),
    ]
    const result = detectCycles(depts)
    expect(result.hasCycle).toBe(true)
  })
})
