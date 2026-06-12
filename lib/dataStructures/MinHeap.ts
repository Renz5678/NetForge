/**
 * Generic binary min-heap.
 *
 * @template T - The type of items stored in the heap.
 * @param comparator - A function that returns:
 *   - a negative number if `a` should come before `b` (lower priority value first),
 *   - zero if equal,
 *   - a positive number if `b` should come before `a`.
 *
 * The heap always pops the item for which `comparator` produces the smallest result
 * relative to all other items (i.e., it is a *min*-heap driven by the comparator).
 *
 * Usage examples:
 *   // Sort by `dist` field (Dijkstra):
 *   new MinHeap<{ id: string; dist: number }>((a, b) => a.dist - b.dist)
 *
 *   // Sort by `f` field (A*):
 *   new MinHeap<{ id: string; f: number; g: number }>((a, b) => a.f - b.f)
 *
 *   // Sort by `cost` field (Prim's):
 *   new MinHeap<{ nodeId: string; cost: number; fromId: string | null }>((a, b) => a.cost - b.cost)
 */
export class MinHeap<T> {
  private heap: T[] = []

  constructor(private readonly comparator: (a: T, b: T) => number) {}

  push(node: T): void {
    this.heap.push(node)
    this._bubbleUp(this.heap.length - 1)
  }

  pop(): T | undefined {
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

  /**
   * Returns a sorted copy of all items currently in the heap, ordered from
   * lowest to highest according to the comparator. Used by visualizers to
   * snapshot the priority queue state at each step.
   */
  get contents(): T[] {
    return [...this.heap].sort(this.comparator)
  }

  /**
   * Returns the best (lowest-cost) entry per unique key, deduplicated.
   * Useful for Prim's visualizer where multiple stale heap entries may exist
   * for the same destination node.
   *
   * @param keyFn - Extracts the deduplication key from an item (e.g., `e => e.nodeId`).
   */
  getCandidates(keyFn: (item: T) => string): T[] {
    const best = new Map<string, T>()
    for (const item of this.heap) {
      const key = keyFn(item)
      const existing = best.get(key)
      if (!existing || this.comparator(item, existing) < 0) {
        best.set(key, item)
      }
    }
    return [...best.values()].sort(this.comparator)
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2)
      if (this.comparator(this.heap[parent], this.heap[i]) <= 0) break
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
      if (left < n && this.comparator(this.heap[left], this.heap[smallest]) < 0) smallest = left
      if (right < n && this.comparator(this.heap[right], this.heap[smallest]) < 0) smallest = right
      if (smallest === i) break
      ;[this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]]
      i = smallest
    }
  }
}
