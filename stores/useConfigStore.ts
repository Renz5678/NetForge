import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { supabase } from '@/lib/supabase'
import { detectCycles } from '@/lib/algorithms/cycleDetection'
import { topologicalSort } from '@/lib/algorithms/topologicalSort'
import { allocateSubnets } from '@/lib/algorithms/subnetAllocator'
import { findMinimumSpanningTree } from '@/lib/algorithms/prims'
import { getEdgeWeight } from '@/lib/algorithms/edgeWeights'
import { ipToUint32, uint32ToIp } from '@/lib/ipUtils'
import { DepartmentSchema } from '@/lib/validators'
import type { NetworkNode, RouterNode, FirewallNode, WanNode, DepartmentNode, NetworkConfig, NetworkInsight, MSTEdge } from '@/types'
import { useAuthStore } from '@/stores/useAuthStore'
import { getDemoEnterpriseConfig } from './demoData'
const LOCAL_CONFIGS_KEY = '@netforge_configs'

export type PendingOp = {
  type: 'create' | 'update' | 'delete'
  configId: string
  configData?: NetworkConfig
  timestamp: number
}

type ConfigStore = {
  configs: NetworkConfig[]
  activeConfig: NetworkConfig | null
  loading: boolean
  error: string | null
  pendingOps: PendingOp[]
  syncing: boolean
  conflictConfig: { local: NetworkConfig; remote: NetworkConfig } | null

  // ── Passive algorithm outputs (always up-to-date) ──────────────────────────
  // Prim's MST — recomputed on every topology change
  activeMstEdges: MSTEdge[]
  activeMstCost: number
  // Cycle detection result — recomputed on every topology change
  activeHasCycle: boolean

  // Explain Mode: when true, algorithm decisions become visible
  explainMode: boolean
  setExplainMode: (enabled: boolean) => void

  isCreateModalOpen: boolean
  setCreateModalOpen: (open: boolean) => void

  // Network Insights Panel: auto-surfaced findings
  insights: NetworkInsight[]
  addInsight: (insight: NetworkInsight) => void
  removeInsight: (id: string) => void
  clearInsights: () => void

  // Fetch & selection
  loadConfigs: (userId: string) => Promise<void>
  setActiveConfig: (id: string) => void

  // CRUD
  createConfig: (name: string, userId: string, baseIp?: string, vlanStart?: number) => Promise<NetworkConfig | null>
  updateConfig: (config: NetworkConfig) => Promise<void>
  deleteConfig: (id: string) => Promise<void>
  duplicateConfig: (id: string, userId: string) => Promise<void>

  // NetworkNode management (always modifies activeConfig)
  addDepartment: (dept: NetworkNode) => Promise<void>
  updateDepartment: (dept: NetworkNode) => Promise<void>
  deleteDepartment: (id: string) => Promise<void>

  // Allocation pipeline
  runAllocation: () => NetworkConfig | null

  // Offline Sync helper actions
  enqueueOp: (op: PendingOp, userId: string) => Promise<void>
  flushPendingOps: (userId: string) => Promise<void>
  resolveConflict: (choice: 'local' | 'cloud', userId: string) => Promise<void>

  // Local-only helpers
  /** Inserts or replaces a config in local state without touching Supabase.
   * Safe to call from onboarding flows, demos, and test fixtures. */
  injectLocalConfig: (config: NetworkConfig) => void

  // Internal subscription guard — kept in store to avoid cross-test pollution
  isNetInfoSubscribed: boolean
}

function snakeToCamel(config: Record<string, unknown>): NetworkConfig {
  return {
    id: config.id as string,
    userId: config.user_id as string,
    name: config.name as string,
    departments: (config.departments as NetworkNode[]) ?? [],
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
  pendingOps: [],
  syncing: false,
  conflictConfig: null,
  isNetInfoSubscribed: false,
  // Passive algorithm outputs — empty until first runAllocation()
  activeMstEdges: [],
  activeMstCost: 0,
  activeHasCycle: false,
  explainMode: false,
  setExplainMode: (enabled) => set({ explainMode: enabled }),

  isCreateModalOpen: false,
  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),

  insights: [],
  addInsight: (insight) => set((state) => ({
    insights: [
      insight,
      ...state.insights.filter((i) => i.id !== insight.id),
    ].slice(0, 20), // keep max 20 insights
  })),

  removeInsight: (id) => set((state) => ({
    insights: state.insights.filter((i) => i.id !== id),
  })),

  clearInsights: () => set({ insights: [] }),

  loadConfigs: async (userId) => {
    set({ loading: true, error: null })
    
    // 1. Load pending ops from storage first
    try {
      const pendingData = await AsyncStorage.getItem(`@netforge_pending_ops_${userId}`)
      if (pendingData) {
        set({ pendingOps: JSON.parse(pendingData) })
      }
    } catch (e) {
      console.warn('Failed to load pending ops:', e)
    }

    // 2. Setup NetInfo Sync Listener once per store instance
    // isNetInfoSubscribed lives in Zustand state (not a module-level let) so tests
    // that reset store state with setState() will also reset the subscription guard.
    if (!get().isNetInfoSubscribed) {
      set({ isNetInfoSubscribed: true })
      NetInfo.addEventListener((state) => {
        if (state.isConnected && state.isInternetReachable !== false) {
          const currentUserId = useAuthStore.getState().user?.id
          if (currentUserId) {
            get().flushPendingOps(currentUserId)
          }
        }
      })
    }

    // 3. Fetch remote configs
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
        
        // Merge Supabase configs with any pending optimistic local updates
        const pending = get().pendingOps
        configsList = configsList.map((remote) => {
          const matchingUpdate = pending.find((op) => op.configId === remote.id && op.type === 'update')
          return matchingUpdate && matchingUpdate.configData ? matchingUpdate.configData : remote
        })

        // Prepend any pending config creations that haven't reached Supabase yet
        const pendingCreates = pending
          .filter((op) => op.type === 'create' && op.configData)
          .map((op) => op.configData!)

        configsList = [...pendingCreates, ...configsList]

        await AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(configsList))
      }

      // Always replace the demo config so topology changes in demoData.ts are reflected.
      configsList = configsList.filter((c) => !c.id.startsWith('demo_enterprise_config'))
      const demoConfig = getDemoEnterpriseConfig(userId)
      configsList = [demoConfig, ...configsList]
      await AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(configsList))
 
      set({ configs: configsList, loading: false })

      // Trigger sync in background if online
      const net = await NetInfo.fetch()
      if (net.isConnected && net.isInternetReachable !== false) {
        get().flushPendingOps(userId)
      }
    } catch (err) {
      console.warn('loadConfigs exception, using local:', err)
      try {
        const localData = await AsyncStorage.getItem(`${LOCAL_CONFIGS_KEY}_${userId}`)
        let configsList: NetworkConfig[] = localData ? JSON.parse(localData) : []
        
        // Always replace the demo config so topology changes in demoData.ts are reflected.
        configsList = configsList.filter((c) => !c.id.startsWith('demo_enterprise_config'))
        const demoConfig = getDemoEnterpriseConfig(userId)
        configsList = [demoConfig, ...configsList]
        await AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(configsList))

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
    const tempId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const newConfig: NetworkConfig = {
      id: tempId,
      userId,
      name,
      departments: [],
      baseIp,
      vlanStart,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isValid: undefined,    // not yet validated — will be set after first allocation run
    }

    // 1. Apply local change immediately (Optimistic)
    set((state) => {
      const updatedConfigs = [newConfig, ...state.configs]
      AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)
      return { configs: updatedConfigs }
    })

    // 2. Queue the pending creation
    const op: PendingOp = {
      type: 'create',
      configId: tempId,
      configData: newConfig,
      timestamp: Date.now(),
    }
    await get().enqueueOp(op, userId)

    return newConfig
  },

  updateConfig: async (config) => {
    const { userId } = config
    const updatedAt = new Date().toISOString()
    const updatedConfig = { ...config, updatedAt }

    // 1. Apply local change immediately (Optimistic)
    set((state) => {
      const updatedConfigs = state.configs.map((c) => (c.id === config.id ? updatedConfig : c))
      const updatedActive = state.activeConfig?.id === config.id ? updatedConfig : state.activeConfig

      AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)

      return {
        configs: updatedConfigs,
        activeConfig: updatedActive,
      }
    })

    // 2. Queue the pending update
    const op: PendingOp = {
      type: 'update',
      configId: config.id,
      configData: updatedConfig,
      timestamp: Date.now(),
    }
    await get().enqueueOp(op, userId)
  },

  deleteConfig: async (id) => {
    const active = get().activeConfig
    const userId = active?.userId || get().configs.find((c) => c.id === id)?.userId
    if (!userId) return

    // 1. Apply local change immediately (Optimistic)
    set((state) => {
      const updatedConfigs = state.configs.filter((c) => c.id !== id)
      AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)
      return {
        configs: updatedConfigs,
        activeConfig: state.activeConfig?.id === id ? null : state.activeConfig,
      }
    })

    // 2. Queue the pending delete
    const op: PendingOp = {
      type: 'delete',
      configId: id,
      timestamp: Date.now(),
    }
    await get().enqueueOp(op, userId)
  },

  duplicateConfig: async (id, userId) => {
    const config = get().configs.find((c) => c.id === id)
    if (!config) return

    const tempId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const duplicatedConfig: NetworkConfig = {
      ...config,
      id: tempId,
      name: `Copy of ${config.name}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    set((state) => {
      const updatedConfigs = [duplicatedConfig, ...state.configs]
      AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)
      return { configs: updatedConfigs }
    })

    const op: PendingOp = {
      type: 'create',
      configId: tempId,
      configData: duplicatedConfig,
      timestamp: Date.now(),
    }
    await get().enqueueOp(op, userId)
  },

  addDepartment: async (dept) => {
    // Validate NetworkNode model via Zod prior to saving
    try {
      DepartmentSchema.parse(dept)
    } catch (validationErr) {
      console.warn('addDepartment: invalid NetworkNode data', validationErr)
      throw validationErr
    }

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
    // Validate NetworkNode model via Zod prior to saving
    try {
      DepartmentSchema.parse(dept)
    } catch (validationErr) {
      console.warn('updateDepartment: invalid NetworkNode data', validationErr)
      throw validationErr
    }

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
      set({ activeConfig: result, activeMstEdges: [], activeMstCost: 0, activeHasCycle: false })
      return result
    }

    const { hasCycle } = detectCycles(departments)

    if (hasCycle) {
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
      set({ activeConfig: result, activeMstEdges: [], activeMstCost: 0, activeHasCycle: true })
      return result
    }

    const sorted = topologicalSort(departments)

    const sortedDepts = sorted
      .map((id) => departments.find((d) => d.id === id))
      .filter((d): d is NetworkNode => d !== undefined)

    const missing = departments.filter((d) => !sorted.includes(d.id))
    const orderedDepts = [...sortedDepts, ...missing]

    try {
      const allocated = allocateSubnets(orderedDepts, activeConfig.baseIp, activeConfig.vlanStart)
      const result: NetworkConfig = {
        ...activeConfig,
        departments: allocated,
        isValid: true,
      }

      // ── Prim's MST: compute backbone for passive overlay ───────────────────
      // Pick the root: first WAN node, then first router, then first node.
      const rootNode =
        allocated.find((d) => d.type === 'wan') ??
        allocated.find((d) => d.type === 'router') ??
        allocated[0]

      let activeMstEdges: MSTEdge[] = []
      let activeMstCost = 0

      if (rootNode && allocated.length >= 2) {
        // Build edge-weight map keyed as "srcId→tgtId"
        const edgeWeightMap = new Map<string, number>()
        const idSet = new Set(allocated.map((d) => d.id))
        for (const dept of allocated) {
          for (const peerId of dept.peers) {
            if (!idSet.has(peerId)) continue
            const peer = allocated.find((d) => d.id === peerId)
            if (!peer) continue
            const w = getEdgeWeight(dept, peer)
            edgeWeightMap.set(`${dept.id}→${peerId}`, w)
            edgeWeightMap.set(`${peerId}→${dept.id}`, w)
          }
        }
        const mstResult = findMinimumSpanningTree(allocated, rootNode.id, edgeWeightMap)
        if (mstResult) {
          activeMstEdges = mstResult.mstEdges
          activeMstCost = mstResult.totalCost
        }
      }

      set({ activeConfig: result, activeMstEdges, activeMstCost, activeHasCycle: false })
      return result
    } catch {
      const result: NetworkConfig = { ...activeConfig, isValid: false }
      set({ activeConfig: result, activeMstEdges: [], activeMstCost: 0, activeHasCycle: false })
      return result
    }
  },

  enqueueOp: async (op, userId) => {
    set((state) => {
      let updatedOps = [...state.pendingOps]
      if (op.type === 'delete') {
        updatedOps = updatedOps.filter((o) => o.configId !== op.configId)
        if (!op.configId.startsWith('local_')) {
          updatedOps.push(op)
        }
      } else if (op.configId.startsWith('local_')) {
        // Skip syncing template / local-only configs entirely
      } else {
        updatedOps = updatedOps.filter(
          (o) => !(o.configId === op.configId && o.type === 'update')
        )
        const createOpIndex = updatedOps.findIndex((o) => o.configId === op.configId && o.type === 'create')
        if (createOpIndex !== -1) {
          updatedOps[createOpIndex] = {
            ...updatedOps[createOpIndex],
            configData: op.configData,
            timestamp: Date.now(),
          }
        } else {
          updatedOps.push(op)
        }
      }
      AsyncStorage.setItem(`@netforge_pending_ops_${userId}`, JSON.stringify(updatedOps)).catch(console.error)
      return { pendingOps: updatedOps }
    })

    // Try flushing queue in background immediately
    const net = await NetInfo.fetch()
    if (net.isConnected && net.isInternetReachable !== false) {
      get().flushPendingOps(userId)
    }
  },

  flushPendingOps: async (userId) => {
    // Don't sync if no real authenticated session (guest mode / offline)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!UUID_RE.test(userId)) return

    const { syncing, pendingOps, conflictConfig } = get()
    if (syncing || pendingOps.length === 0 || conflictConfig) return

    set({ syncing: true })
    const ops = [...pendingOps]
    let hasNetworkError = false

    while (ops.length > 0 && !hasNetworkError && !get().conflictConfig) {
      const op = ops[0]

      try {
        if (op.type === 'create') {
          const { data, error } = await supabase
            .from('network_configs')
            .insert({
              name: op.configData?.name,
              user_id: userId,
              base_ip: op.configData?.baseIp,
              vlan_start: op.configData?.vlanStart,
              departments: op.configData?.departments,
              is_valid: op.configData?.isValid,
            })
            .select()
            .single()

          if (error) throw error

          const remoteConfig = snakeToCamel(data as Record<string, unknown>)
          const oldId = op.configId
          const newId = remoteConfig.id

          set((state) => {
            const updatedConfigs = state.configs.map((c) => (c.id === oldId ? remoteConfig : c))
            const updatedActive = state.activeConfig?.id === oldId ? remoteConfig : state.activeConfig
            
            ops.forEach((o) => {
              if (o.configId === oldId) {
                o.configId = newId
                if (o.configData) {
                  o.configData.id = newId
                }
              }
            })

            AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)
            return { configs: updatedConfigs, activeConfig: updatedActive }
          })
        } 
        else if (op.type === 'update') {
          if (op.configId.startsWith('local_')) {
            break
          }

          const localConfig = op.configData
          if (!localConfig) {
            ops.shift()
            continue
          }

          // Conflict detection
          const { data: remoteData, error: fetchError } = await supabase
            .from('network_configs')
            .select('*')
            .eq('id', op.configId)
            .eq('user_id', userId)
            .single()

          if (remoteData && !fetchError) {
            const remoteConfig = snakeToCamel(remoteData as Record<string, unknown>)
            const remoteTime = new Date(remoteConfig.updatedAt).getTime()
            const localTime = new Date(localConfig.updatedAt).getTime()

            // Conflict if remote updatedAt is newer than local config's internal updatedAt timestamp
            if (remoteTime > localTime) {
              set({ conflictConfig: { local: localConfig, remote: remoteConfig }, syncing: false })
              return
            }
          }

          const { error } = await supabase
            .from('network_configs')
            .update({
              name: localConfig.name,
              departments: localConfig.departments,
              base_ip: localConfig.baseIp,
              vlan_start: localConfig.vlanStart,
              is_valid: localConfig.isValid,
              updated_at: new Date().toISOString(),
            })
            .eq('id', op.configId)
            .eq('user_id', userId)

          if (error) throw error
        } 
        else if (op.type === 'delete') {
          if (op.configId.startsWith('local_')) {
            ops.shift()
            continue
          }

          const { error } = await supabase
            .from('network_configs')
            .delete()
            .eq('id', op.configId)
            .eq('user_id', userId)

          if (error) throw error
        }

        ops.shift()
        set({ pendingOps: ops })
        await AsyncStorage.setItem(`@netforge_pending_ops_${userId}`, JSON.stringify(ops))

      } catch (err: any) {
        console.warn('Sync op failed:', err)
        const isNetworkErr = 
          err.message?.includes('FetchError') || 
          err.message?.includes('Network request failed') ||
          err.status === 0 || 
          err.status === 502 || 
          err.status === 503 ||
          err.status === 504
        
        if (isNetworkErr) {
          hasNetworkError = true
        } else {
          ops.shift()
          set({ pendingOps: ops })
          await AsyncStorage.setItem(`@netforge_pending_ops_${userId}`, JSON.stringify(ops))
        }
      }
    }

    set({ syncing: false })
  },

  resolveConflict: async (choice, userId) => {
    const { conflictConfig } = get()
    if (!conflictConfig) return

    const { local, remote } = conflictConfig

    if (choice === 'local') {
      const updatedLocal: NetworkConfig = {
        ...local,
        updatedAt: new Date().toISOString(),
      }

      set((state) => {
        const updatedConfigs = state.configs.map((c) => (c.id === local.id ? updatedLocal : c))
        const updatedActive = state.activeConfig?.id === local.id ? updatedLocal : state.activeConfig
        AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)
        
        const filteredOps = state.pendingOps.filter((o) => !(o.configId === local.id && o.type === 'update'))
        const newOps = [
          ...filteredOps,
          { type: 'update' as const, configId: local.id, configData: updatedLocal, timestamp: Date.now() }
        ]
        AsyncStorage.setItem(`@netforge_pending_ops_${userId}`, JSON.stringify(newOps)).catch(console.error)

        return { configs: updatedConfigs, activeConfig: updatedActive, pendingOps: newOps, conflictConfig: null }
      })
    } else {
      set((state) => {
        const updatedConfigs = state.configs.map((c) => (c.id === local.id ? remote : c))
        const updatedActive = state.activeConfig?.id === local.id ? remote : state.activeConfig
        AsyncStorage.setItem(`${LOCAL_CONFIGS_KEY}_${userId}`, JSON.stringify(updatedConfigs)).catch(console.error)
        
        const filteredOps = state.pendingOps.filter((o) => o.configId !== local.id)
        AsyncStorage.setItem(`@netforge_pending_ops_${userId}`, JSON.stringify(filteredOps)).catch(console.error)

        return { configs: updatedConfigs, activeConfig: updatedActive, pendingOps: filteredOps, conflictConfig: null }
      })
    }

    setTimeout(() => {
      get().flushPendingOps(userId)
    }, 100)
  },

  injectLocalConfig: (config) => {
    set((state) => {
      const exists = state.configs.some((c) => c.id === config.id)
      const updated = exists
        ? state.configs.map((c) => (c.id === config.id ? config : c))
        : [config, ...state.configs]
      return { configs: updated }
    })
  },
}))
