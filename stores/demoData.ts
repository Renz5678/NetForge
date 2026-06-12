import { topologicalSort } from '@/lib/algorithms/topologicalSort'
import { allocateSubnets } from '@/lib/algorithms/subnetAllocator'
import { ipToUint32, uint32ToIp } from '@/lib/ipUtils'
import type { NetworkNode, RouterNode, FirewallNode, WanNode, DepartmentNode, NetworkConfig } from '@/types'

export function getDemoEnterpriseConfig(userId: string): NetworkConfig {
  const depts: NetworkNode[] = [
    {
      id: 'demo_wan_cloud',
      name: 'WAN-Cloud',
      deviceCount: 1,
      peers: ['demo_firewall'],
      vlanId: 10,
      cidrPrefix: 30,
      usableHosts: 2,
      type: 'wan',
      ports: [
        { id: 'port_wan_1', name: 'GigabitEthernet0/0', connectedToNodeId: 'demo_firewall', connectedToPortId: 'port_fw_2' }
      ]
    },
    {
      id: 'demo_firewall',
      name: 'Firewall',
      deviceCount: 2,
      peers: ['demo_core_router'],
      vlanId: 11,
      cidrPrefix: 30,
      usableHosts: 2,
      type: 'firewall',
      ports: [
        { id: 'port_fw_1', name: 'GigabitEthernet0/1', connectedToNodeId: 'demo_core_router', connectedToPortId: 'port_cr_2' },
        { id: 'port_fw_2', name: 'GigabitEthernet0/0', connectedToNodeId: 'demo_wan_cloud', connectedToPortId: 'port_wan_1' }
      ],
      aclRules: [
        { id: 'acl_fw_1', sequence: 10, action: 'deny', protocol: 'ip', srcCidr: '10.0.0.0/24', dstCidr: 'any', remark: 'Block spoofed local IPs from WAN' },
        { id: 'acl_fw_2', sequence: 20, action: 'permit', protocol: 'ip', srcCidr: 'any', dstCidr: 'any' }
      ]
    },
    {
      id: 'demo_core_router',
      name: 'Core-Router',
      deviceCount: 2,
      peers: [],
      vlanId: 12,
      cidrPrefix: 29,
      usableHosts: 6,
      type: 'router',
      ports: [
        { id: 'port_cr_1', name: 'GigabitEthernet0/0', connectedToNodeId: 'demo_switch_hq', connectedToPortId: 'port_sw_1' },
        { id: 'port_cr_2', name: 'GigabitEthernet0/1', connectedToNodeId: 'demo_firewall', connectedToPortId: 'port_fw_1' }
      ],
      ospf: { enabled: true, areaId: 0 }
    },
    {
      id: 'demo_switch_hq',
      name: 'Switch-HQ',
      deviceCount: 1,
      peers: ['demo_core_router'],
      vlanId: 13,
      cidrPrefix: 29,
      usableHosts: 6,
      type: 'switch',
      ports: [
        { id: 'port_sw_1', name: 'GigabitEthernet0/1', connectedToNodeId: 'demo_core_router', connectedToPortId: 'port_cr_1', vlanMode: 'trunk', vlanTrunkAllowed: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
        { id: 'port_sw_2', name: 'FastEthernet0/1', connectedToNodeId: 'demo_engineering', connectedToPortId: 'port_sw_2', vlanMode: 'access', vlanAccessId: 14 },
        { id: 'port_sw_3', name: 'FastEthernet0/2', connectedToNodeId: 'demo_finance', connectedToPortId: 'port_sw_3', vlanMode: 'access', vlanAccessId: 15 },
        { id: 'port_sw_4', name: 'GigabitEthernet0/2', connectedToNodeId: 'demo_server_switch', connectedToPortId: 'port_ssw_1', vlanMode: 'trunk', vlanTrunkAllowed: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
        { id: 'port_sw_5', name: 'FastEthernet0/3', connectedToNodeId: 'demo_marketing', connectedToPortId: 'port_mkt_1', vlanMode: 'access', vlanAccessId: 16 },
        { id: 'port_sw_6', name: 'FastEthernet0/4', connectedToNodeId: 'demo_rd_labs', connectedToPortId: 'port_rd_1', vlanMode: 'access', vlanAccessId: 17 }
      ]
    },
    {
      id: 'demo_engineering',
      name: 'Engineering',
      deviceCount: 45,
      peers: ['demo_core_router'],
      vlanId: 14,
      cidrPrefix: 26,
      usableHosts: 62,
      type: 'department',
      ports: [
        { id: 'port_eng_1', name: 'FastEthernet0/1', connectedToNodeId: 'demo_switch_hq', connectedToPortId: 'port_sw_2' }
      ]
    },
    {
      id: 'demo_finance',
      name: 'Finance-HR',
      deviceCount: 14,
      peers: ['demo_core_router'],
      vlanId: 15,
      cidrPrefix: 28,
      usableHosts: 14,
      type: 'department',
      ports: [
        { id: 'port_fin_1', name: 'FastEthernet0/1', connectedToNodeId: 'demo_switch_hq', connectedToPortId: 'port_sw_3' }
      ],
      aclRules: [
        { id: 'acl_fin_1', sequence: 10, action: 'deny', protocol: 'ip', srcCidr: '10.0.0.16/26', dstCidr: '10.0.0.80/28', remark: 'Block Eng access to Finance' },
        { id: 'acl_fin_2', sequence: 20, action: 'permit', protocol: 'ip', srcCidr: 'any', dstCidr: 'any' }
      ]
    },
    {
      id: 'demo_marketing',
      name: 'Marketing',
      deviceCount: 20,
      peers: ['demo_core_router'],
      vlanId: 16,
      cidrPrefix: 27,
      usableHosts: 30,
      type: 'department',
      ports: [
        { id: 'port_mkt_1', name: 'FastEthernet0/1', connectedToNodeId: 'demo_switch_hq', connectedToPortId: 'port_sw_5' }
      ]
    },
    {
      id: 'demo_rd_labs',
      name: 'R-D-Labs',
      deviceCount: 30,
      peers: ['demo_core_router'],
      vlanId: 17,
      cidrPrefix: 27,
      usableHosts: 30,
      type: 'department',
      ports: [
        { id: 'port_rd_1', name: 'FastEthernet0/1', connectedToNodeId: 'demo_switch_hq', connectedToPortId: 'port_sw_6' }
      ]
    },
    {
      id: 'demo_server_switch',
      name: 'Server-Switch',
      deviceCount: 1,
      peers: ['demo_core_router'],
      vlanId: 18,
      cidrPrefix: 29,
      usableHosts: 6,
      type: 'switch',
      ports: [
        { id: 'port_ssw_1', name: 'GigabitEthernet0/2', connectedToNodeId: 'demo_switch_hq', connectedToPortId: 'port_sw_4', vlanMode: 'trunk', vlanTrunkAllowed: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
        { id: 'port_ssw_2', name: 'FastEthernet0/1', connectedToNodeId: 'demo_server_cluster', connectedToPortId: 'port_sc_1', vlanMode: 'access', vlanAccessId: 19 }
      ]
    },
    {
      id: 'demo_server_cluster',
      name: 'Server-Cluster',
      deviceCount: 8,
      peers: ['demo_core_router'],
      vlanId: 19,
      cidrPrefix: 29,
      usableHosts: 6,
      type: 'department',
      ports: [
        { id: 'port_sc_1', name: 'FastEthernet0/1', connectedToNodeId: 'demo_server_switch', connectedToPortId: 'port_ssw_2' }
      ]
    }
  ]

  const sorted = topologicalSort(depts)
  const sortedDepts = sorted
    .map((id) => depts.find((d) => d.id === id))
    .filter((d): d is NetworkNode => d !== undefined)
  
  const allocated = allocateSubnets(sortedDepts, '10.0.0.0', 10)

  for (const dept of allocated) {
    if (dept.type === 'department' || !dept.type) {
      const connectedSwitch = allocated.find(s => s.ports?.some(p => p.connectedToNodeId === dept.id))
      if (connectedSwitch && connectedSwitch.ports) {
        const port = connectedSwitch.ports.find(p => p.connectedToNodeId === dept.id)
        if (port) {
          port.vlanAccessId = dept.vlanId
        }
      }
    }
  }

  const routerDept = allocated.find((d) => d.id === 'demo_core_router' && d.type === 'router') as RouterNode | undefined
  const fwDept = allocated.find((d) => d.id === 'demo_firewall' && d.type === 'firewall') as FirewallNode | undefined
  const wanDept = allocated.find((d) => d.id === 'demo_wan_cloud' && d.type === 'wan') as WanNode | undefined

  let nextHopIp = '10.0.0.2'

  if (routerDept && routerDept.ports && routerDept.ports[0]) {
    const routerIp = routerDept.subnet ? routerDept.subnet.split('/')[0] : '10.0.0.0'
    const baseNum = ipToUint32(routerIp)
    routerDept.ports[0].ipAddress = `${uint32ToIp(baseNum + 1)}/${routerDept.cidrPrefix}`
    nextHopIp = uint32ToIp(baseNum + 2)
  }

  if (routerDept && routerDept.ports && routerDept.ports[1] && fwDept && fwDept.ports && fwDept.ports[0]) {
    const fwIp = fwDept.subnet ? fwDept.subnet.split('/')[0] : '10.0.0.0'
    const fwBaseNum = ipToUint32(fwIp)
    fwDept.ports[0].ipAddress = `${uint32ToIp(fwBaseNum + 1)}/${fwDept.cidrPrefix}`
    routerDept.ports[1].ipAddress = `${uint32ToIp(fwBaseNum + 2)}/${fwDept.cidrPrefix}`
  }

  if (fwDept && fwDept.ports && fwDept.ports[1] && wanDept && wanDept.ports && wanDept.ports[0]) {
    const wanIp = wanDept.subnet ? wanDept.subnet.split('/')[0] : '10.0.0.0'
    const wanBaseNum = ipToUint32(wanIp)
    wanDept.ports[0].ipAddress = `${uint32ToIp(wanBaseNum + 1)}/${wanDept.cidrPrefix}`
    fwDept.ports[1].ipAddress = `${uint32ToIp(wanBaseNum + 2)}/${wanDept.cidrPrefix}`
  }

  if (routerDept && fwDept && wanDept) {
    const fwBaseNum = ipToUint32(fwDept.subnet!.split('/')[0])
    const wanBaseNum = ipToUint32(wanDept.subnet!.split('/')[0])

    const fwIp = uint32ToIp(fwBaseNum + 1)
    const routerFwIp = uint32ToIp(fwBaseNum + 2)
    const wanIp = uint32ToIp(wanBaseNum + 1)

    routerDept.staticRoutes = [
      { destination: '0.0.0.0/0', nextHop: fwIp },
      ...allocated
        .filter((d) => !['demo_core_router', 'demo_firewall', 'demo_wan_cloud'].includes(d.id) && d.subnet != null)
        .map((d) => ({
          destination: d.subnet!,
          nextHop: nextHopIp
        }))
    ]

    fwDept.staticRoutes = [
      { destination: '0.0.0.0/0', nextHop: wanIp },
      ...allocated
        .filter((d) => !['demo_firewall', 'demo_wan_cloud'].includes(d.id) && d.subnet != null)
        .map((d) => ({
          destination: d.subnet!,
          nextHop: routerFwIp
        }))
    ]

    wanDept.staticRoutes = [
      { destination: '10.0.0.0/16', nextHop: uint32ToIp(wanBaseNum + 2) }
    ]
  }

  const engDept = allocated.find((d) => d.id === 'demo_engineering')
  const finDept = allocated.find((d) => d.id === 'demo_finance') as (FirewallNode | DepartmentNode) | undefined
  if (engDept?.subnet && finDept?.subnet) {
    const finRule = finDept.aclRules?.find((r) => r.id === 'acl_fin_1')
    if (finRule) {
      finRule.srcCidr = engDept.subnet
      finRule.dstCidr = finDept.subnet
    }
  }

  return {
    id: 'demo_enterprise_config_v5',
    userId,
    name: '🏢 Enterprise Campus Network (Demo)',
    departments: allocated,
    baseIp: '10.0.0.0',
    vlanStart: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isValid: true
  }
}
