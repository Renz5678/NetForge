// lib/algorithms/aclEngine.ts
// Pure function — no side effects.
// Stateless packet-filter ACL evaluation for firewall nodes.
// Rule evaluation order: ascending by `sequence`. First match wins.
// Implicit `deny ip any any` at the end (Cisco IOS behaviour).

import { ipInSubnet } from '@/lib/ipUtils'
import type { AclRule, AclProtocol } from '@/types'

export type AclPacket = {
  protocol: AclProtocol
  srcIp: string
  dstIp: string
  dstPort?: number
}

const ANY_CIDR = '0.0.0.0/0'

/**
 * Normalise "any" shorthand to the universal CIDR block.
 */
function normaliseCidr(cidr: string): string {
  return cidr.trim().toLowerCase() === 'any' ? ANY_CIDR : cidr
}

/**
 * Returns true when the packet's protocol matches the rule's protocol.
 * A rule protocol of 'ip' matches all protocols.
 */
function protocolMatches(ruleProto: AclProtocol, packetProto: AclProtocol): boolean {
  return ruleProto === 'ip' || ruleProto === packetProto
}

/**
 * Returns true when the packet's destination port satisfies the rule.
 * If the rule has no dstPort defined, all ports match.
 */
function portMatches(ruleDstPort: number | undefined, packetDstPort: number | undefined): boolean {
  if (ruleDstPort === undefined) return true
  return packetDstPort === ruleDstPort
}

/**
 * Evaluate an ordered list of ACL rules against a packet.
 * Returns 'permit' or 'deny'.
 *
 * Rules are sorted by `sequence` (ascending) before evaluation.
 * The first rule whose protocol, source CIDR, destination CIDR, and
 * optional destination port all match determines the outcome.
 * If no rule matches, the implicit deny-all applies.
 */
export function evaluateAcl(
  rules: AclRule[],
  packet: AclPacket
): 'permit' | 'deny' {
  const sorted = [...rules].sort((a, b) => a.sequence - b.sequence)

  for (const rule of sorted) {
    const srcCidr = normaliseCidr(rule.srcCidr)
    const dstCidr = normaliseCidr(rule.dstCidr)

    if (
      protocolMatches(rule.protocol, packet.protocol) &&
      ipInSubnet(packet.srcIp, srcCidr) &&
      ipInSubnet(packet.dstIp, dstCidr) &&
      portMatches(rule.dstPort, packet.dstPort)
    ) {
      return rule.action
    }
  }

  // Implicit deny — Cisco IOS behaviour
  return 'deny'
}

/**
 * Find the first ACL rule that matches a packet.
 * Returns the matching rule (for display in simulation results) or null.
 */
export function findMatchingRule(
  rules: AclRule[],
  packet: AclPacket
): AclRule | null {
  const sorted = [...rules].sort((a, b) => a.sequence - b.sequence)

  for (const rule of sorted) {
    const srcCidr = normaliseCidr(rule.srcCidr)
    const dstCidr = normaliseCidr(rule.dstCidr)

    if (
      protocolMatches(rule.protocol, packet.protocol) &&
      ipInSubnet(packet.srcIp, srcCidr) &&
      ipInSubnet(packet.dstIp, dstCidr) &&
      portMatches(rule.dstPort, packet.dstPort)
    ) {
      return rule
    }
  }

  return null
}
