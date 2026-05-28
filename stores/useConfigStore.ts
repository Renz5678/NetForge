import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { detectCycles } from '@/lib/algorithms/cycleDetection'
import { topologicalSort } from '@/lib/algorithms/topologicalSort'
import { allocateSubnets } from '@/lib/algorithms/subnetAllocator'
import { ipToUint32, uint32ToIp } from '@/lib/ipUtils'
import type { Department, NetworkConfig } from '@/types'

const LOCAL_CONFIGS_KEY = '@netforge_configs'

type ConfigStore = {
  configs: NetworkConfig[]
  activeConfig: NetworkConfig | null
  loading: boolean
  error: string | null

  // Fetch & selection
  loadConfigs: (userId: string) => Promise<void>
  setActiveConfig: (id: string) => void

  // CRUD
  createConfig: (name: string, userId: string, baseIp?: string, vlanStart?: number) => Promise<NetworkConfig | null>
  updateConfig: (config: NetworkConfig) => Promise<void>
  deleteConfig: (id: string) => Promise<void>
  duplicateConfig: (id: string, userId: string) => Promise<void>

  // Department management (always modifies activeConfig)
  addDepartment: (dept: Department) => Promise<void>
  updateDepartment: (dept: Department) => Promise<void>
  deleteDepartment: (id: string) => Promise<void>

  // Allocation pipeline
  runAllocation: () => NetworkConfig | null
}

function snakeToCamel(config: Record<string, unknown>): NetworkConfig {
  return {
    id: config.id as string,
    userId: config.user_id as string,
    name: config.name as string,
    departments: (config.departments as Department[]) ?? [],
    baseIp: (config.base_ip as string) ?? '10.0.0.0',
    vlanStart: (config.vlan_start as number) ?? 10,
    createdAt: config.created_at as string,
    updatedAt: config.updated_at as string,
    isValid: config.is_valid as boolean | undefined,
  }
}

export function getDemoEnterpriseConfig(userId: string): NetworkConfig {
  const depts: Department[] = [
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
        { id: 'port_sw_2', name: 'FastEthernet0/1', connectedToNodeId: 'demo_engineering', connectedToPortId: 'port_eng_1', vlanMode: 'access', vlanAccessId: 14 },
        { id: 'port_sw_3', name: 'FastEthernet0/2', connectedToNodeId: 'demo_finance', connectedToPortId: 'port_fin_1', vlanMode: 'access', vlanAccessId: 15 },
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

  // Run topological sort & dynamic subnet allocation
  const sorted = topologicalSort(depts)
  const sortedDepts = sorted
    .map((id) => depts.find((d) => d.id === id))
    .filter((d): d is Department => d !== undefined)
  
  const allocated = allocateSubnets(sortedDepts, '10.0.0.0', 10)

  // Configure Switch Access Ports to match dynamic allocated VLANs
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

  // Configure IPs on interfaces dynamically
  const routerDept = allocated.find((d) => d.id === 'demo_core_router')
  const fwDept = allocated.find((d) => d.id === 'demo_firewall')
  const wanDept = allocated.find((d) => d.id === 'demo_wan_cloud')

  let nextHopIp = '10.0.0.2'

  // 1. Link Core-Router <-> Switch-HQ
  if (routerDept && routerDept.ports && routerDept.ports[0]) {
    const routerIp = routerDept.subnet ? routerDept.subnet.split('/')[0] : '10.0.0.0'
    const baseNum = ipToUint32(routerIp)
    routerDept.ports[0].ipAddress = `${uint32ToIp(baseNum + 1)}/${routerDept.cidrPrefix}`
    nextHopIp = uint32ToIp(baseNum + 2)
  }

  // 2. Link Core-Router <-> Firewall
  if (routerDept && routerDept.ports && routerDept.ports[1] && fwDept && fwDept.ports && fwDept.ports[0]) {
    const fwIp = fwDept.subnet ? fwDept.subnet.split('/')[0] : '10.0.0.0'
    const fwBaseNum = ipToUint32(fwIp)
    fwDept.ports[0].ipAddress = `${uint32ToIp(fwBaseNum + 1)}/${fwDept.cidrPrefix}`
    routerDept.ports[1].ipAddress = `${uint32ToIp(fwBaseNum + 2)}/${fwDept.cidrPrefix}`
  }

  // 3. Link Firewall <-> WAN-Cloud
  if (fwDept && fwDept.ports && fwDept.ports[1] && wanDept && wanDept.ports && wanDept.ports[0]) {
    const wanIp = wanDept.subnet ? wanDept.subnet.split('/')[0] : '10.0.0.0'
    const wanBaseNum = ipToUint32(wanIp)
    wanDept.ports[0].ipAddress = `${uint32ToIp(wanBaseNum + 1)}/${wanDept.cidrPrefix}`
    fwDept.ports[1].ipAddress = `${uint32ToIp(wanBaseNum + 2)}/${wanDept.cidrPrefix}`
  }

  // Populate static routes on Core-Router & Firewall
  if (routerDept && fwDept && wanDept) {
    const fwBaseNum = ipToUint32(fwDept.subnet!.split('/')[0])
    const wanBaseNum = ipToUint32(wanDept.subnet!.split('/')[0])

    const fwIp = uint32ToIp(fwBaseNum + 1)
    const routerFwIp = uint32ToIp(fwBaseNum + 2)
    const wanIp = uint32ToIp(wanBaseNum + 1)

    // Core-Router static routes
    routerDept.staticRoutes = [
      // Default gateway pointing upstream to Firewall
      { destination: '0.0.0.0/0', nextHop: fwIp },
      // Internal subnets pointing downstream to Switch-HQ
      ...allocated
        .filter((d) => !['demo_core_router', 'demo_firewall', 'demo_wan_cloud'].includes(d.id))
        .map((d) => ({
          destination: d.subnet!,
          nextHop: nextHopIp
        }))
    ]

    // Firewall static routes
    fwDept.staticRoutes = [
      // Default gateway pointing upstream to WAN-Cloud
      { destination: '0.0.0.0/0', nextHop: wanIp },
      // Internal subnets pointing downstream to Core-Router
      ...allocated
        .filter((d) => !['demo_firewall', 'demo_wan_cloud'].includes(d.id))
        .map((d) => ({
          destination: d.subnet!,
          nextHop: routerFwIp
        }))
    ]

    // WAN-Cloud static route back to all 10.0.0.0/16 subnets
    wanDept.staticRoutes = [
      { destination: '10.0.0.0/16', nextHop: uint32ToIp(wanBaseNum + 2) }
    ]
  }

  // Update ACL rules on Finance-HR to match dynamic subnets
  const engDept = allocated.find((d) => d.id === 'demo_engineering')
  const finDept = allocated.find((d) => d.id === 'demo_finance')
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

export const useConfigStore = create<ConfigStore>((set, get) => ({
  configs: [],
  activeConfig: null,
  loading: false,
  error: null,
 
  loadConfigs: async (userId) => {
    set({ loading: true, error: null })
    try {
      let configsList: NetworkConfig[] = []
      
      const { data, error } = await supabase
        .from('network_configs')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
 
      if (error) {
        console.warn('Supabase load failed, falling back to local storage:', error.message)
        const localData = await AsyncStorage.getItem(`${LOCAL_CONFIGS_KEY}_${userId}`)
        if (localData) {
          configsList = JSON.parse(localData)
        }
      } else {
        configsList = (data ?? []).map((row) => snakeToCamel(row as Record<string, unknown>))
        await AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(configsList))
      }

      // Filter out older stale demo configs to prevent duplicate listing and stale caches
      configsList = configsList.filter((c) => !c.id.startsWith('demo_enterprise_config') || c.id === 'demo_enterprise_config_v5')

      // Check and inject demo config
      const hasDemo = configsList.some((c) => c.id === 'demo_enterprise_config_v5')
      if (!hasDemo) {
        const demoConfig = getDemoEnterpriseConfig(userId)
        configsList = [demoConfig, ...configsList]
        await AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(configsList))
      }
 
      set({ configs: configsList, loading: false })
    } catch (err) {
      console.warn('loadConfigs exception, using local:', err)
      try {
        const localData = await AsyncStorage.getItem(`${LOCAL_CONFIGS_KEY}_${userId}`)
        let configsList: NetworkConfig[] = localData ? JSON.parse(localData) : []
        
        // Filter out older stale demo configs to prevent duplicate listing and stale caches
        configsList = configsList.filter((c) => !c.id.startsWith('demo_enterprise_config') || c.id === 'demo_enterprise_config_v5')

        const hasDemo = configsList.some((c: NetworkConfig) => c.id === 'demo_enterprise_config_v5')
        if (!hasDemo) {
          const demoConfig = getDemoEnterpriseConfig(userId)
          configsList = [demoConfig, ...configsList]
          await AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(configsList))
        }

        set({ configs: configsList, loading: false })
      } catch {
        const demoConfig = getDemoEnterpriseConfig(userId)
        set({ configs: [demoConfig], loading: false })
      }
    }
  },

  setActiveConfig: (id) => {
    const config = get().configs.find((c) => c.id === id) ?? null
    set({ activeConfig: config })
  },

  createConfig: async (name, userId, baseIp = '10.0.0.0', vlanStart = 10) => {
    try {
      const { data, error } = await supabase
        .from('network_configs')
        .insert({
          name,
          user_id: userId,
          base_ip: baseIp,
          vlan_start: vlanStart,
          departments: [],
        })
        .select()
        .single()

      let newConfig: NetworkConfig

      if (error || !data) {
        console.warn('Supabase create failed, creating local config:', error?.message)
        newConfig = {
          id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          userId,
          name,
          departments: [],
          baseIp,
          vlanStart,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isValid: true,
        }
      } else {
        newConfig = snakeToCamel(data as Record<string, unknown>)
      }

      set((state) => {
        const updatedConfigs = [newConfig, ...state.configs]
        AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)
        return { configs: updatedConfigs }
      })
      return newConfig
    } catch (err) {
      console.error('createConfig error:', err)
      const newConfig: NetworkConfig = {
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId,
        name,
        departments: [],
        baseIp,
        vlanStart,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isValid: true,
      }
      set((state) => {
        const updatedConfigs = [newConfig, ...state.configs]
        AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)
        return { configs: updatedConfigs }
      })
      return newConfig
    }
  },

  updateConfig: async (config) => {
    const { userId } = config
    try {
      const { error } = await supabase
        .from('network_configs')
        .update({
          name: config.name,
          departments: config.departments,
          base_ip: config.baseIp,
          vlan_start: config.vlanStart,
          is_valid: config.isValid,
        })
        .eq('id', config.id)

      if (error) {
        console.warn('Supabase update failed, updating locally:', error.message)
      }
    } catch (err) {
      console.warn('updateConfig exception:', err)
    }

    set((state) => {
      const updatedConfigs = state.configs.map((c) =>
        c.id === config.id ? { ...config, updatedAt: new Date().toISOString() } : c
      )
      const updatedActive = state.activeConfig?.id === config.id
        ? { ...config, updatedAt: new Date().toISOString() }
        : state.activeConfig

      AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)

      return {
        configs: updatedConfigs,
        activeConfig: updatedActive,
      }
    })
  },

  deleteConfig: async (id) => {
    const active = get().activeConfig
    const userId = active?.userId || get().configs.find((c) => c.id === id)?.userId
    try {
      const { error } = await supabase.from('network_configs').delete().eq('id', id)
      if (error) {
        console.warn('Supabase delete failed, deleting locally:', error.message)
      }
    } catch (err) {
      console.warn('deleteConfig exception:', err)
    }

    set((state) => {
      const updatedConfigs = state.configs.filter((c) => c.id !== id)
      if (userId) {
        AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)
      }
      return {
        configs: updatedConfigs,
        activeConfig: state.activeConfig?.id === id ? null : state.activeConfig,
      }
    })
  },

  duplicateConfig: async (id, userId) => {
    const config = get().configs.find((c) => c.id === id)
    if (!config) return

    try {
      const { data, error } = await supabase
        .from('network_configs')
        .insert({
          name: `Copy of ${config.name}`,
          user_id: userId,
          departments: config.departments,
          base_ip: config.baseIp,
          vlan_start: config.vlanStart,
          is_valid: config.isValid,
        })
        .select()
        .single()

      let newConfig: NetworkConfig

      if (error || !data) {
        console.warn('Supabase duplicate failed, duplicating locally:', error?.message)
        newConfig = {
          ...config,
          id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          name: `Copy of ${config.name}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      } else {
        newConfig = snakeToCamel(data as Record<string, unknown>)
      }

      set((state) => {
        const updatedConfigs = [newConfig, ...state.configs]
        AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)
        return { configs: updatedConfigs }
      })
    } catch (err) {
      console.error('duplicateConfig error:', err)
      const newConfig: NetworkConfig = {
        ...config,
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: `Copy of ${config.name}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      set((state) => {
        const updatedConfigs = [newConfig, ...state.configs]
        AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)
        return { configs: updatedConfigs }
      })
    }
  },

  addDepartment: async (dept) => {
    const { activeConfig } = get()
    if (!activeConfig) return

    const updated: NetworkConfig = {
      ...activeConfig,
      departments: [...activeConfig.departments, dept],
    }
    set({ activeConfig: updated })
    const allocated = get().runAllocation()
    await get().updateConfig(allocated ?? get().activeConfig!)
  },

  updateDepartment: async (dept) => {
    const { activeConfig } = get()
    if (!activeConfig) return

    const updated: NetworkConfig = {
      ...activeConfig,
      departments: activeConfig.departments.map((d) => (d.id === dept.id ? dept : d)),
    }
    set({ activeConfig: updated })
    const allocated = get().runAllocation()
    await get().updateConfig(allocated ?? get().activeConfig!)
  },

  deleteDepartment: async (id) => {
    const { activeConfig } = get()
    if (!activeConfig) return

    // Remove the department AND remove it from any other departments' peer lists
    const filtered = activeConfig.departments.filter((d) => d.id !== id)
    const cleaned = filtered.map((d) => ({
      ...d,
      peers: d.peers.filter((p) => p !== id),
    }))

    const updated: NetworkConfig = { ...activeConfig, departments: cleaned }
    set({ activeConfig: updated })
    const allocated = get().runAllocation()
    await get().updateConfig(allocated ?? get().activeConfig!)
  },

  runAllocation: () => {
    const { activeConfig } = get()
    if (!activeConfig) return null

    const departments = activeConfig.departments

    if (departments.length === 0) {
      const result: NetworkConfig = { ...activeConfig, isValid: true }
      set({ activeConfig: result })
      return result
    }

    // Step 1: Cycle detection
    const { hasCycle } = detectCycles(departments)

    if (hasCycle) {
      // Mark all departments with undefined subnet, set invalid
      const cleared = departments.map((d) => ({
        ...d,
        subnet: undefined,
        vlanId: undefined,
        cidrPrefix: undefined,
        usableHosts: undefined,
      }))
      const result: NetworkConfig = {
        ...activeConfig,
        departments: cleared,
        isValid: false,
      }
      set({ activeConfig: result })
      return result
    }

    // Step 2: Topological sort
    const sorted = topologicalSort(departments)

    // Reorder departments by sort order
    const sortedDepts = sorted
      .map((id) => departments.find((d) => d.id === id))
      .filter((d): d is Department => d !== undefined)

    // Include any departments not in sort (shouldn't happen but safety net)
    const missing = departments.filter((d) => !sorted.includes(d.id))
    const orderedDepts = [...sortedDepts, ...missing]

    // Step 3: Subnet allocation
    try {
      const allocated = allocateSubnets(orderedDepts, activeConfig.baseIp, activeConfig.vlanStart)
      const result: NetworkConfig = {
        ...activeConfig,
        departments: allocated,
        isValid: true,
      }
      set({ activeConfig: result })
      return result
    } catch {
      const result: NetworkConfig = { ...activeConfig, isValid: false }
      set({ activeConfig: result })
      return result
    }
  },
}))
