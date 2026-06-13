import { allocateSubnets } from '@/lib/algorithms/subnetAllocator'
import { ipToUint32, uint32ToIp } from '@/lib/ipUtils'
import type { NetworkNode, RouterNode, FirewallNode, WanNode, NetworkConfig } from '@/types'

/**
 * Enterprise Campus Network (Demo) — v6
 *
 * 22-node 3-tier campus topology:
 *   Tier 0: Edge-Firewall (border)
 *   Tier 1: Core-Router (OSPF area 0)
 *   Tier 2: 5 distribution switches + 14 leaf departments
 */
export function getDemoEnterpriseConfig(userId: string): NetworkConfig {
  const depts: NetworkNode[] = [
    // ── Tier 0: Border Firewall ────────────────────────────────────────────
    {
      id: 'de_fw',
      name: 'Edge-Firewall',
      deviceCount: 1,
      peers: ['de_cr'],
      type: 'firewall',
      ports: [
        { id: 'de_fw_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p0' },
      ],
      aclRules: [
        { id: 'de_fw_acl1', sequence: 10, action: 'deny', protocol: 'tcp', srcCidr: 'any', dstCidr: 'any', dstPort: 23, remark: 'Block Telnet' },
        { id: 'de_fw_acl2', sequence: 20, action: 'deny', protocol: 'tcp', srcCidr: 'any', dstCidr: 'any', dstPort: 21, remark: 'Block FTP' },
        { id: 'de_fw_acl3', sequence: 30, action: 'deny', protocol: 'tcp', srcCidr: 'any', dstCidr: 'any', dstPort: 3389, remark: 'Block RDP' },
        { id: 'de_fw_acl4', sequence: 40, action: 'permit', protocol: 'ip', srcCidr: 'any', dstCidr: 'any', remark: 'Permit all other' },
      ],
    },

    // ── Tier 1: Core Router ────────────────────────────────────────────────
    {
      id: 'de_cr',
      name: 'Core-Router',
      deviceCount: 1,
      peers: [
        'de_fw',
        'de_sw_alpha', 'de_sw_beta', 'de_sw_gamma',
        'de_ssw_a', 'de_ssw_b',
        'de_eng', 'de_fin', 'de_hr', 'de_mkt', 'de_ops',
        'de_rd', 'de_exec', 'de_noc',
        'de_app', 'de_db', 'de_backup', 'de_dmz',
        'de_voip', 'de_mgmt', 'de_guest',
      ],
      type: 'router',
      ospf: { enabled: true, areaId: 0 },
      ports: [
        { id: 'de_cr_p0', name: 'GigabitEthernet0/0', connectedToNodeId: 'de_fw', connectedToPortId: 'de_fw_p1' },
        { id: 'de_cr_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'de_sw_alpha', connectedToPortId: 'de_alpha_p0' },
        { id: 'de_cr_p2', name: 'GigabitEthernet0/2', connectedToNodeId: 'de_sw_beta', connectedToPortId: 'de_beta_p0' },
        { id: 'de_cr_p3', name: 'GigabitEthernet0/3', connectedToNodeId: 'de_sw_gamma', connectedToPortId: 'de_gamma_p0' },
        { id: 'de_cr_p4', name: 'GigabitEthernet0/4', connectedToNodeId: 'de_ssw_a', connectedToPortId: 'de_sswa_p0' },
        { id: 'de_cr_p5', name: 'GigabitEthernet0/5', connectedToNodeId: 'de_ssw_b', connectedToPortId: 'de_sswb_p0' },
        { id: 'de_cr_p6', name: 'GigabitEthernet1/0', connectedToNodeId: 'de_eng', connectedToPortId: 'de_eng_p1' },
        { id: 'de_cr_p7', name: 'GigabitEthernet1/1', connectedToNodeId: 'de_fin', connectedToPortId: 'de_fin_p1' },
        { id: 'de_cr_p8', name: 'GigabitEthernet1/2', connectedToNodeId: 'de_hr', connectedToPortId: 'de_hr_p1' },
        { id: 'de_cr_p9', name: 'GigabitEthernet1/3', connectedToNodeId: 'de_mkt', connectedToPortId: 'de_mkt_p1' },
        { id: 'de_cr_p10', name: 'GigabitEthernet1/4', connectedToNodeId: 'de_ops', connectedToPortId: 'de_ops_p1' },
        { id: 'de_cr_p11', name: 'GigabitEthernet1/5', connectedToNodeId: 'de_rd', connectedToPortId: 'de_rd_p1' },
        { id: 'de_cr_p12', name: 'GigabitEthernet1/6', connectedToNodeId: 'de_exec', connectedToPortId: 'de_exec_p1' },
        { id: 'de_cr_p13', name: 'GigabitEthernet1/7', connectedToNodeId: 'de_noc', connectedToPortId: 'de_noc_p1' },
        { id: 'de_cr_p14', name: 'GigabitEthernet2/0', connectedToNodeId: 'de_app', connectedToPortId: 'de_app_p1' },
        { id: 'de_cr_p15', name: 'GigabitEthernet2/1', connectedToNodeId: 'de_db', connectedToPortId: 'de_db_p1' },
        { id: 'de_cr_p16', name: 'GigabitEthernet2/2', connectedToNodeId: 'de_backup', connectedToPortId: 'de_backup_p1' },
        { id: 'de_cr_p17', name: 'GigabitEthernet2/3', connectedToNodeId: 'de_dmz', connectedToPortId: 'de_dmz_p1' },
        { id: 'de_cr_p18', name: 'GigabitEthernet2/4', connectedToNodeId: 'de_voip', connectedToPortId: 'de_voip_p1' },
        { id: 'de_cr_p19', name: 'GigabitEthernet2/5', connectedToNodeId: 'de_mgmt', connectedToPortId: 'de_mgmt_p1' },
        { id: 'de_cr_p20', name: 'GigabitEthernet2/6', connectedToNodeId: 'de_guest', connectedToPortId: 'de_guest_p1' },
      ],
    },

    // ── Tier 2: Distribution Switches (connected to CR — not APs since no depts below them) ──
    // These switches serve as aggregation points for additional devices in a real network.
    // In this demo they are "leaf" nodes off the CR and therefore NOT articulation points.
    {
      id: 'de_sw_alpha',
      name: 'Dist-Switch-Alpha',
      deviceCount: 1,
      peers: ['de_cr'],
      type: 'switch',
      ports: [
        { id: 'de_alpha_p0', name: 'GigabitEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p1', vlanMode: 'trunk', vlanTrunkAllowed: [110, 120, 130] },
      ],
    },
    {
      id: 'de_sw_beta',
      name: 'Dist-Switch-Beta',
      deviceCount: 1,
      peers: ['de_cr'],
      type: 'switch',
      ports: [
        { id: 'de_beta_p0', name: 'GigabitEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p2', vlanMode: 'trunk', vlanTrunkAllowed: [140, 150, 160] },
      ],
    },
    {
      id: 'de_sw_gamma',
      name: 'Dist-Switch-Gamma',
      deviceCount: 1,
      peers: ['de_cr'],
      type: 'switch',
      ports: [
        { id: 'de_gamma_p0', name: 'GigabitEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p3', vlanMode: 'trunk', vlanTrunkAllowed: [170, 180] },
      ],
    },
    {
      id: 'de_ssw_a',
      name: 'Server-Switch-A',
      deviceCount: 1,
      peers: ['de_cr'],
      type: 'switch',
      ports: [
        { id: 'de_sswa_p0', name: 'GigabitEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p4', vlanMode: 'trunk', vlanTrunkAllowed: [190, 200] },
      ],
    },
    {
      id: 'de_ssw_b',
      name: 'Server-Switch-B',
      deviceCount: 1,
      peers: ['de_cr'],
      type: 'switch',
      ports: [
        { id: 'de_sswb_p0', name: 'GigabitEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p5', vlanMode: 'trunk', vlanTrunkAllowed: [210, 220] },
      ],
    },

    // ── Tier 2: Leaf Departments (all connected directly to Core-Router) ──
    {
      id: 'de_eng',
      name: 'Engineering',
      deviceCount: 60,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 26,
      ports: [{ id: 'de_eng_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p6' }],
    },
    {
      id: 'de_fin',
      name: 'Finance',
      deviceCount: 28,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 27,
      ports: [{ id: 'de_fin_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p7' }],
    },
    {
      id: 'de_hr',
      name: 'Human Resources',
      deviceCount: 20,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 27,
      ports: [{ id: 'de_hr_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p8' }],
    },
    {
      id: 'de_mkt',
      name: 'Marketing',
      deviceCount: 25,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 27,
      ports: [{ id: 'de_mkt_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p9' }],
    },
    {
      id: 'de_ops',
      name: 'Operations',
      deviceCount: 40,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 26,
      ports: [{ id: 'de_ops_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p10' }],
    },
    {
      id: 'de_rd',
      name: 'R&D Labs',
      deviceCount: 55,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 26,
      ports: [{ id: 'de_rd_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p11' }],
    },
    {
      id: 'de_exec',
      name: 'Executive',
      deviceCount: 10,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 28,
      ports: [{ id: 'de_exec_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p12' }],
    },
    {
      id: 'de_noc',
      name: 'Security-NOC',
      deviceCount: 12,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 28,
      ports: [{ id: 'de_noc_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p13' }],
    },
    {
      id: 'de_app',
      name: 'App-Servers',
      deviceCount: 12,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 28,
      ports: [{ id: 'de_app_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p14' }],
    },
    {
      id: 'de_db',
      name: 'DB-Cluster',
      deviceCount: 6,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 29,
      ports: [{ id: 'de_db_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p15' }],
    },
    {
      id: 'de_backup',
      name: 'Backup-Storage',
      deviceCount: 4,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 29,
      ports: [{ id: 'de_backup_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p16' }],
    },
    {
      id: 'de_dmz',
      name: 'DMZ',
      deviceCount: 6,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 29,
      ports: [{ id: 'de_dmz_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p17' }],
    },
    {
      id: 'de_voip',
      name: 'VoIP-Services',
      deviceCount: 8,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 29,
      ports: [{ id: 'de_voip_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p18' }],
    },
    {
      id: 'de_mgmt',
      name: 'Management-VLAN',
      deviceCount: 6,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 29,
      ports: [{ id: 'de_mgmt_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p19' }],
    },
    {
      id: 'de_guest',
      name: 'Guest-WiFi',
      deviceCount: 30,
      peers: ['de_cr'],
      type: 'department',
      cidrPrefix: 27,
      ports: [{ id: 'de_guest_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p20' }],
    },
  ]

  // Allocate subnets sequentially
  const allocated = allocateSubnets(depts, '10.0.0.0', 10)

  // Wire static routes on Core-Router and Firewall
  const cr = allocated.find((d) => d.id === 'de_cr') as RouterNode | undefined
  const fw = allocated.find((d) => d.id === 'de_fw') as FirewallNode | undefined

  function nextHopIp(subnet: string | undefined): string {
    if (!subnet) return '10.0.0.1'
    const base = ipToUint32(subnet.split('/')[0])
    return uint32ToIp(base + 1)
  }

  const leafSubnets = allocated
    .filter((d) => d.type === 'department' && d.subnet)
    .map((d) => d.subnet!)

  if (cr) {
    cr.staticRoutes = [
      { destination: '0.0.0.0/0', nextHop: nextHopIp(fw?.subnet) },
      ...leafSubnets.map((s) => ({ destination: s, nextHop: '10.0.0.1' })),
    ]
  }
  if (fw) {
    fw.staticRoutes = [
      { destination: '0.0.0.0/0', nextHop: '8.8.8.8' },
      { destination: '10.0.0.0/8', nextHop: nextHopIp(cr?.subnet) },
    ]
  }

  return {
    id: 'demo_enterprise_config_v6',
    userId,
    name: '🏢 Enterprise Campus Network (Demo)',
    departments: allocated,
    baseIp: '10.0.0.0',
    vlanStart: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isValid: true,
  }
}
