// lib/templates.ts
// Pre-built real-world networking scenario templates.
// Each scenario demonstrates at least one algorithm naturally through a real networking problem.
// Users learn by solving a networking problem, not studying algorithms.

import type { NetworkNode, NetworkConfig } from '@/types'
import { allocateSubnets } from '@/lib/algorithms/subnetAllocator'
import { topologicalSort } from '@/lib/algorithms/topologicalSort'



export type NetworkTemplate = {
  id: string
  name: string
  iconName: string
  description: string
  scenario: string        // Networking problem this template solves
  highlights: string[]    // Key features users will discover
  algorithmTeaser: string // Natural algorithm discovery prompt
  getConfig: (userId: string) => NetworkConfig
}

// ─── Helper: Sort and allocate departments ─────────────────────────────────────
function buildConfig(
  id: string,
  userId: string,
  name: string,
  rawDepts: NetworkNode[],
  baseIp: string,
  vlanStart: number
): NetworkConfig {
  const sorted = topologicalSort(rawDepts)
  const sortedDepts = sorted
    .map((sid) => rawDepts.find((d) => d.id === sid))
    .filter((d): d is NetworkNode => d !== undefined)
  const missing = rawDepts.filter((d) => !sorted.includes(d.id))
  const allocated = allocateSubnets([...sortedDepts, ...missing], baseIp, vlanStart)
  return {
    // Prefix with 'local_' so the sync queue skips this config.
    // Templates are read-only scenarios — they don't belong in Supabase.
    id: `local_${id}`,
    userId,
    name,
    departments: allocated,
    baseIp,
    vlanStart,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isValid: true,
  }
}

// ─── Template 1: Small Business Network ────────────────────────────────────────
function getSmallBizConfig(userId: string): NetworkConfig {
  const depts: NetworkNode[] = [
    {
      id: 'sb_wan',
      name: 'ISP Uplink',
      deviceCount: 1,
      peers: ['sb_router'],
      type: 'wan',
      ports: [{ id: 'sb_wan_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'sb_router', connectedToPortId: 'sb_router_p1' }],
    },
    {
      id: 'sb_router',
      name: 'Office-Router',
      deviceCount: 1,
      peers: ['sb_wan', 'sb_switch'],
      type: 'router',
      ospf: { enabled: true, areaId: 0 },
      ports: [
        { id: 'sb_router_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'sb_wan', connectedToPortId: 'sb_wan_p1' },
        { id: 'sb_router_p2', name: 'GigabitEthernet0/1', connectedToNodeId: 'sb_switch', connectedToPortId: 'sb_switch_p1' },
      ],
    },
    {
      id: 'sb_switch',
      name: 'Office-Switch',
      deviceCount: 1,
      peers: ['sb_router'],
      type: 'switch',
      ports: [
        { id: 'sb_switch_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'sb_router', connectedToPortId: 'sb_router_p2', vlanMode: 'trunk', vlanTrunkAllowed: [10, 20, 30] },
        { id: 'sb_switch_p2', name: 'FastEthernet0/1', connectedToNodeId: 'sb_staff', connectedToPortId: 'sb_staff_p1', vlanMode: 'access', vlanAccessId: 10 },
        { id: 'sb_switch_p3', name: 'FastEthernet0/2', connectedToNodeId: 'sb_guest', connectedToPortId: 'sb_guest_p1', vlanMode: 'access', vlanAccessId: 20 },
        { id: 'sb_switch_p4', name: 'FastEthernet0/3', connectedToNodeId: 'sb_servers', connectedToPortId: 'sb_servers_p1', vlanMode: 'access', vlanAccessId: 30 },
      ],
    },
    {
      id: 'sb_staff',
      name: 'Staff',
      deviceCount: 15,
      peers: ['sb_switch'],
      type: 'department',
      cidrPrefix: 28,
      ports: [{ id: 'sb_staff_p1', name: 'FastEthernet0/1', connectedToNodeId: 'sb_switch', connectedToPortId: 'sb_switch_p2' }],
    },
    {
      id: 'sb_guest',
      name: 'Guest WiFi',
      deviceCount: 10,
      peers: ['sb_switch'],
      type: 'department',
      cidrPrefix: 28,
      ports: [{ id: 'sb_guest_p1', name: 'FastEthernet0/1', connectedToNodeId: 'sb_switch', connectedToPortId: 'sb_switch_p3' }],
      aclRules: [
        { id: 'sb_acl_1', sequence: 10, action: 'deny', protocol: 'ip', srcCidr: '0.0.0.0/0', dstCidr: '10.0.0.0/8', remark: 'Isolate guest from internal' },
        { id: 'sb_acl_2', sequence: 20, action: 'permit', protocol: 'ip', srcCidr: 'any', dstCidr: 'any' },
      ],
    },
    {
      id: 'sb_servers',
      name: 'File Servers',
      deviceCount: 3,
      peers: ['sb_router'],
      type: 'department',
      cidrPrefix: 29,
      ports: [{ id: 'sb_servers_p1', name: 'FastEthernet0/1', connectedToNodeId: 'sb_switch', connectedToPortId: 'sb_switch_p4' }],
    },
  ]
  return buildConfig('tpl_small_biz', userId, 'Small Business Network', depts, '192.168.1.0', 10)
}

// ─── Template 2: Enterprise Campus Network ────────────────────────────────────
function getEnterpriseCampusConfig(userId: string): NetworkConfig {
  const depts: NetworkNode[] = [
    {
      id: 'ec_wan',
      name: 'WAN / Internet',
      deviceCount: 1,
      peers: ['ec_fw'],
      type: 'wan',
      ports: [{ id: 'ec_wan_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'ec_fw', connectedToPortId: 'ec_fw_p1' }],
    },
    {
      id: 'ec_fw',
      name: 'Edge-Firewall',
      deviceCount: 1,
      peers: ['ec_wan', 'ec_core'],
      type: 'firewall',
      ports: [
        { id: 'ec_fw_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'ec_wan', connectedToPortId: 'ec_wan_p1' },
        { id: 'ec_fw_p2', name: 'GigabitEthernet0/1', connectedToNodeId: 'ec_core', connectedToPortId: 'ec_core_p1' },
      ],
      aclRules: [
        { id: 'ec_acl_1', sequence: 10, action: 'deny', protocol: 'tcp', srcCidr: 'any', dstCidr: 'any', dstPort: 23, remark: 'Block Telnet' },
        { id: 'ec_acl_2', sequence: 20, action: 'permit', protocol: 'ip', srcCidr: 'any', dstCidr: 'any' },
      ],
    },
    {
      id: 'ec_core',
      name: 'Core-Router',
      deviceCount: 1,
      peers: ['ec_fw', 'ec_distrib_a', 'ec_distrib_b'],
      type: 'router',
      ospf: { enabled: true, areaId: 0 },
      ports: [
        { id: 'ec_core_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'ec_fw', connectedToPortId: 'ec_fw_p2' },
        { id: 'ec_core_p2', name: 'GigabitEthernet0/1', connectedToNodeId: 'ec_distrib_a', connectedToPortId: 'ec_da_p1' },
        { id: 'ec_core_p3', name: 'GigabitEthernet0/2', connectedToNodeId: 'ec_distrib_b', connectedToPortId: 'ec_db_p1' },
      ],
    },
    {
      id: 'ec_distrib_a',
      name: 'Dist-Switch-A',
      deviceCount: 1,
      peers: ['ec_core'],
      type: 'switch',
      ports: [
        { id: 'ec_da_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'ec_core', connectedToPortId: 'ec_core_p2', vlanMode: 'trunk', vlanTrunkAllowed: [10, 20, 30] },
        { id: 'ec_da_p2', name: 'GigabitEthernet0/2', connectedToNodeId: 'ec_eng', connectedToPortId: 'ec_eng_p1', vlanMode: 'access', vlanAccessId: 10 },
        { id: 'ec_da_p3', name: 'GigabitEthernet0/3', connectedToNodeId: 'ec_hr', connectedToPortId: 'ec_hr_p1', vlanMode: 'access', vlanAccessId: 20 },
      ],
    },
    {
      id: 'ec_distrib_b',
      name: 'Dist-Switch-B',
      deviceCount: 1,
      peers: ['ec_core'],
      type: 'switch',
      ports: [
        { id: 'ec_db_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'ec_core', connectedToPortId: 'ec_core_p3', vlanMode: 'trunk', vlanTrunkAllowed: [30, 40] },
        { id: 'ec_db_p2', name: 'GigabitEthernet0/2', connectedToNodeId: 'ec_dc', connectedToPortId: 'ec_dc_p1', vlanMode: 'access', vlanAccessId: 30 },
        { id: 'ec_db_p3', name: 'GigabitEthernet0/3', connectedToNodeId: 'ec_exec', connectedToPortId: 'ec_exec_p1', vlanMode: 'access', vlanAccessId: 40 },
      ],
    },
    {
      id: 'ec_eng',
      name: 'Engineering',
      deviceCount: 80,
      peers: ['ec_distrib_a'],
      type: 'department',
      cidrPrefix: 25,
      ports: [{ id: 'ec_eng_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'ec_distrib_a', connectedToPortId: 'ec_da_p2' }],
    },
    {
      id: 'ec_hr',
      name: 'HR & Finance',
      deviceCount: 30,
      peers: ['ec_distrib_a'],
      type: 'department',
      cidrPrefix: 27,
      ports: [{ id: 'ec_hr_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'ec_distrib_a', connectedToPortId: 'ec_da_p3' }],
    },
    {
      id: 'ec_dc',
      name: 'Data Center',
      deviceCount: 20,
      peers: ['ec_distrib_b'],
      type: 'department',
      cidrPrefix: 27,
      ports: [{ id: 'ec_dc_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'ec_distrib_b', connectedToPortId: 'ec_db_p2' }],
    },
    {
      id: 'ec_exec',
      name: 'Executive',
      deviceCount: 10,
      peers: ['ec_distrib_b'],
      type: 'department',
      cidrPrefix: 28,
      ports: [{ id: 'ec_exec_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'ec_distrib_b', connectedToPortId: 'ec_db_p3' }],
    },
  ]
  return buildConfig('tpl_enterprise_campus', userId, 'Enterprise Campus Network', depts, '10.1.0.0', 10)
}

// ─── Template 3: Multi-Branch WAN ────────────────────────────────────────────
function getMultiBranchConfig(userId: string): NetworkConfig {
  const depts: NetworkNode[] = [
    {
      id: 'mb_hq_wan',
      name: 'HQ WAN',
      deviceCount: 1,
      peers: ['mb_hq_router'],
      type: 'wan',
      ports: [{ id: 'mb_hq_wan_p1', name: 'Serial0/0', connectedToNodeId: 'mb_hq_router', connectedToPortId: 'mb_hq_r_p1' }],
    },
    {
      id: 'mb_hq_router',
      name: 'HQ-Router',
      deviceCount: 1,
      peers: ['mb_hq_wan', 'mb_branch_a_router', 'mb_branch_b_router'],
      type: 'router',
      ospf: { enabled: true, areaId: 0 },
      ports: [
        { id: 'mb_hq_r_p1', name: 'Serial0/0', connectedToNodeId: 'mb_hq_wan', connectedToPortId: 'mb_hq_wan_p1' },
        { id: 'mb_hq_r_p2', name: 'GigabitEthernet0/1', connectedToNodeId: 'mb_branch_a_router', connectedToPortId: 'mb_ba_r_p1' },
        { id: 'mb_hq_r_p3', name: 'GigabitEthernet0/2', connectedToNodeId: 'mb_branch_b_router', connectedToPortId: 'mb_bb_r_p1' },
        { id: 'mb_hq_r_p4', name: 'GigabitEthernet0/3', connectedToNodeId: 'mb_hq_users', connectedToPortId: 'mb_hq_u_p1' },
      ],
    },
    {
      id: 'mb_branch_a_router',
      name: 'Branch-A-Router',
      deviceCount: 1,
      peers: ['mb_hq_router'],
      type: 'router',
      ospf: { enabled: true, areaId: 1 },
      ports: [
        { id: 'mb_ba_r_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'mb_hq_router', connectedToPortId: 'mb_hq_r_p2' },
        { id: 'mb_ba_r_p2', name: 'GigabitEthernet0/1', connectedToNodeId: 'mb_branch_a_users', connectedToPortId: 'mb_ba_u_p1' },
      ],
    },
    {
      id: 'mb_branch_b_router',
      name: 'Branch-B-Router',
      deviceCount: 1,
      peers: ['mb_hq_router'],
      type: 'router',
      ospf: { enabled: true, areaId: 2 },
      ports: [
        { id: 'mb_bb_r_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'mb_hq_router', connectedToPortId: 'mb_hq_r_p3' },
        { id: 'mb_bb_r_p2', name: 'GigabitEthernet0/1', connectedToNodeId: 'mb_branch_b_users', connectedToPortId: 'mb_bb_u_p1' },
      ],
    },
    {
      id: 'mb_hq_users',
      name: 'HQ Staff',
      deviceCount: 50,
      peers: ['mb_hq_router'],
      type: 'department',
      cidrPrefix: 26,
      ports: [{ id: 'mb_hq_u_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'mb_hq_router', connectedToPortId: 'mb_hq_r_p4' }],
    },
    {
      id: 'mb_branch_a_users',
      name: 'Branch A Staff',
      deviceCount: 20,
      peers: ['mb_branch_a_router'],
      type: 'department',
      cidrPrefix: 28,
      ports: [{ id: 'mb_ba_u_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'mb_branch_a_router', connectedToPortId: 'mb_ba_r_p2' }],
    },
    {
      id: 'mb_branch_b_users',
      name: 'Branch B Staff',
      deviceCount: 15,
      peers: ['mb_branch_b_router'],
      type: 'department',
      cidrPrefix: 28,
      ports: [{ id: 'mb_bb_u_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'mb_branch_b_router', connectedToPortId: 'mb_bb_r_p2' }],
    },
  ]
  return buildConfig('tpl_multi_branch', userId, 'Multi-Branch WAN', depts, '172.16.0.0', 10)
}

// ─── Template 4: Data Center Spine-Leaf ──────────────────────────────────────
function getDataCenterConfig(userId: string): NetworkConfig {
  const depts: NetworkNode[] = [
    {
      id: 'dc_spine1',
      name: 'Spine-1',
      deviceCount: 1,
      peers: ['dc_leaf1', 'dc_leaf2', 'dc_leaf3'],
      type: 'router',
      ospf: { enabled: true, areaId: 0 },
      ports: [
        { id: 'dc_s1_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'dc_leaf1', connectedToPortId: 'dc_l1_p1' },
        { id: 'dc_s1_p2', name: 'GigabitEthernet0/2', connectedToNodeId: 'dc_leaf2', connectedToPortId: 'dc_l2_p1' },
        { id: 'dc_s1_p3', name: 'GigabitEthernet0/3', connectedToNodeId: 'dc_leaf3', connectedToPortId: 'dc_l3_p1' },
      ],
    },
    {
      id: 'dc_spine2',
      name: 'Spine-2',
      deviceCount: 1,
      peers: ['dc_leaf1', 'dc_leaf2', 'dc_leaf3'],
      type: 'router',
      ospf: { enabled: true, areaId: 0 },
      ports: [
        { id: 'dc_s2_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'dc_leaf1', connectedToPortId: 'dc_l1_p2' },
        { id: 'dc_s2_p2', name: 'GigabitEthernet0/2', connectedToNodeId: 'dc_leaf2', connectedToPortId: 'dc_l2_p2' },
        { id: 'dc_s2_p3', name: 'GigabitEthernet0/3', connectedToNodeId: 'dc_leaf3', connectedToPortId: 'dc_l3_p2' },
      ],
    },
    {
      id: 'dc_leaf1',
      name: 'Leaf-1',
      deviceCount: 1,
      peers: ['dc_spine1', 'dc_spine2'],
      type: 'switch',
      ports: [
        { id: 'dc_l1_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'dc_spine1', connectedToPortId: 'dc_s1_p1', vlanMode: 'trunk', vlanTrunkAllowed: [100, 200] },
        { id: 'dc_l1_p2', name: 'GigabitEthernet0/2', connectedToNodeId: 'dc_spine2', connectedToPortId: 'dc_s2_p1', vlanMode: 'trunk', vlanTrunkAllowed: [100, 200] },
        { id: 'dc_l1_p3', name: 'GigabitEthernet0/3', connectedToNodeId: 'dc_compute_a', connectedToPortId: 'dc_ca_p1', vlanMode: 'access', vlanAccessId: 100 },
      ],
    },
    {
      id: 'dc_leaf2',
      name: 'Leaf-2',
      deviceCount: 1,
      peers: ['dc_spine1', 'dc_spine2'],
      type: 'switch',
      ports: [
        { id: 'dc_l2_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'dc_spine1', connectedToPortId: 'dc_s1_p2', vlanMode: 'trunk', vlanTrunkAllowed: [100, 200] },
        { id: 'dc_l2_p2', name: 'GigabitEthernet0/2', connectedToNodeId: 'dc_spine2', connectedToPortId: 'dc_s2_p2', vlanMode: 'trunk', vlanTrunkAllowed: [100, 200] },
        { id: 'dc_l2_p3', name: 'GigabitEthernet0/3', connectedToNodeId: 'dc_compute_b', connectedToPortId: 'dc_cb_p1', vlanMode: 'access', vlanAccessId: 100 },
      ],
    },
    {
      id: 'dc_leaf3',
      name: 'Leaf-3 (Storage)',
      deviceCount: 1,
      peers: ['dc_spine1', 'dc_spine2'],
      type: 'switch',
      ports: [
        { id: 'dc_l3_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'dc_spine1', connectedToPortId: 'dc_s1_p3', vlanMode: 'trunk', vlanTrunkAllowed: [200] },
        { id: 'dc_l3_p2', name: 'GigabitEthernet0/2', connectedToNodeId: 'dc_spine2', connectedToPortId: 'dc_s2_p3', vlanMode: 'trunk', vlanTrunkAllowed: [200] },
        { id: 'dc_l3_p3', name: 'GigabitEthernet0/3', connectedToNodeId: 'dc_storage', connectedToPortId: 'dc_st_p1', vlanMode: 'access', vlanAccessId: 200 },
      ],
    },
    {
      id: 'dc_compute_a',
      name: 'Compute-Rack-A',
      deviceCount: 10,
      peers: ['dc_leaf1'],
      type: 'department',
      cidrPrefix: 28,
      ports: [{ id: 'dc_ca_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'dc_leaf1', connectedToPortId: 'dc_l1_p3' }],
    },
    {
      id: 'dc_compute_b',
      name: 'Compute-Rack-B',
      deviceCount: 10,
      peers: ['dc_leaf2'],
      type: 'department',
      cidrPrefix: 28,
      ports: [{ id: 'dc_cb_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'dc_leaf2', connectedToPortId: 'dc_l2_p3' }],
    },
    {
      id: 'dc_storage',
      name: 'Storage Array',
      deviceCount: 4,
      peers: ['dc_leaf3'],
      type: 'department',
      cidrPrefix: 29,
      ports: [{ id: 'dc_st_p1', name: 'GigabitEthernet0/1', connectedToNodeId: 'dc_leaf3', connectedToPortId: 'dc_l3_p3' }],
    },
  ]
  return buildConfig('tpl_datacenter', userId, 'Data Center Spine-Leaf', depts, '10.100.0.0', 100)
}

// ─── Template 5: ISP Core Network ────────────────────────────────────────────
function getISPCoreConfig(userId: string): NetworkConfig {
  const depts: NetworkNode[] = [
    {
      id: 'isp_backbone_a',
      name: 'Backbone-PoP-A',
      deviceCount: 1,
      peers: ['isp_backbone_b', 'isp_access_a'],
      type: 'router',
      ospf: { enabled: true, areaId: 0 },
      ports: [
        { id: 'isp_ba_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'isp_backbone_b', connectedToPortId: 'isp_bb_p1' },
        { id: 'isp_ba_p2', name: 'GigabitEthernet0/1', connectedToNodeId: 'isp_access_a', connectedToPortId: 'isp_aa_p1' },
      ],
    },
    {
      id: 'isp_backbone_b',
      name: 'Backbone-PoP-B',
      deviceCount: 1,
      peers: ['isp_backbone_a', 'isp_access_b', 'isp_transit'],
      type: 'router',
      ospf: { enabled: true, areaId: 0 },
      ports: [
        { id: 'isp_bb_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'isp_backbone_a', connectedToPortId: 'isp_ba_p1' },
        { id: 'isp_bb_p2', name: 'GigabitEthernet0/1', connectedToNodeId: 'isp_access_b', connectedToPortId: 'isp_ab_p1' },
        { id: 'isp_bb_p3', name: 'GigabitEthernet0/2', connectedToNodeId: 'isp_transit', connectedToPortId: 'isp_tr_p1' },
      ],
    },
    {
      id: 'isp_transit',
      name: 'Transit / Peering',
      deviceCount: 1,
      peers: ['isp_backbone_b'],
      type: 'wan',
      ports: [{ id: 'isp_tr_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'isp_backbone_b', connectedToPortId: 'isp_bb_p3' }],
    },
    {
      id: 'isp_access_a',
      name: 'DSLAM-A',
      deviceCount: 1,
      peers: ['isp_backbone_a'],
      type: 'switch',
      ports: [
        { id: 'isp_aa_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'isp_backbone_a', connectedToPortId: 'isp_ba_p2', vlanMode: 'trunk', vlanTrunkAllowed: [100, 200] },
        { id: 'isp_aa_p2', name: 'FastEthernet0/1', connectedToNodeId: 'isp_residential_a', connectedToPortId: 'isp_ra_p1', vlanMode: 'access', vlanAccessId: 100 },
      ],
    },
    {
      id: 'isp_access_b',
      name: 'DSLAM-B',
      deviceCount: 1,
      peers: ['isp_backbone_b'],
      type: 'switch',
      ports: [
        { id: 'isp_ab_p1', name: 'GigabitEthernet0/0', connectedToNodeId: 'isp_backbone_b', connectedToPortId: 'isp_bb_p2', vlanMode: 'trunk', vlanTrunkAllowed: [100, 200] },
        { id: 'isp_ab_p2', name: 'FastEthernet0/1', connectedToNodeId: 'isp_residential_b', connectedToPortId: 'isp_rb_p1', vlanMode: 'access', vlanAccessId: 100 },
        { id: 'isp_ab_p3', name: 'FastEthernet0/2', connectedToNodeId: 'isp_business', connectedToPortId: 'isp_biz_p1', vlanMode: 'access', vlanAccessId: 200 },
      ],
    },
    {
      id: 'isp_residential_a',
      name: 'Residential Zone A',
      deviceCount: 200,
      peers: ['isp_backbone_a'],
      type: 'department',
      cidrPrefix: 24,
      ports: [{ id: 'isp_ra_p1', name: 'FastEthernet0/1', connectedToNodeId: 'isp_access_a', connectedToPortId: 'isp_aa_p2' }],
    },
    {
      id: 'isp_residential_b',
      name: 'Residential Zone B',
      deviceCount: 150,
      peers: ['isp_backbone_b'],
      type: 'department',
      cidrPrefix: 24,
      ports: [{ id: 'isp_rb_p1', name: 'FastEthernet0/1', connectedToNodeId: 'isp_access_b', connectedToPortId: 'isp_ab_p2' }],
    },
    {
      id: 'isp_business',
      name: 'Business Clients',
      deviceCount: 40,
      peers: ['isp_backbone_b'],
      type: 'department',
      cidrPrefix: 26,
      ports: [{ id: 'isp_biz_p1', name: 'FastEthernet0/1', connectedToNodeId: 'isp_access_b', connectedToPortId: 'isp_ab_p3' }],
    },
  ]
  return buildConfig('tpl_isp_core', userId, 'ISP Core Network', depts, '203.0.113.0', 100)
}

// ─── Templates Registry ────────────────────────────────────────────────────────
export const NETWORK_TEMPLATES: NetworkTemplate[] = [
  {
    id: 'small_biz',
    name: 'Small Business',
    iconName: 'Storefront',
    description: 'Simple office network with staff, guest WiFi, and file servers.',
    scenario: 'Set up network segmentation so guest WiFi cannot access internal file servers.',
    highlights: ['VLAN isolation', 'Guest ACLs', 'Basic routing'],
    algorithmTeaser: 'Tap Staff and File Servers to trace the route — or guest WiFi to see it get blocked.',
    getConfig: getSmallBizConfig,
  },
  {
    id: 'enterprise_campus',
    name: 'Enterprise Campus',
    iconName: 'Buildings',
    description: 'Multi-department campus with core/distribution/access hierarchy.',
    scenario: 'Design a hierarchical campus network with department isolation and redundant paths.',
    highlights: ['Three-tier hierarchy', 'OSPF routing', 'VLAN segmentation', 'Firewall ACLs'],
    algorithmTeaser: 'Select Engineering and Data Center to see OSPF route selection in action.',
    getConfig: getEnterpriseCampusConfig,
  },
  {
    id: 'multi_branch',
    name: 'Multi-Branch WAN',
    iconName: 'Globe',
    description: 'HQ connected to two branch offices over a WAN backbone.',
    scenario: 'Connect branch offices to HQ and ensure traffic can route between all sites.',
    highlights: ['Multi-area OSPF', 'WAN links', 'Branch isolation'],
    algorithmTeaser: 'Select Branch A Staff and Branch B Staff to find the inter-office route.',
    getConfig: getMultiBranchConfig,
  },
  {
    id: 'datacenter',
    name: 'Data Center Spine-Leaf',
    iconName: 'HardDrives',
    description: 'Modern spine-leaf fabric with redundant uplinks from every leaf.',
    scenario: 'Design a high-availability data center fabric with no single point of failure.',
    highlights: ['Spine-leaf topology', 'Dual uplinks', 'Storage VLAN'],
    algorithmTeaser: 'Run Optimal Cabling Plan to see which links are truly necessary in the fabric.',
    getConfig: getDataCenterConfig,
  },
  {
    id: 'isp_core',
    name: 'ISP Core Network',
    iconName: 'Broadcast',
    description: 'Internet Service Provider backbone with PoP nodes and subscriber access.',
    scenario: 'Model an ISP backbone connecting residential and business subscribers to transit.',
    highlights: ['BGP transit', 'OSPF backbone', 'Subscriber segmentation'],
    algorithmTeaser: 'Find the route from Residential Zone A to Business Clients through the backbone.',
    getConfig: getISPCoreConfig,
  },
]

export function getTemplateConfig(templateId: string, userId: string): NetworkConfig | null {
  const template = NETWORK_TEMPLATES.find((t) => t.id === templateId)
  if (!template) return null
  return template.getConfig(userId)
}
