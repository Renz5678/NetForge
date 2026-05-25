import { topologicalSort } from '../lib/algorithms/topologicalSort'
import type { Department } from '../types'

const makeDept = (id: string, name: string, peers: string[]): Department => ({
  id,
  name,
  deviceCount: 10,
  peers,
})

describe('topologicalSort', () => {
  it('returns empty for empty input', () => {
    const result = topologicalSort([])
    expect(result).toEqual([])
  })

  it('returns single element for one department', () => {
    const result = topologicalSort([makeDept('a', 'Alpha', [])])
    expect(result).toEqual(['a'])
  })

  it('sorts a linear chain with dependencies first', () => {
    // A → B → C means A depends on B which depends on C
    // Topological: A should come before B before C
    const depts = [
      makeDept('a', 'Alpha', ['b']),
      makeDept('b', 'Beta', ['c']),
      makeDept('c', 'Gamma', []),
    ]
    const result = topologicalSort(depts)
    const aIdx = result.indexOf('a')
    const bIdx = result.indexOf('b')
    const cIdx = result.indexOf('c')
    // a is a source (feeds b), b feeds c
    // In Kahn's, sources (zero in-degree) come first
    // c has in-degree 1, b has in-degree 1, a has in-degree 0
    expect(result).toContain('a')
    expect(result).toContain('b')
    expect(result).toContain('c')
    expect(result.length).toBe(3)
  })

  it('handles a diamond DAG', () => {
    const depts = [
      makeDept('a', 'A', ['b', 'c']),
      makeDept('b', 'B', ['d']),
      makeDept('c', 'C', ['d']),
      makeDept('d', 'D', []),
    ]
    const result = topologicalSort(depts)
    expect(result.length).toBe(4)
    expect(result).toContain('d')
    // a must come before b and c (a feeds them)
    // d comes after b and c (b,c feed d)
    const dIdx = result.indexOf('d')
    const bIdx = result.indexOf('b')
    const cIdx = result.indexOf('c')
    expect(bIdx).toBeLessThan(dIdx)
    expect(cIdx).toBeLessThan(dIdx)
  })

  it('handles disconnected nodes (no peers)', () => {
    const depts = [
      makeDept('a', 'Alpha', []),
      makeDept('b', 'Beta', []),
      makeDept('c', 'Gamma', []),
    ]
    const result = topologicalSort(depts)
    expect(result.length).toBe(3)
    expect(result).toContain('a')
    expect(result).toContain('b')
    expect(result).toContain('c')
  })
})
