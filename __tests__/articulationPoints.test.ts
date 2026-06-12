// articulationPoints.test.ts
// Tests for Tarjan's articulation point and bridge detection algorithm.

import { findArticulationPoints } from '@/lib/algorithms/articulationPoints'
import type { NetworkNode } from '@/types'

// Helper: create a minimal Department with just id, name, and peers
function makeDept(id: string, peers: string[] = []): NetworkNode {
  return {
    id,
    name: `Node_${id}`,
    deviceCount: 1,
    peers,
    type: 'department' as const,
  }
}

// ── Empty and trivial cases ────────────────────────────────────────────────────

describe('findArticulationPoints — trivial inputs', () => {
  it('returns empty results for an empty departments array', () => {
    const result = findArticulationPoints([])
    expect(result.articulationPoints).toHaveLength(0)
    expect(result.bridges).toHaveLength(0)
  })

  it('returns empty results for a single node', () => {
    const result = findArticulationPoints([makeDept('A')])
    expect(result.articulationPoints).toHaveLength(0)
    expect(result.bridges).toHaveLength(0)
  })

  it('handles two isolated nodes (no peers) correctly', () => {
    const result = findArticulationPoints([makeDept('A'), makeDept('B')])
    // No edges → no articulation points, no bridges
    expect(result.articulationPoints).toHaveLength(0)
    expect(result.bridges).toHaveLength(0)
  })
})

// ── Linear chain: A—B—C ────────────────────────────────────────────────────────

describe('findArticulationPoints — linear chain A—B—C', () => {
  let depts: NetworkNode[]

  beforeEach(() => {
    depts = [
      makeDept('A', ['B']),
      makeDept('B', ['A', 'C']),
      makeDept('C', ['B']),
    ]
  })

  it('identifies B as the only articulation point', () => {
    const { articulationPoints } = findArticulationPoints(depts)
    expect(articulationPoints).toHaveLength(1)
    expect(articulationPoints).toContain('B')
  })

  it('identifies two bridges: A—B and B—C', () => {
    const { bridges } = findArticulationPoints(depts)
    expect(bridges).toHaveLength(2)

    // Convert to sets of sorted pairs for order-independent comparison
    const bridgePairs = bridges.map(([a, b]) => [a, b].sort().join('—'))
    expect(bridgePairs).toContain('A—B')
    expect(bridgePairs).toContain('B—C')
  })
})

// ── Star topology: hub connected to 4 leaves ───────────────────────────────────

describe('findArticulationPoints — star topology', () => {
  let depts: NetworkNode[]

  beforeEach(() => {
    depts = [
      makeDept('hub', ['L1', 'L2', 'L3', 'L4']),
      makeDept('L1', ['hub']),
      makeDept('L2', ['hub']),
      makeDept('L3', ['hub']),
      makeDept('L4', ['hub']),
    ]
  })

  it('identifies hub as the only articulation point', () => {
    const { articulationPoints } = findArticulationPoints(depts)
    expect(articulationPoints).toHaveLength(1)
    expect(articulationPoints).toContain('hub')
  })

  it('identifies 4 bridges (hub to each leaf)', () => {
    const { bridges } = findArticulationPoints(depts)
    expect(bridges).toHaveLength(4)
  })
})

// ── Full mesh (4 nodes) ────────────────────────────────────────────────────────

describe('findArticulationPoints — full mesh (4 nodes, all connected to all)', () => {
  let depts: NetworkNode[]

  beforeEach(() => {
    depts = [
      makeDept('A', ['B', 'C', 'D']),
      makeDept('B', ['A', 'C', 'D']),
      makeDept('C', ['A', 'B', 'D']),
      makeDept('D', ['A', 'B', 'C']),
    ]
  })

  it('finds no articulation points in a full mesh', () => {
    const { articulationPoints } = findArticulationPoints(depts)
    expect(articulationPoints).toHaveLength(0)
  })

  it('finds no bridges in a full mesh', () => {
    const { bridges } = findArticulationPoints(depts)
    expect(bridges).toHaveLength(0)
  })
})

// ── Two clusters joined by a single bridge node ────────────────────────────────

describe('findArticulationPoints — two triangles joined at bridge node', () => {
  // Triangle 1: A—B—C—A
  // Triangle 2: D—E—F—D
  // Bridge:     C—D  (C and D are both APs, C—D is a bridge edge)
  let depts: NetworkNode[]

  beforeEach(() => {
    depts = [
      makeDept('A', ['B', 'C']),
      makeDept('B', ['A', 'C']),
      makeDept('C', ['A', 'B', 'D']),  // connects triangle 1 to triangle 2
      makeDept('D', ['C', 'E', 'F']),  // connects triangle 2 to triangle 1
      makeDept('E', ['D', 'F']),
      makeDept('F', ['D', 'E']),
    ]
  })

  it('identifies C and D as articulation points', () => {
    const { articulationPoints } = findArticulationPoints(depts)
    expect(articulationPoints.length).toBeGreaterThanOrEqual(2)
    expect(articulationPoints).toContain('C')
    expect(articulationPoints).toContain('D')
  })

  it('identifies C—D as a bridge', () => {
    const { bridges } = findArticulationPoints(depts)
    const bridgePairs = bridges.map(([a, b]) => [a, b].sort().join('—'))
    expect(bridgePairs).toContain('C—D')
  })
})

// ── Disconnected graph ─────────────────────────────────────────────────────────

describe('findArticulationPoints — disconnected graph (two separate chains)', () => {
  // Component 1: A—B—C  (B is AP in component 1)
  // Component 2: X—Y    (both are leaf-only, Y is AP if X is only neighbor — bridge)
  let depts: NetworkNode[]

  beforeEach(() => {
    depts = [
      makeDept('A', ['B']),
      makeDept('B', ['A', 'C']),
      makeDept('C', ['B']),
      makeDept('X', ['Y']),
      makeDept('Y', ['X']),
    ]
  })

  it('finds APs within each component independently', () => {
    const { articulationPoints } = findArticulationPoints(depts)
    expect(articulationPoints).toContain('B')
  })

  it('finds bridges within each component independently', () => {
    const { bridges } = findArticulationPoints(depts)
    const bridgePairs = bridges.map(([a, b]) => [a, b].sort().join('—'))
    expect(bridgePairs).toContain('A—B')
    expect(bridgePairs).toContain('B—C')
    expect(bridgePairs).toContain('X—Y')
  })
})

// ── Idempotency ────────────────────────────────────────────────────────────────

describe('findArticulationPoints — idempotency', () => {
  it('returns same results on repeated calls with same input', () => {
    const depts = [
      makeDept('A', ['B']),
      makeDept('B', ['A', 'C']),
      makeDept('C', ['B']),
    ]
    const r1 = findArticulationPoints(depts)
    const r2 = findArticulationPoints(depts)
    expect(r1.articulationPoints.sort()).toEqual(r2.articulationPoints.sort())
    expect(r1.bridges.length).toBe(r2.bridges.length)
  })
})

// ── Dangling peer references ───────────────────────────────────────────────────

describe('findArticulationPoints — dangling peer references', () => {
  it('ignores peers that do not exist in the departments array', () => {
    const depts = [
      makeDept('A', ['B', 'GHOST']),  // GHOST does not exist
      makeDept('B', ['A']),
    ]
    // Should not throw; should treat as a single edge A—B
    expect(() => findArticulationPoints(depts)).not.toThrow()
    const { articulationPoints } = findArticulationPoints(depts)
    // A—B is a bridge; both are "leaf" nodes with degree 1 after removing GHOST
    // Neither is an AP since removing either doesn't split remaining nodes
    expect(articulationPoints).toHaveLength(0)
  })
})
