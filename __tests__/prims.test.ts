import { buildPrimsSteps } from '../lib/algorithms/primsVisualizer'
import type { Department } from '../types'

const makeDept = (id: string, name: string, peers: string[]): Department => ({
  id,
  name,
  deviceCount: 10,
  peers,
  type: 'department' as const,
})

describe('primsVisualizer', () => {
  it('returns empty result for empty input', () => {
    const result = buildPrimsSteps([], 'a')
    expect(result.steps).toEqual([])
    expect(result.mstEdges).toEqual([])
    expect(result.totalCost).toBe(0)
    expect(result.orderedNodes).toEqual([])
  })

  it('returns cost 0 for a single node graph', () => {
    const depts = [makeDept('a', 'Alpha', [])]
    const result = buildPrimsSteps(depts, 'a')
    expect(result.totalCost).toBe(0)
    expect(result.orderedNodes).toEqual(['a'])
  })

  it('finds MST for two connected nodes', () => {
    const depts = [
      makeDept('a', 'Alpha', ['b']),
      makeDept('b', 'Beta', ['a']),
    ]
    const result = buildPrimsSteps(depts, 'a')
    expect(result.totalCost).toBe(1)
    expect(result.mstEdges.length).toBe(1)
    expect(result.orderedNodes).toEqual(['a', 'b'])
  })

  it('finds minimum spanning tree in a cycle (triangle/diamond)', () => {
    // a - b, a - c, b - c (cost 1 each by default)
    // MST should drop one edge and connect all 3 nodes with cost 2
    const depts = [
      makeDept('a', 'Alpha', ['b', 'c']),
      makeDept('b', 'Beta', ['a', 'c']),
      makeDept('c', 'Gamma', ['a', 'b']),
    ]
    const result = buildPrimsSteps(depts, 'a')
    expect(result.totalCost).toBe(2)
    expect(result.mstEdges.length).toBe(2)
    expect(result.orderedNodes.length).toBe(3)
  })

  it('honors edge weights map if provided', () => {
    const depts = [
      makeDept('a', 'Alpha', ['b', 'c']),
      makeDept('b', 'Beta', ['a', 'c']),
      makeDept('c', 'Gamma', ['a', 'b']),
    ]
    // Make edge a-b cost 5, a-c cost 2, b-c cost 1
    // Cheapest tree: a - c (2) and c - b (1) -> total 3
    const weights = new Map<string, number>([
      ['a→b', 5],
      ['b→a', 5],
      ['a→c', 2],
      ['c→a', 2],
      ['b→c', 1],
      ['c→b', 1],
    ])
    const result = buildPrimsSteps(depts, 'a', weights)
    expect(result.totalCost).toBe(3)
    expect(result.mstEdges.length).toBe(2)
  })
})
