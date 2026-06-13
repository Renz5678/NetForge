import { allocateSubnets } from '@/lib/algorithms/subnetAllocator'
import { ipToUint32, uint32ToIp } from '@/lib/ipUtils'
import type { NetworkNode, RouterNode, FirewallNode, NetworkConfig } from '@/types'

/**
 * Enterprise Campus Network (Demo) — v7
 *
 * 22-node hierarchical campus topology:
 *   Tier 0: Edge-Firewall
 *   Tier 1: Core-Router
 *   Tier 2: 4 Distribution Switches
 *   Tier 3: 16 Leaf Departments
 */
export function getDemoEnterpriseConfig(userId: string): NetworkConfig {
  const depts: NetworkNode[] = [
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
    {
      id: 'de_cr',
      name: 'Core-Router',
      deviceCount: 1,
      peers: ['de_fw', 'de_sw_alpha', 'de_sw_beta', 'de_sw_gamma', 'de_sw_delta'],
      type: 'router',
      ospf: { enabled: true, areaId: 0 },
      ports: [
        { id: 'de_cr_p0', name: 'GigabitEthernet0/0', connectedToNodeId: 'de_fw', connectedToPortId: 'de_fw_p1' },
        { id: 'de_cr_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'de_sw_alpha', connectedToPortId: 'de_alpha_p0' },
        { id: 'de_cr_p2', name: 'GigabitEthernet0/2', connectedToNodeId: 'de_sw_beta', connectedToPortId: 'de_beta_p0' },
        { id: 'de_cr_p3', name: 'GigabitEthernet0/3', connectedToNodeId: 'de_sw_gamma', connectedToPortId: 'de_gamma_p0' },
        { id: 'de_cr_p4', name: 'GigabitEthernet0/4', connectedToNodeId: 'de_sw_delta', connectedToPortId: 'de_delta_p0' },
      ],
    },
    // Switches
    {
      id: 'de_sw_alpha',
      name: 'Dist-Alpha',
      deviceCount: 1,
      peers: ['de_cr', 'de_eng', 'de_ops', 'de_rd', 'de_qa'],
      type: 'switch',
      ports: [
        { id: 'de_alpha_p0', name: 'GigabitEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p1', vlanMode: 'trunk', vlanTrunkAllowed: [110, 120, 130, 140] },
      ],
    },
    {
      id: 'de_sw_beta',
      name: 'Dist-Beta',
      deviceCount: 1,
      peers: ['de_cr', 'de_fin', 'de_hr', 'de_mkt', 'de_sales'],
      type: 'switch',
      ports: [
        { id: 'de_beta_p0', name: 'GigabitEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p2', vlanMode: 'trunk', vlanTrunkAllowed: [150, 160, 170, 180] },
      ],
    },
    {
      id: 'de_sw_gamma',
      name: 'Dist-Gamma',
      deviceCount: 1,
      peers: ['de_cr', 'de_exec', 'de_noc', 'de_mgmt', 'de_legal'],
      type: 'switch',
      ports: [
        { id: 'de_gamma_p0', name: 'GigabitEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p3', vlanMode: 'trunk', vlanTrunkAllowed: [190, 200, 210, 220] },
      ],
    },
    {
      id: 'de_sw_delta',
      name: 'Dist-Delta',
      deviceCount: 1,
      peers: ['de_cr', 'de_app', 'de_db', 'de_backup', 'de_dmz'],
      type: 'switch',
      ports: [
        { id: 'de_delta_p0', name: 'GigabitEthernet0/1', connectedToNodeId: 'de_cr', connectedToPortId: 'de_cr_p4', vlanMode: 'trunk', vlanTrunkAllowed: [230, 240, 250, 260] },
      ],
    },

    // Alpha Depts
    { id: 'de_eng', name: 'Engineering', deviceCount: 60, peers: ['de_sw_alpha'], type: 'department', cidrPrefix: 26, ports: [{ id: 'de_eng_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_alpha', connectedToPortId: 'de_alpha_p1' }] },
    { id: 'de_ops', name: 'Operations', deviceCount: 40, peers: ['de_sw_alpha'], type: 'department', cidrPrefix: 26, ports: [{ id: 'de_ops_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_alpha', connectedToPortId: 'de_alpha_p2' }] },
    { id: 'de_rd', name: 'R&D Labs', deviceCount: 55, peers: ['de_sw_alpha'], type: 'department', cidrPrefix: 26, ports: [{ id: 'de_rd_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_alpha', connectedToPortId: 'de_alpha_p3' }] },
    { id: 'de_qa', name: 'QA Testing', deviceCount: 30, peers: ['de_sw_alpha'], type: 'department', cidrPrefix: 27, ports: [{ id: 'de_qa_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_alpha', connectedToPortId: 'de_alpha_p4' }] },

    // Beta Depts
    { id: 'de_fin', name: 'Finance', deviceCount: 28, peers: ['de_sw_beta'], type: 'department', cidrPrefix: 27, ports: [{ id: 'de_fin_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_beta', connectedToPortId: 'de_beta_p1' }] },
    { id: 'de_hr', name: 'Human Resources', deviceCount: 20, peers: ['de_sw_beta'], type: 'department', cidrPrefix: 27, ports: [{ id: 'de_hr_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_beta', connectedToPortId: 'de_beta_p2' }] },
    { id: 'de_mkt', name: 'Marketing', deviceCount: 25, peers: ['de_sw_beta'], type: 'department', cidrPrefix: 27, ports: [{ id: 'de_mkt_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_beta', connectedToPortId: 'de_beta_p3' }] },
    { id: 'de_sales', name: 'Sales', deviceCount: 45, peers: ['de_sw_beta'], type: 'department', cidrPrefix: 26, ports: [{ id: 'de_sales_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_beta', connectedToPortId: 'de_beta_p4' }] },

    // Gamma Depts
    { id: 'de_exec', name: 'Executive', deviceCount: 10, peers: ['de_sw_gamma'], type: 'department', cidrPrefix: 28, ports: [{ id: 'de_exec_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_gamma', connectedToPortId: 'de_gamma_p1' }] },
    { id: 'de_noc', name: 'Security-NOC', deviceCount: 12, peers: ['de_sw_gamma'], type: 'department', cidrPrefix: 28, ports: [{ id: 'de_noc_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_gamma', connectedToPortId: 'de_gamma_p2' }] },
    { id: 'de_mgmt', name: 'Management-VLAN', deviceCount: 6, peers: ['de_sw_gamma'], type: 'department', cidrPrefix: 29, ports: [{ id: 'de_mgmt_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_gamma', connectedToPortId: 'de_gamma_p3' }] },
    { id: 'de_legal', name: 'Legal', deviceCount: 8, peers: ['de_sw_gamma'], type: 'department', cidrPrefix: 29, ports: [{ id: 'de_legal_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_gamma', connectedToPortId: 'de_gamma_p4' }] },

    // Delta Depts
    { id: 'de_app', name: 'App-Servers', deviceCount: 12, peers: ['de_sw_delta'], type: 'department', cidrPrefix: 28, ports: [{ id: 'de_app_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_delta', connectedToPortId: 'de_delta_p1' }] },
    { id: 'de_db', name: 'DB-Cluster', deviceCount: 6, peers: ['de_sw_delta'], type: 'department', cidrPrefix: 29, ports: [{ id: 'de_db_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_delta', connectedToPortId: 'de_delta_p2' }] },
    { id: 'de_backup', name: 'Backup-Storage', deviceCount: 4, peers: ['de_sw_delta'], type: 'department', cidrPrefix: 29, ports: [{ id: 'de_backup_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_delta', connectedToPortId: 'de_delta_p3' }] },
    { id: 'de_dmz', name: 'DMZ', deviceCount: 6, peers: ['de_sw_delta'], type: 'department', cidrPrefix: 29, ports: [{ id: 'de_dmz_p1', name: 'FastEthernet0/1', connectedToNodeId: 'de_sw_delta', connectedToPortId: 'de_delta_p4' }] },
  ]

  const allocated = allocateSubnets(depts, '10.0.0.0', 10)

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
    id: 'demo_enterprise_config_v7',
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
