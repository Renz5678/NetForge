// lib/configGenerator.ts
// Pure function — no side effects.
// Generates Cisco IOS CLI configuration text from a NetForge topology.

import type { Department, NetworkConfig, AclRule } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function banner(name: string): string {
  const line = '!'.repeat(60)
  return `${line}\n!--- Device: ${name} ---!\n${line}`
}

function aclRuleToIos(rule: AclRule): string {
  const seq = rule.sequence
  const action = rule.action
  const proto = rule.protocol

  const src = rule.srcCidr.toLowerCase() === 'any' ? 'any' : wildcardFromCidr(rule.srcCidr)
  const dst = rule.dstCidr.toLowerCase() === 'any' ? 'any' : wildcardFromCidr(rule.dstCidr)
  const portPart = rule.dstPort !== undefined ? ` eq ${rule.dstPort}` : ''
  const remarkLine = rule.remark ? ` remark ${rule.remark}\n` : ''

  return `${remarkLine} ${seq} ${action} ${proto} ${src} ${dst}${portPart}`
}

/**
 * Convert CIDR notation (e.g. "10.0.1.0/24") to Cisco wildcard format
 * ("10.0.1.0 0.0.0.255"). Returns "any" for 0.0.0.0/0.
 */
function wildcardFromCidr(cidr: string): string {
  if (!cidr.includes('/')) return cidr
  const [ip, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)
  if (prefix === 0) return 'any'
  const hostBits = 32 - prefix
  const wildcardNum = (1 << hostBits) - 1
  const w3 = wildcardNum & 0xff
  const w2 = (wildcardNum >> 8) & 0xff
  const w1 = (wildcardNum >> 16) & 0xff
  const w0 = (wildcardNum >> 24) & 0xff
  return `${ip} ${w0}.${w1}.${w2}.${w3}`
}

// ─── Per-device generators ───────────────────────────────────────────────────

function generateRouterConfig(node: Department, allNodes: Department[]): string {
  const lines: string[] = []
  lines.push(banner(node.name))
  lines.push(`hostname ${node.name.replace(/\s+/g, '_')}`)
  lines.push('!')

  // Interfaces
  if (node.ports) {
    for (const port of node.ports) {
      const ifName = port.name || 'GigabitEthernet0/0'
      lines.push(`interface ${ifName}`)
      if (port.ipAddress) {
        const [ip, prefix] = port.ipAddress.split('/')
        const prefixLen = parseInt(prefix, 10)
        const mask = prefixToMask(prefixLen)
        lines.push(` ip address ${ip} ${mask}`)
      } else {
        lines.push(` no ip address`)
      }
      // OSPF per-interface config
      if (node.ospf?.enabled) {
        lines.push(` ip ospf ${node.ospf.areaId ?? 0} area ${node.ospf.areaId ?? 0}`)
      }
      lines.push(` no shutdown`)
      lines.push('!')
    }
  }

  // OSPF process
  if (node.ospf?.enabled) {
    lines.push(`router ospf 1`)
    lines.push(` router-id ${routerId(node)}`)
    lines.push(` auto-cost reference-bandwidth 1000`)
    lines.push('!')
  }

  // Static routes
  if (node.staticRoutes && node.staticRoutes.length > 0) {
    for (const route of node.staticRoutes) {
      const [net, prefix] = route.destination.split('/')
      const mask = prefixToMask(parseInt(prefix, 10))
      lines.push(`ip route ${net} ${mask} ${route.nextHop}`)
    }
    lines.push('!')
  }

  return lines.join('\n')
}

function generateSwitchConfig(node: Department, allNodes: Department[]): string {
  const lines: string[] = []
  lines.push(banner(node.name))
  lines.push(`hostname ${node.name.replace(/\s+/g, '_')}`)
  lines.push('!')

  // Collect unique VLANs
  const vlans = new Set<number>()
  if (node.ports) {
    for (const port of node.ports) {
      if (port.vlanAccessId !== undefined) vlans.add(port.vlanAccessId)
      if (port.vlanTrunkAllowed) port.vlanTrunkAllowed.forEach((v) => vlans.add(v))
    }
  }

  // VLAN database
  if (vlans.size > 0) {
    for (const vlan of Array.from(vlans).sort((a, b) => a - b)) {
      lines.push(`vlan ${vlan}`)
      lines.push(` name VLAN_${vlan}`)
      lines.push('!')
    }
  }

  // Interfaces
  if (node.ports) {
    for (const port of node.ports) {
      const ifName = port.name || 'FastEthernet0/1'
      lines.push(`interface ${ifName}`)
      if (port.vlanMode === 'access' && port.vlanAccessId !== undefined) {
        lines.push(` switchport mode access`)
        lines.push(` switchport access vlan ${port.vlanAccessId}`)
      } else if (port.vlanMode === 'trunk') {
        lines.push(` switchport mode trunk`)
        if (port.vlanTrunkAllowed && port.vlanTrunkAllowed.length > 0) {
          lines.push(` switchport trunk allowed vlan ${port.vlanTrunkAllowed.join(',')}`)
        }
      } else {
        lines.push(` switchport mode access`)
      }
      lines.push(` no shutdown`)
      lines.push('!')
    }
  }

  lines.push(`spanning-tree mode rapid-pvst`)
  lines.push('!')

  return lines.join('\n')
}

function generateFirewallConfig(node: Department, allNodes: Department[]): string {
  const lines: string[] = []
  lines.push(banner(node.name))
  lines.push(`hostname ${node.name.replace(/\s+/g, '_')}`)
  lines.push('!')

  // ACL block
  const aclName = `NETFORGE_FW_${node.name.replace(/\s+/g, '_').toUpperCase()}`
  if (node.aclRules && node.aclRules.length > 0) {
    lines.push(`ip access-list extended ${aclName}`)
    const sorted = [...node.aclRules].sort((a, b) => a.sequence - b.sequence)
    for (const rule of sorted) {
      lines.push(aclRuleToIos(rule))
    }
    lines.push('!')
  }

  // Interfaces
  if (node.ports) {
    let portIndex = 0
    for (const port of node.ports) {
      const ifName = port.name || `GigabitEthernet0/${portIndex}`
      portIndex++
      lines.push(`interface ${ifName}`)
      if (port.ipAddress) {
        const [ip, prefix] = port.ipAddress.split('/')
        const mask = prefixToMask(parseInt(prefix, 10))
        lines.push(` ip address ${ip} ${mask}`)
      }
      // Apply ACL inbound on every interface
      if (node.aclRules && node.aclRules.length > 0) {
        lines.push(` ip access-group ${aclName} in`)
      }
      lines.push(` no shutdown`)
      lines.push('!')
    }
  }

  // Static routes
  if (node.staticRoutes && node.staticRoutes.length > 0) {
    for (const route of node.staticRoutes) {
      const [net, prefix] = route.destination.split('/')
      const mask = prefixToMask(parseInt(prefix, 10))
      lines.push(`ip route ${net} ${mask} ${route.nextHop}`)
    }
    lines.push('!')
  }

  return lines.join('\n')
}

function generateDepartmentConfig(node: Department, allNodes: Department[]): string {
  const lines: string[] = []
  lines.push(banner(node.name))
  lines.push(`hostname ${node.name.replace(/\s+/g, '_')}`)
  lines.push('!')

  if (node.subnet) {
    const [ip, prefix] = node.subnet.split('/')
    const mask = prefixToMask(parseInt(prefix, 10))
    // Assume .1 of subnet is the gateway
    const gwIp = gatewayIp(node.subnet)
    lines.push(`! --- End-host segment: ${node.name} ---`)
    lines.push(`! Subnet: ${node.subnet}  Devices: ${node.deviceCount}`)
    lines.push(`! Default Gateway: ${gwIp}`)
    lines.push(`ip default-gateway ${gwIp}`)
    if (node.vlanId !== undefined) {
      lines.push(`! VLAN: ${node.vlanId}`)
    }
    lines.push('!')
  }

  return lines.join('\n')
}

function generateWanConfig(node: Department, allNodes: Department[]): string {
  const lines: string[] = []
  lines.push(banner(node.name))
  lines.push(`hostname ${node.name.replace(/\s+/g, '_')}`)
  lines.push('!')
  lines.push(`! --- WAN / ISP Uplink: ${node.name} ---`)
  if (node.ports) {
    for (const port of node.ports) {
      const ifName = port.name || 'GigabitEthernet0/0'
      lines.push(`interface ${ifName}`)
      if (port.ipAddress) {
        const [ip, prefix] = port.ipAddress.split('/')
        const mask = prefixToMask(parseInt(prefix, 10))
        lines.push(` ip address ${ip} ${mask}`)
      }
      lines.push(` no shutdown`)
      lines.push('!')
    }
  }
  return lines.join('\n')
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a Cisco IOS configuration block for a single device node.
 */
export function generateCiscoConfig(node: Department, allNodes: Department[]): string {
  switch (node.type) {
    case 'router':   return generateRouterConfig(node, allNodes)
    case 'switch':   return generateSwitchConfig(node, allNodes)
    case 'firewall': return generateFirewallConfig(node, allNodes)
    case 'wan':      return generateWanConfig(node, allNodes)
    default:         return generateDepartmentConfig(node, allNodes)
  }
}

/**
 * Generate a complete Cisco IOS configuration for the entire topology.
 * Devices are ordered: WAN → Firewalls → Routers → Switches → Departments.
 */
export function generateFullTopologyConfig(config: NetworkConfig): string {
  const typeOrder: Record<string, number> = {
    wan: 0, firewall: 1, router: 2, switch: 3, department: 4,
  }

  const sorted = [...config.departments].sort((a, b) => {
    const aRank = typeOrder[a.type ?? 'department'] ?? 4
    const bRank = typeOrder[b.type ?? 'department'] ?? 4
    return aRank - bRank
  })

  const header = [
    '!',
    `! NetForge — Cisco IOS Configuration Export`,
    `! Topology: ${config.name}`,
    `! Generated: ${new Date().toUTCString()}`,
    `! Devices: ${sorted.length}`,
    '!',
    '',
  ].join('\n')

  const deviceConfigs = sorted
    .map((node) => generateCiscoConfig(node, config.departments))
    .join('\n\n')

  return header + deviceConfigs + '\n\n! end\n'
}

// ─── Internal utilities ───────────────────────────────────────────────────────

function prefixToMask(prefix: number): string {
  if (prefix === 0) return '0.0.0.0'
  const mask = (0xffffffff << (32 - prefix)) >>> 0
  return [
    (mask >>> 24) & 0xff,
    (mask >>> 16) & 0xff,
    (mask >>> 8) & 0xff,
    mask & 0xff,
  ].join('.')
}

function routerId(node: Department): string {
  // Use first port IP or fallback to subnet network address
  const firstPortIp = node.ports?.find((p) => p.ipAddress)?.ipAddress?.split('/')[0]
  if (firstPortIp) return firstPortIp
  if (node.subnet) return node.subnet.split('/')[0]
  return '0.0.0.0'
}

function gatewayIp(subnet: string): string {
  const [base] = subnet.split('/')
  const parts = base.split('.').map(Number)
  parts[3] = 1
  return parts.join('.')
}
