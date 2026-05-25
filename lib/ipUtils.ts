// lib/ipUtils.ts
// Shared pure IP utility functions.
// Imported by subnetAllocator.ts and routingSimulator.ts to avoid duplication.

/**
 * Parse an IPv4 string into a 32-bit unsigned integer.
 */
export function ipToUint32(ip: string): number {
  const parts = ip.split('.')
  return (
    ((parseInt(parts[0], 10) & 0xff) << 24) |
    ((parseInt(parts[1], 10) & 0xff) << 16) |
    ((parseInt(parts[2], 10) & 0xff) << 8) |
    (parseInt(parts[3], 10) & 0xff)
  ) >>> 0
}

/**
 * Convert a 32-bit unsigned integer back to an IPv4 string.
 */
export function uint32ToIp(n: number): string {
  const a = (n >>> 24) & 0xff
  const b = (n >>> 16) & 0xff
  const c = (n >>> 8) & 0xff
  const d = n & 0xff
  return `${a}.${b}.${c}.${d}`
}

/**
 * Convert a CIDR prefix length to a 32-bit subnet mask.
 */
export function cidrToMask(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
}

/**
 * Check whether an IP address falls within a given subnet (CIDR notation).
 */
export function ipInSubnet(ipStr: string, subnetStr: string): boolean {
  if (!subnetStr.includes('/')) return false
  const [subIp, prefixStr] = subnetStr.split('/')
  const prefix = parseInt(prefixStr, 10)
  const ipNum = ipToUint32(ipStr)
  const subNum = ipToUint32(subIp)
  const mask = cidrToMask(prefix)
  return (ipNum & mask) >>> 0 === (subNum & mask) >>> 0
}
