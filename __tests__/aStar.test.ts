// aStar.test.ts
// Tests for findShortestPathAStar — A* pathfinding with Euclidean heuristic.
//
// Strategy:
//   • positions Map is used for the heuristic. We set coordinates so that
//     the heuristic is meaningful (e.g. straight-line to target is the
//     actual best direction) but still admissible on a hop-count graph.
//   • When positions are missing or zero, h(n) = 0 → A* degenerates
//     to Dijkstra, so we also test parity with findShortestPath (Dijkstra).

import { findShortestPathAStar } from '@/lib/algorithms/aStar'
import { findShortestPath } from '@/lib/algorithms/dijkstra'
import type { Department } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDept(id: string, peers: string[] = []): Department {
  return { id, name: `Node_${id}`, deviceCount: 1, peers }
}

/** Build a trivial positions map with all nodes at the origin (h = 0). */
function zeroPositions(ids: string[]): Map<string, { x: number; y: number }> {
  const m = new Map<string, { x: number; y: number }>()
  ids.forEach((id) => m.set(id, { x: 0, y: 0 }))
  return m
}

/** Build a positions map with linearly spaced nodes along the X axis. */
function linearPositions(ids: string[]): Map<string, { x: number; y: number }> {
  const m = new Map<string, { x: number; y: number }>()
  ids.forEach((id, i) => m.set(id, { x: i * 120, y: 0 }))
  return m
}

// ── Trivial / edge cases ──────────────────────────────────────────────────────

describe('findShortestPathAStar — trivial cases', () => {
  it('returns null for an empty departments array', () => {
    const result = findShortestPathAStar([], 'A', 'B', new Map())
    expect(result).toBeNull()
  })

  it('returns {path: [A], hops: 0} when src === dst', () => {
    const depts = [makeDept('A', ['B']), makeDept('B', ['A'])]
    const positions = zeroPositions(['A', 'B'])
    const result = findShortestPathAStar(depts, 'A', 'A', positions)
    expect(result).not.toBeNull()
    expect(result!.path).toEqual(['A'])
    expect(result!.hops).toBe(0)
  })

  it('returns null when source node does not exist in departments', () => {
    const depts = [makeDept('A', ['B']), makeDept('B', ['A'])]
    const positions = zeroPositions(['A', 'B'])
    const result = findShortestPathAStar(depts, 'GHOST', 'B', positions)
    expect(result).toBeNull()
  })

  it('returns null when target node does not exist in departments', () => {
    const depts = [makeDept('A', ['B']), makeDept('B', ['A'])]
    const positions = zeroPositions(['A', 'B'])
    const result = findShortestPathAStar(depts, 'A', 'GHOST', positions)
    expect(result).toBeNull()
  })

  it('returns null for a disconnected graph (A—B, C—D, no path A→C)', () => {
    const depts = [
      makeDept('A', ['B']),
      makeDept('B', ['A']),
      makeDept('C', ['D']),
      makeDept('D', ['C']),
    ]
    const positions = zeroPositions(['A', 'B', 'C', 'D'])
    const result = findShortestPathAStar(depts, 'A', 'C', positions)
    expect(result).toBeNull()
  })
})

// ── Simple paths ──────────────────────────────────────────────────────────────

describe('findShortestPathAStar — simple linear chain A—B—C', () => {
  let depts: Department[]
  let positions: Map<string, { x: number; y: number }>

  beforeEach(() => {
    depts = [
      makeDept('A', ['B']),
      makeDept('B', ['A', 'C']),
      makeDept('C', ['B']),
    ]
    positions = linearPositions(['A', 'B', 'C'])
  })

  it('finds the path A→B→C', () => {
    const result = findShortestPathAStar(depts, 'A', 'C', positions)
    expect(result).not.toBeNull()
    expect(result!.path).toEqual(['A', 'B', 'C'])
    expect(result!.hops).toBe(2)
  })

  it('finds the path C→B→A (reverse direction)', () => {
    const result = findShortestPathAStar(depts, 'C', 'A', positions)
    expect(result).not.toBeNull()
    expect(result!.path).toEqual(['C', 'B', 'A'])
    expect(result!.hops).toBe(2)
  })

  it('finds direct A→B (1 hop)', () => {
    const result = findShortestPathAStar(depts, 'A', 'B', positions)
    expect(result).not.toBeNull()
    expect(result!.hops).toBe(1)
    expect(result!.path[0]).toBe('A')
    expect(result!.path[result!.path.length - 1]).toBe('B')
  })
})

// ── A* parity with Dijkstra ───────────────────────────────────────────────────

describe('findShortestPathAStar — parity with Dijkstra (zero heuristic)', () => {
  // With all positions at (0,0), h(n) = 0 → A* behaves identically to Dijkstra.

  const topologies: Array<{ name: string; depts: Department[] }> = [
    {
      name: 'linear chain',
      depts: [
        makeDept('A', ['B']),
        makeDept('B', ['A', 'C']),
        makeDept('C', ['B', 'D']),
        makeDept('D', ['C']),
      ],
    },
    {
      name: 'star topology',
      depts: [
        makeDept('hub', ['L1', 'L2', 'L3']),
        makeDept('L1', ['hub']),
        makeDept('L2', ['hub']),
        makeDept('L3', ['hub']),
      ],
    },
    {
      name: 'fully connected triangle',
      depts: [
        makeDept('A', ['B', 'C']),
        makeDept('B', ['A', 'C']),
        makeDept('C', ['A', 'B']),
      ],
    },
  ]

  topologies.forEach(({ name, depts }) => {
    describe(`Topology: ${name}`, () => {
      const ids = depts.map((d) => d.id)
      const pos = zeroPositions(ids)

      // Test all non-trivial src/dst pairs
      for (const src of ids) {
        for (const dst of ids) {
          if (src === dst) continue
          it(`path ${src}→${dst} matches Dijkstra`, () => {
            const aStar = findShortestPathAStar(depts, src, dst, pos)
            const dijkstra = findShortestPath(depts, src, dst)

            if (dijkstra === null) {
              expect(aStar).toBeNull()
            } else {
              expect(aStar).not.toBeNull()
              // Must have same hop count (path length may differ on ties, but hops must equal)
              expect(aStar!.hops).toBe(dijkstra.hops)
              // Path must start and end at the correct nodes
              expect(aStar!.path[0]).toBe(src)
              expect(aStar!.path[aStar!.path.length - 1]).toBe(dst)
            }
          })
        }
      }
    })
  })
})

// ── Spatial heuristic benefit ─────────────────────────────────────────────────

describe('findShortestPathAStar — spatial heuristic steers toward target', () => {
  // Topology: two paths A→B→C (2 hops) and A→D→E→C (3 hops)
  // The heuristic should still find the 2-hop path as the shortest.
  const depts: Department[] = [
    makeDept('A', ['B', 'D']),
    makeDept('B', ['A', 'C']),
    makeDept('C', ['B', 'E']),
    makeDept('D', ['A', 'E']),
    makeDept('E', ['D', 'C']),
  ]

  // Position C to the right of A with B in-between, D/E off to the side
  const positions = new Map<string, { x: number; y: number }>([
    ['A', { x: 0,   y: 0   }],
    ['B', { x: 120, y: 0   }],  // directly toward C
    ['C', { x: 240, y: 0   }],  // target
    ['D', { x: 0,   y: 200 }],  // perpendicular — away from target
    ['E', { x: 240, y: 200 }],  // converges at C-level X, but farther
  ])

  it('finds the 2-hop path A→B→C (not the 3-hop A→D→E→C)', () => {
    const result = findShortestPathAStar(depts, 'A', 'C', positions)
    expect(result).not.toBeNull()
    expect(result!.hops).toBe(2)
    expect(result!.path).toEqual(['A', 'B', 'C'])
  })
})

// ── Missing positions ─────────────────────────────────────────────────────────

describe('findShortestPathAStar — missing position entries (h fallback = 0)', () => {
  it('still finds a path when positions map is empty (degrades to Dijkstra)', () => {
    const depts = [
      makeDept('A', ['B']),
      makeDept('B', ['A', 'C']),
      makeDept('C', ['B']),
    ]
    // Empty positions → all heuristics return 0
    const result = findShortestPathAStar(depts, 'A', 'C', new Map())
    expect(result).not.toBeNull()
    expect(result!.hops).toBe(2)
  })
})

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('findShortestPathAStar — idempotency', () => {
  it('returns the same result on repeated calls with identical input', () => {
    const depts = [
      makeDept('A', ['B']),
      makeDept('B', ['A', 'C']),
      makeDept('C', ['B']),
    ]
    const positions = linearPositions(['A', 'B', 'C'])

    const r1 = findShortestPathAStar(depts, 'A', 'C', positions)
    const r2 = findShortestPathAStar(depts, 'A', 'C', positions)

    expect(r1).not.toBeNull()
    expect(r2).not.toBeNull()
    expect(r1!.path).toEqual(r2!.path)
    expect(r1!.hops).toBe(r2!.hops)
  })
})
