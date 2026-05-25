// dijkstra.ts
// Pure function — no side effects.
// Input: Department[], sourceId: string, targetId: string
// Output: PathResult | null (null = no path exists)
// Method: Min-heap Dijkstra, edge weight = 1 (hop count)
// Treats edges as directed (respects communication rules)

import type { Department, PathResult } from '@/types'

type HeapNode = {
  id: string
  dist: number
}

class MinHeap {
  private heap: HeapNode[] = []

  push(node: HeapNode): void {
    this.heap.push(node)
    this._bubbleUp(this.heap.length - 1)
  }

  pop(): HeapNode | undefined {
    if (this.heap.length === 0) return undefined
    const top = this.heap[0]
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      this._sinkDown(0)
    }
    return top
  }

  get size(): number {
    return this.heap.length
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2)
      if (this.heap[parent].dist <= this.heap[i].dist) break
      ;[this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]]
      i = parent
    }
  }

  private _sinkDown(i: number): void {
    const n = this.heap.length
    while (true) {
      let smallest = i
      const left = 2 * i + 1
      const right = 2 * i + 2
      if (left < n && this.heap[left].dist < this.heap[smallest].dist) smallest = left
      if (right < n && this.heap[right].dist < this.heap[smallest].dist) smallest = right
      if (smallest === i) break
      ;[this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]]
      i = smallest
    }
  }
}

export function findShortestPath(
  departments: Department[],
  sourceId: string,
  targetId: string
): PathResult | null {
  if (departments.length === 0) return null
  if (sourceId === targetId) return { path: [sourceId], hops: 0 }

  // Build directed adjacency list
  const adj = new Map<string, string[]>()
  const idSet = new Set(departments.map((d) => d.id))

  for (const dept of departments) {
    adj.set(dept.id, dept.peers.filter((p) => idSet.has(p)))
  }

  // Dijkstra initialization
  const dist = new Map<string, number>()
  const prev = new Map<string, string | null>()

  for (const dept of departments) {
    dist.set(dept.id, Infinity)
    prev.set(dept.id, null)
  }

  if (!dist.has(sourceId) || !dist.has(targetId)) return null

  dist.set(sourceId, 0)

  const heap = new MinHeap()
  heap.push({ id: sourceId, dist: 0 })

  while (heap.size > 0) {
    const current = heap.pop()!

    if (current.id === targetId) break

    // Skip stale heap entries
    if (current.dist > (dist.get(current.id) ?? Infinity)) continue

    for (const neighbor of adj.get(current.id) ?? []) {
      const newDist = current.dist + 1 // edge weight = 1 hop
      if (newDist < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, newDist)
        prev.set(neighbor, current.id)
        heap.push({ id: neighbor, dist: newDist })
      }
    }
  }

  // No path found
  const finalDist = dist.get(targetId)
  if (finalDist === undefined || finalDist === Infinity) return null

  // Reconstruct path from predecessor map
  const path: string[] = []
  let current: string | null = targetId

  while (current !== null) {
    path.push(current)
    current = prev.get(current) ?? null
  }

  path.reverse()

  // Verify path starts at source
  if (path[0] !== sourceId) return null

  return {
    path,
    hops: path.length - 1,
  }
}
