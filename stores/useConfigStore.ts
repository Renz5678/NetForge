import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { detectCycles } from '@/lib/algorithms/cycleDetection'
import { topologicalSort } from '@/lib/algorithms/topologicalSort'
import { allocateSubnets } from '@/lib/algorithms/subnetAllocator'
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

      set({ configs: configsList, loading: false })
    } catch (err) {
      console.warn('loadConfigs exception, using local:', err)
      try {
        const localData = await AsyncStorage.getItem(`${LOCAL_CONFIGS_KEY}_${userId}`)
        const configsList = localData ? JSON.parse(localData) : []
        set({ configs: configsList, loading: false })
      } catch {
        set({ configs: [], loading: false })
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
