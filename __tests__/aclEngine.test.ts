import { evaluateAcl, findMatchingRule, type AclPacket } from '../lib/algorithms/aclEngine'
import type { AclRule } from '../types'

const makeRule = (
  seq: number,
  action: 'permit' | 'deny',
  protocol: 'ip' | 'tcp' | 'udp' | 'icmp',
  srcCidr: string,
  dstCidr: string,
  dstPort?: number,
  remark?: string
): AclRule => ({ id: `rule_${seq}`, sequence: seq, action, protocol, srcCidr, dstCidr, dstPort, remark })

describe('aclEngine — evaluateAcl', () => {
  it('permits a matching rule', () => {
    const rules: AclRule[] = [
      makeRule(10, 'permit', 'ip', '10.0.1.0/24', '10.0.2.0/24'),
    ]
    const packet: AclPacket = { protocol: 'ip', srcIp: '10.0.1.5', dstIp: '10.0.2.10' }
    expect(evaluateAcl(rules, packet)).toBe('permit')
  })

  it('denies a matching deny rule', () => {
    const rules: AclRule[] = [
      makeRule(10, 'deny', 'tcp', 'any', 'any', 80),
    ]
    const packet: AclPacket = { protocol: 'tcp', srcIp: '10.0.1.5', dstIp: '192.168.1.1', dstPort: 80 }
    expect(evaluateAcl(rules, packet)).toBe('deny')
  })

  it('evaluates rules in sequence order — deny before permit wins', () => {
    const rules: AclRule[] = [
      makeRule(20, 'permit', 'ip', 'any', 'any'),
      makeRule(10, 'deny', 'ip', '10.0.1.0/24', 'any'),
    ]
    const packet: AclPacket = { protocol: 'ip', srcIp: '10.0.1.99', dstIp: '8.8.8.8' }
    expect(evaluateAcl(rules, packet)).toBe('deny')
  })

  it('falls through to implicit deny when no rule matches', () => {
    const rules: AclRule[] = [
      makeRule(10, 'permit', 'tcp', '10.0.1.0/24', '10.0.2.0/24', 443),
    ]
    // Different src subnet — no match
    const packet: AclPacket = { protocol: 'tcp', srcIp: '192.168.5.1', dstIp: '10.0.2.5', dstPort: 443 }
    expect(evaluateAcl(rules, packet)).toBe('deny')
  })

  it('implicit deny when rule list is empty', () => {
    const packet: AclPacket = { protocol: 'ip', srcIp: '1.2.3.4', dstIp: '5.6.7.8' }
    expect(evaluateAcl([], packet)).toBe('deny')
  })

  it('port-specific rule does not match different port', () => {
    const rules: AclRule[] = [
      makeRule(10, 'deny', 'tcp', 'any', 'any', 80),
      makeRule(20, 'permit', 'tcp', 'any', 'any'),
    ]
    // Port 443 — rule 10 does not match, rule 20 permits
    const packet: AclPacket = { protocol: 'tcp', srcIp: '10.0.0.1', dstIp: '10.0.0.2', dstPort: 443 }
    expect(evaluateAcl(rules, packet)).toBe('permit')
  })

  it('"any" src/dst wildcards match all IPs', () => {
    const rules: AclRule[] = [
      makeRule(10, 'permit', 'icmp', 'any', 'any'),
    ]
    const packet: AclPacket = { protocol: 'icmp', srcIp: '172.16.99.1', dstIp: '10.255.0.1' }
    expect(evaluateAcl(rules, packet)).toBe('permit')
  })

  it('protocol "ip" in rule matches all protocols', () => {
    const rules: AclRule[] = [
      makeRule(10, 'permit', 'ip', 'any', 'any'),
    ]
    const tcpPacket: AclPacket = { protocol: 'tcp', srcIp: '1.1.1.1', dstIp: '2.2.2.2', dstPort: 22 }
    const udpPacket: AclPacket = { protocol: 'udp', srcIp: '1.1.1.1', dstIp: '2.2.2.2' }
    const icmpPacket: AclPacket = { protocol: 'icmp', srcIp: '1.1.1.1', dstIp: '2.2.2.2' }
    expect(evaluateAcl(rules, tcpPacket)).toBe('permit')
    expect(evaluateAcl(rules, udpPacket)).toBe('permit')
    expect(evaluateAcl(rules, icmpPacket)).toBe('permit')
  })
})

describe('aclEngine — findMatchingRule', () => {
  it('returns the first matched rule', () => {
    const rules: AclRule[] = [
      makeRule(10, 'deny', 'tcp', 'any', 'any', 80),
      makeRule(20, 'permit', 'ip', 'any', 'any'),
    ]
    const packet: AclPacket = { protocol: 'tcp', srcIp: '10.0.0.1', dstIp: '10.0.0.2', dstPort: 80 }
    const result = findMatchingRule(rules, packet)
    expect(result).not.toBeNull()
    expect(result?.sequence).toBe(10)
    expect(result?.action).toBe('deny')
  })

  it('returns null when no rule matches', () => {
    const rules: AclRule[] = [
      makeRule(10, 'permit', 'tcp', '10.0.0.0/24', '10.0.1.0/24', 443),
    ]
    const packet: AclPacket = { protocol: 'udp', srcIp: '10.0.0.1', dstIp: '10.0.1.1' }
    expect(findMatchingRule(rules, packet)).toBeNull()
  })
})
