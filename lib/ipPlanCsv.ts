/**
 * lib/ipPlanCsv.ts
 *
 * Generates a CSV string representing the IP address plan for a NetworkConfig.
 * Used by the Export screen's "IP Plan CSV" artifact.
 *
 * Columns: NetworkNode, Type, VLAN ID, Subnet (CIDR), Network, First Usable,
 *          Last Usable, Usable Hosts, Devices
 *
 * Pure function — no side effects.
 */

import { ipToUint32, uint32ToIp, cidrToMask } from '@/lib/ipUtils'
import type { NetworkConfig, NetworkNode } from '@/types'

function getNetworkAddress(dept: NetworkNode): string {
  if (!dept.subnet) return '—'
  return dept.subnet.split('/')[0]
}

function getFirstUsable(dept: NetworkNode): string {
  if (!dept.subnet || !dept.cidrPrefix) return '—'
  if (dept.cidrPrefix === 32) return dept.subnet.split('/')[0]
  const baseIp = dept.subnet.split('/')[0]
  return uint32ToIp(ipToUint32(baseIp) + 1)
}

function getLastUsable(dept: NetworkNode): string {
  if (!dept.subnet || !dept.cidrPrefix) return '—'
  if (dept.cidrPrefix === 32) return dept.subnet.split('/')[0]
  if (dept.cidrPrefix === 31) return uint32ToIp(ipToUint32(dept.subnet.split('/')[0]) + 1)
  const baseIp = dept.subnet.split('/')[0]
  const blockSize = Math.pow(2, 32 - dept.cidrPrefix)
  return uint32ToIp(ipToUint32(baseIp) + blockSize - 2)
}

function getBroadcast(dept: NetworkNode): string {
  if (!dept.subnet || !dept.cidrPrefix) return '—'
  if (dept.cidrPrefix === 32) return dept.subnet.split('/')[0]
  if (dept.cidrPrefix === 31) return uint32ToIp(ipToUint32(dept.subnet.split('/')[0]) + 1)
  const baseIp = dept.subnet.split('/')[0]
  const blockSize = Math.pow(2, 32 - dept.cidrPrefix)
  return uint32ToIp(ipToUint32(baseIp) + blockSize - 1)
}

function escape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function generateIpPlanCsv(config: NetworkConfig): string {
  const headers = [
    'Department',
    'Type',
    'VLAN ID',
    'Subnet (CIDR)',
    'Network Address',
    'First Usable',
    'Last Usable',
    'Broadcast',
    'Usable Hosts',
    'Devices',
  ]

  const rows: string[] = [headers.join(',')]

  for (const dept of config.departments) {
    const row = [
      escape(dept.name),
      escape(dept.type ?? 'department'),
      escape(dept.vlanId !== undefined ? String(dept.vlanId) : '—'),
      escape(dept.subnet ?? '—'),
      escape(getNetworkAddress(dept)),
      escape(getFirstUsable(dept)),
      escape(getLastUsable(dept)),
      escape(getBroadcast(dept)),
      escape(dept.usableHosts !== undefined ? String(dept.usableHosts) : '—'),
      escape(String(dept.deviceCount ?? 0)),
    ]
    rows.push(row.join(','))
  }

  return rows.join('\n')
}

/**
 * Returns the CSV filename for a given NetworkConfig.
 * Example: "Enterprise_Campus_ip_plan.csv"
 */
export function ipPlanFilename(config: NetworkConfig): string {
  const safeName = config.name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_')
  return `${safeName}_ip_plan.csv`
}
