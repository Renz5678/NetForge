import { findShortestPath } from '../lib/algorithms/dijkstra'
import type { Department } from '../types'

const makeDept = (id: string, name: string, peers: string[]): Department => ({
  id,
  name,
  deviceCount: 10,
  peers,
})

describe('dijkstra', () => {
  it('returns null for empty input', () => {
    const result = findShortestPath([], 'a', 'b')
    expect(result).toBeNull()
  })

  it('returns null when source or target not found', () => {
    const depts = [makeDept('a', 'Alpha', [])]
    expect(findShortestPath(depts, 'a', 'z')).toBeNull()
    expect(findShortestPath(depts, 'z', 'a')).toBeNull()
  })

  it('returns path with 0 hops for same source and target', () => {
    const depts = [makeDept('a', 'Alpha', [])]
    const result = findShortestPath(depts, 'a', 'a')
    expect(result).not.toBeNull()
    expect(result!.hops).toBe(0)
    expect(result!.path).toEqual(['a'])
  })

  it('finds a direct path (1 hop)', () => {
    const depts = [
      makeDept('a', 'Alpha', ['b']),
      makeDept('b', 'Beta', []),
    ]
    const result = findShortestPath(depts, 'a', 'b')
    expect(result).not.toBeNull()
    expect(result!.hops).toBe(1)
    expect(result!.path).toEqual(['a', 'b'])
  })

  it('finds a path with 2 hops', () => {
    const depts = [
      makeDept('a', 'Alpha', ['b']),
      makeDept('b', 'Beta', ['c']),
      makeDept('c', 'Gamma', []),
    ]
    const result = findShortestPath(depts, 'a', 'c')
    expect(result).not.toBeNull()
    expect(result!.hops).toBe(2)
    expect(result!.path).toEqual(['a', 'b', 'c'])
  })

  it('returns null when no path exists (directed)', () => {
    const depts = [
      makeDept('a', 'Alpha', ['b']),  // a → b
      makeDept('b', 'Beta', []),       // b has no outgoing
    ]
    // Reverse direction has no path
    const result = findShortestPath(depts, 'b', 'a')
    expect(result).toBeNull()
  })

  it('finds shortest path (not longest) in branching graph', () => {
    // a → b → d (2 hops)
    // a → c → b → d (3 hops, longer)
    const depts = [
      makeDept('a', 'Alpha', ['b', 'c']),
      makeDept('b', 'Beta', ['d']),
      makeDept('c', 'Gamma', ['b']),
      makeDept('d', 'Delta', []),
    ]
    const result = findShortestPath(depts, 'a', 'd')
    expect(result).not.toBeNull()
    expect(result!.hops).toBe(2)
    expect(result!.path).toEqual(['a', 'b', 'd'])
  })

  it('returns null for single node graph with different target', () => {
    const depts = [makeDept('a', 'Alpha', [])]
    const result = findShortestPath(depts, 'a', 'b')
    expect(result).toBeNull()
  })
})
