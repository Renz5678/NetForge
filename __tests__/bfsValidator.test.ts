import { validateConnectivity } from '../lib/algorithms/bfsValidator'
import type { Department } from '../types'

const makeDept = (id: string, name: string, peers: string[]): Department => ({
  id,
  name,
  deviceCount: 10,
  peers,
  type: 'department' as const,
})

describe('bfsValidator', () => {
  it('returns allReachable=true for empty input', () => {
    const result = validateConnectivity([])
    expect(result.allReachable).toBe(true)
    expect(result.isolated).toEqual([])
  })

  it('returns allReachable=true for single department', () => {
    const result = validateConnectivity([makeDept('a', 'Alpha', [])])
    expect(result.allReachable).toBe(true)
  })

  it('returns allReachable=true when all departments are connected', () => {
    const depts = [
      makeDept('a', 'Alpha', ['b']),
      makeDept('b', 'Beta', ['c']),
      makeDept('c', 'Gamma', []),
    ]
    const result = validateConnectivity(depts)
    expect(result.allReachable).toBe(true)
    expect(result.isolated).toEqual([])
  })

  it('detects isolated node (no peers at all)', () => {
    const depts = [
      makeDept('a', 'Alpha', ['b']),
      makeDept('b', 'Beta', ['a']),
      makeDept('c', 'Isolated', []),  // no peers — isolated
    ]
    const result = validateConnectivity(depts)
    expect(result.allReachable).toBe(false)
    expect(result.isolated).toContain('Isolated')
  })

  it('returns isolated names not ids (node with no peers in multi-node graph)', () => {
    // Single node with no peers in a 2-node graph — THAT node is isolated
    const depts = [
      makeDept('a', 'Alpha', ['b']), // connected
      makeDept('x', 'XDept', []),   // no peers → isolated
    ]
    const result = validateConnectivity(depts)
    // Alpha connects to XDept undirectionally via Alpha→b? No, Alpha points to 'b' not 'x'.
    // XDept has no edges at all. So XDept IS isolated.
    expect(result.isolated).toContain('XDept')
    expect(result.isolated).not.toContain('x') // should be name, not id
  })

  it('handles fully disconnected graph (all isolated)', () => {
    const depts = [
      makeDept('a', 'Alpha', []),
      makeDept('b', 'Beta', []),
      makeDept('c', 'Gamma', []),
    ]
    const result = validateConnectivity(depts)
    expect(result.allReachable).toBe(false)
    expect(result.isolated).toContain('Alpha')
    expect(result.isolated).toContain('Beta')
    expect(result.isolated).toContain('Gamma')
  })

  it('treats edges as undirected', () => {
    // Only A → B defined, but B should still be considered connected to A
    const depts = [
      makeDept('a', 'Alpha', ['b']),
      makeDept('b', 'Beta', []),  // no outgoing edges but still connected via undirected view
    ]
    const result = validateConnectivity(depts)
    expect(result.allReachable).toBe(true)
    expect(result.isolated).toEqual([])
  })
})
