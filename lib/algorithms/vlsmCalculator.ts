/**
 * lib/algorithms/vlsmCalculator.ts
 *
 * VLSM (Variable Length Subnet Masking) Calculator
 *
 * Algorithm stack used (from the course list):
 *   1. Decrease & Conquer: Insertion Sort  — sort requirements largest→smallest
 *   2. Divide & Conquer:   Binary Search   — find minimum prefix for a host count
 *   3. Greedy:             VLSM Allocation — assign smallest-fitting block from lowest address
 *   4. Brute Force:        Sequential Search — scan all allocations (educational comparison)
 *
 * Each step is tagged with storyPhase for the Before/During/After UI treatment.
 */

import { ipToUint32, uint32ToIp, cidrToMask } from '@/lib/ipUtils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SubnetRequirement = {
  id: string
  label: string
  hosts: number          // required usable hosts
}

export type SubnetResult = {
  id: string
  label: string
  requiredHosts: number
  allocatedHosts: number // 2^(32-prefix) - 2
  prefix: number
  networkAddress: string
  broadcastAddress: string
  firstUsable: string
  lastUsable: string
  subnetMask: string
  cidr: string           // "192.168.1.0/26"
  wastedHosts: number
  utilizationPct: number
}

export type VlsmStep = {
  phase: 'before' | 'during' | 'after'
  algorithm: 'insertion_sort' | 'binary_search' | 'greedy' | 'brute_force'
  title: string
  description: string           // networking-first explanation
  technicalNote?: string        // optional: algorithm detail (Explain Mode)
  sortedOrder?: string[]        // after sort step: labels in order
  currentLabel?: string         // during allocation: which subnet we're placing
  currentPrefix?: number
  currentAddress?: string
  allocatedSoFar?: SubnetResult[]
  bruteForceStepCount?: number  // for brute force comparison
}

export type VlsmCalculation = {
  networkAddress: string
  prefix: number
  totalHosts: number
  usableHosts: number
  requirements: SubnetRequirement[]
  sortedRequirements: SubnetRequirement[]  // after Insertion Sort
  results: SubnetResult[]
  steps: VlsmStep[]
  summary: {
    totalAllocated: number
    totalWasted: number
    utilizationPct: number
    success: boolean
    errorMessage?: string
  }
  bruteForceComparison: {
    greedySteps: number
    bruteForceSteps: number
    speedupFactor: number
  }
}

// ── Step 1: Decrease & Conquer — Insertion Sort ────────────────────────────────

function insertionSort(reqs: SubnetRequirement[]): {
  sorted: SubnetRequirement[]
  steps: VlsmStep[]
} {
  const arr = [...reqs]
  const steps: VlsmStep[] = []

  steps.push({
    phase: 'before',
    algorithm: 'insertion_sort',
    title: 'Sorting subnets by size',
    description:
      'VLSM works best when we allocate the largest subnets first. ' +
      'This prevents address fragmentation — the same reason OSPF summarises routes from largest prefix down.',
    technicalNote:
      'Decrease & Conquer: Insertion Sort. ' +
      'Each element is inserted into its correct position by shifting larger elements right. O(n²) — optimal for small n.',
    sortedOrder: arr.map((r) => r.label),
  })

  for (let i = 1; i < arr.length; i++) {
    const key = arr[i]
    let j = i - 1
    while (j >= 0 && arr[j].hosts < key.hosts) {
      arr[j + 1] = arr[j]
      j--
    }
    arr[j + 1] = key
  }

  steps.push({
    phase: 'before',
    algorithm: 'insertion_sort',
    title: 'Sort complete — largest subnet first',
    description:
      `Sorted order: ${arr.map((r) => `${r.label} (${r.hosts} hosts)`).join(' → ')}. ` +
      'Allocating in this order avoids fragmented leftover blocks.',
    technicalNote: 'Insertion Sort complete. Array is now sorted descending by host count.',
    sortedOrder: arr.map((r) => r.label),
  })

  return { sorted: arr, steps }
}

// ── Step 2: Divide & Conquer — Binary Search for minimum prefix ────────────────

function findMinPrefix(hostsNeeded: number): { prefix: number; steps: VlsmStep[] } {
  const steps: VlsmStep[] = []
  let lo = 1, hi = 30
  let result = 30

  steps.push({
    phase: 'during',
    algorithm: 'binary_search',
    title: `Finding prefix for ${hostsNeeded} hosts`,
    description:
      `Need a block that fits at least ${hostsNeeded} usable hosts. ` +
      'Scanning prefix lengths to find the smallest subnet that fits.',
    technicalNote:
      `Divide & Conquer: Binary Search over prefix range [1,30]. ` +
      `Usable hosts = 2^(32-prefix) - 2.`,
  })

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const usable = Math.pow(2, 32 - mid) - 2
    if (usable >= hostsNeeded) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  const blockSize = Math.pow(2, 32 - result)
  steps.push({
    phase: 'during',
    algorithm: 'binary_search',
    title: `Prefix /${result} selected`,
    description:
      `A /${result} subnet gives ${blockSize - 2} usable addresses — enough for ${hostsNeeded} hosts. ` +
      `Block size: ${blockSize} addresses.`,
    technicalNote: `Binary Search converged: prefix=${result}, usable=${blockSize - 2}`,
    currentPrefix: result,
  })

  return { prefix: result, steps }
}

// ── Step 3: Greedy VLSM Allocation ───────────────────────────────────────────

function greedyAllocate(
  baseAddress: string,
  parentPrefix: number,
  sorted: SubnetRequirement[]
): {
  results: SubnetResult[]
  steps: VlsmStep[]
  success: boolean
  errorMessage?: string
} {
  const results: SubnetResult[] = []
  const steps: VlsmStep[] = []
  let cursor = ipToUint32(baseAddress)
  const parentMask = cidrToMask(parentPrefix)
  const parentBase = cursor
  const parentEnd = (parentBase | ~parentMask) >>> 0
  let greedyStepCount = 0

  for (const req of sorted) {
    greedyStepCount++
    const { prefix } = findMinPrefix(req.hosts)
    const blockSize = Math.pow(2, 32 - prefix)

    // Align cursor to block boundary
    const aligned = (Math.ceil(cursor / blockSize) * blockSize) >>> 0

    if (aligned + blockSize - 1 > parentEnd) {
      return {
        results,
        steps,
        success: false,
        errorMessage: `Not enough address space for "${req.label}" (needs /${prefix}, ${req.hosts} hosts). Reduce host counts or use a larger parent network.`,
      }
    }

    const networkNum = aligned
    const broadcastNum = (aligned + blockSize - 1) >>> 0
    const mask = cidrToMask(prefix)
    const subnetMask = uint32ToIp(mask)

    const result: SubnetResult = {
      id: req.id,
      label: req.label,
      requiredHosts: req.hosts,
      allocatedHosts: blockSize - 2,
      prefix,
      networkAddress: uint32ToIp(networkNum),
      broadcastAddress: uint32ToIp(broadcastNum),
      firstUsable: uint32ToIp(networkNum + 1),
      lastUsable: uint32ToIp(broadcastNum - 1),
      subnetMask,
      cidr: `${uint32ToIp(networkNum)}/${prefix}`,
      wastedHosts: blockSize - 2 - req.hosts,
      utilizationPct: Math.round((req.hosts / (blockSize - 2)) * 100),
    }

    results.push(result)
    cursor = broadcastNum + 1

    steps.push({
      phase: 'during',
      algorithm: 'greedy',
      title: `Placed "${req.label}" at ${result.cidr}`,
      description:
        `Allocated ${result.cidr} for ${req.label}. ` +
        `Provides ${result.allocatedHosts} usable addresses (${req.hosts} needed). ` +
        `Next free address: ${uint32ToIp(cursor)}.`,
      technicalNote:
        `Greedy step ${greedyStepCount}: cursor=${uint32ToIp(networkNum)}, ` +
        `blockSize=${blockSize}, prefix=/${prefix}`,
      currentLabel: req.label,
      currentPrefix: prefix,
      currentAddress: result.cidr,
      allocatedSoFar: [...results],
    })
  }

  steps.push({
    phase: 'after',
    algorithm: 'greedy',
    title: 'All subnets allocated',
    description:
      `Successfully carved ${sorted.length} subnets from the parent block. ` +
      `Next free address is ${uint32ToIp(cursor)} — available for future growth.`,
    technicalNote: `Greedy allocation complete. ${greedyStepCount} placements, O(n log n) total.`,
    allocatedSoFar: results,
  })

  return { results, steps, success: true }
}

// ── Step 4: Brute Force — Sequential Search (educational comparison) ──────────

function countBruteForceSteps(reqs: SubnetRequirement[]): number {
  // Brute force would try all permutations of allocations and check each
  // for validity. Approximate step count = n! * n (checking each permutation)
  const n = reqs.length
  let factorial = 1
  for (let i = 1; i <= n; i++) factorial *= i
  return factorial * n
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function calculateVLSM(
  networkCidr: string,
  requirements: SubnetRequirement[]
): VlsmCalculation {
  const [baseAddress, prefixStr] = networkCidr.split('/')
  const prefix = parseInt(prefixStr, 10)
  const blockSize = Math.pow(2, 32 - prefix)
  const totalHosts = blockSize
  const usableHosts = blockSize - 2

  const allSteps: VlsmStep[] = []

  // Phase 1: Insertion Sort
  const { sorted, steps: sortSteps } = insertionSort(requirements)
  allSteps.push(...sortSteps)

  // Phase 2: Binary Search for each prefix (embedded in greedy)
  // Phase 3: Greedy Allocation
  const { results, steps: allocSteps, success, errorMessage } = greedyAllocate(
    baseAddress,
    prefix,
    sorted
  )
  allSteps.push(...allocSteps)

  const totalAllocated = results.reduce((sum, r) => sum + r.requiredHosts, 0)

  const totalWasted = results.reduce((sum, r) => sum + r.wastedHosts, 0)
  const utilizationPct = usableHosts > 0 ? Math.round((totalAllocated / usableHosts) * 100) : 0

  // Brute force comparison
  const bruteForceSteps = countBruteForceSteps(requirements)
  const greedySteps = allSteps.filter((s) => s.algorithm === 'greedy').length

  return {
    networkAddress: baseAddress,
    prefix,
    totalHosts,
    usableHosts,
    requirements,
    sortedRequirements: sorted,
    results,
    steps: allSteps,
    summary: {
      totalAllocated,
      totalWasted,
      utilizationPct,
      success,
      errorMessage,
    },
    bruteForceComparison: {
      greedySteps,
      bruteForceSteps,
      speedupFactor: bruteForceSteps > 0 ? Math.round(bruteForceSteps / greedySteps) : 1,
    },
  }
}

/**
 * Validate a CIDR string like "192.168.1.0/24"
 */
export function validateCIDR(cidr: string): { valid: boolean; error?: string } {
  const parts = cidr.split('/')
  if (parts.length !== 2) return { valid: false, error: 'Use format: 192.168.1.0/24' }

  const octets = parts[0].split('.')
  if (octets.length !== 4) return { valid: false, error: 'Invalid IP address' }
  for (const o of octets) {
    const n = parseInt(o, 10)
    if (isNaN(n) || n < 0 || n > 255) return { valid: false, error: 'Octet out of range (0-255)' }
  }

  const prefix = parseInt(parts[1], 10)
  if (isNaN(prefix) || prefix < 1 || prefix > 30)
    return { valid: false, error: 'Prefix must be between /1 and /30' }

  return { valid: true }
}
