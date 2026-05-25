// subnetAllocator.ts
// Pure function — no side effects.
// Input: Department[] in topological order, baseIp: string, vlanStart: number
// Output: Department[] with subnet, cidrPrefix, vlanId, usableHosts filled in
// Method: greedy pointer advance using bitwise IP operations

import type { Department } from '@/types'

const MAX_DEVICE_COUNT = 16_777_214 // /8 usable

/**
 * Parse an IPv4 string into a 32-bit unsigned integer.
 * Uses bitwise operations — no string splitting in the hot path.
 */
function ipToUint32(ip: string): number {
  const parts = ip.split('.')
  return (
    ((parseInt(parts[0], 10) & 0xff) << 24) |
    ((parseInt(parts[1], 10) & 0xff) << 16) |
    ((parseInt(parts[2], 10) & 0xff) << 8) |
    (parseInt(parts[3], 10) & 0xff)
  ) >>> 0
}

/**
 * Convert a 32-bit unsigned integer back to IPv4 string.
 */
function uint32ToIp(n: number): string {
  const a = (n >>> 24) & 0xff
  const b = (n >>> 16) & 0xff
  const c = (n >>> 8) & 0xff
  const d = n & 0xff
  return `${a}.${b}.${c}.${d}`
}

/**
 * Find the smallest CIDR prefix where usable hosts >= deviceCount.
 * Minimum: /30 (2 usable). Maximum: /8 (16,777,214 usable).
 */
function findCidrPrefix(deviceCount: number): number {
  // usableHosts = 2^(32 - prefix) - 2
  for (let prefix = 30; prefix >= 8; prefix--) {
    const usable = (1 << (32 - prefix)) - 2
    if (usable >= deviceCount) return prefix
  }
  return 8 // fallback for very large counts
}

export function allocateSubnets(
  departments: Department[],
  baseIp: string,
  vlanStart: number
): Department[] {
  if (departments.length === 0) return []

  let pointer = ipToUint32(baseIp)
  let vlanId = vlanStart

  return departments.map((dept) => {
    const count = Math.max(dept.deviceCount, 1)

    if (count > MAX_DEVICE_COUNT) {
      throw new Error(
        `Department "${dept.name}" requests ${count} devices which exceeds the maximum of ${MAX_DEVICE_COUNT}.`
      )
    }

    const cidrPrefix = findCidrPrefix(count)
    const blockSize = 1 << (32 - cidrPrefix) // total addresses in block

    // Align pointer to block boundary (round up to nearest multiple of blockSize)
    if (pointer % blockSize !== 0) {
      pointer = (Math.floor(pointer / blockSize) + 1) * blockSize
    }

    const usableHosts = blockSize - 2
    const networkAddress = pointer
    const subnet = `${uint32ToIp(networkAddress)}/${cidrPrefix}`

    // Advance pointer past this block
    pointer = (networkAddress + blockSize) >>> 0

    const result: Department = {
      ...dept,
      subnet,
      cidrPrefix,
      vlanId,
      usableHosts,
    }

    vlanId += 10
    return result
  })
}

/**
 * Check if two CIDR blocks overlap.
 * Returns true if they share any addresses.
 */
function cidrsOverlap(
  ip1: number,
  prefix1: number,
  ip2: number,
  prefix2: number
): boolean {
  const mask1 = prefix1 === 0 ? 0 : (0xffffffff << (32 - prefix1)) >>> 0
  const mask2 = prefix2 === 0 ? 0 : (0xffffffff << (32 - prefix2)) >>> 0
  const net1 = (ip1 & mask1) >>> 0
  const net2 = (ip2 & mask2) >>> 0
  return (net1 & mask2) >>> 0 === net2 || (net2 & mask1) >>> 0 === net1
}

/**
 * Validate that no two allocated subnets overlap.
 * Returns list of conflicting department name pairs.
 */
export function checkSubnetOverlap(
  departments: Department[]
): { overlapping: boolean; conflicts: string[] } {
  const allocated = departments.filter((d) => d.subnet && d.cidrPrefix !== undefined)
  const conflicts: string[] = []

  for (let i = 0; i < allocated.length; i++) {
    for (let j = i + 1; j < allocated.length; j++) {
      const a = allocated[i]
      const b = allocated[j]
      if (!a.subnet || !b.subnet || a.cidrPrefix === undefined || b.cidrPrefix === undefined)
        continue

      const aIp = ipToUint32(a.subnet.split('/')[0])
      const bIp = ipToUint32(b.subnet.split('/')[0])

      if (cidrsOverlap(aIp, a.cidrPrefix, bIp, b.cidrPrefix)) {
        conflicts.push(`${a.name} ↔ ${b.name}`)
      }
    }
  }

  return { overlapping: conflicts.length > 0, conflicts }
}
