import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type AppMode = 'engineer' | 'student'

type PreferencesStore = {
  notifications: boolean
  defaultBaseIp: string
  defaultVlanStart: string
  appMode: AppMode
  recentCidrs: string[]   // max 3, FIFO — used by Subnet tab history chips

  setNotifications: (val: boolean) => Promise<void>
  setDefaultBaseIp: (val: string) => Promise<void>
  setDefaultVlanStart: (val: string) => Promise<void>
  setAppMode: (mode: AppMode) => Promise<void>
  addRecentCidr: (cidr: string) => Promise<void>
  loadPreferences: () => Promise<void>
}

export const usePreferencesStore = create<PreferencesStore>((set, get) => ({
  notifications: true,
  defaultBaseIp: '10.0.0.0',
  defaultVlanStart: '10',
  appMode: 'engineer',
  recentCidrs: [],

  setNotifications: async (val: boolean) => {
    await AsyncStorage.setItem('@netforge_notifications', JSON.stringify(val))
    set({ notifications: val })
  },
  setDefaultBaseIp: async (val: string) => {
    await AsyncStorage.setItem('@netforge_base_ip', val)
    set({ defaultBaseIp: val })
  },
  setDefaultVlanStart: async (val: string) => {
    await AsyncStorage.setItem('@netforge_vlan_start', val)
    set({ defaultVlanStart: val })
  },
  setAppMode: async (mode: AppMode) => {
    await AsyncStorage.setItem('@netforge_app_mode', mode)
    set({ appMode: mode })
  },
  addRecentCidr: async (cidr: string) => {
    const prev = get().recentCidrs
    // Deduplicate then prepend, keep max 3
    const updated = [cidr, ...prev.filter((c) => c !== cidr)].slice(0, 3)
    await AsyncStorage.setItem('@netforge_recent_cidrs', JSON.stringify(updated))
    set({ recentCidrs: updated })
  },
  loadPreferences: async () => {
    try {
      const [notifs, baseIp, vlanStart, appModeRaw, recentCidrsRaw] = await Promise.all([
        AsyncStorage.getItem('@netforge_notifications'),
        AsyncStorage.getItem('@netforge_base_ip'),
        AsyncStorage.getItem('@netforge_vlan_start'),
        AsyncStorage.getItem('@netforge_app_mode'),
        AsyncStorage.getItem('@netforge_recent_cidrs'),
      ])

      set({
        notifications: notifs !== null ? JSON.parse(notifs) : true,
        defaultBaseIp: baseIp ?? '10.0.0.0',
        defaultVlanStart: vlanStart ?? '10',
        appMode: (appModeRaw === 'student' ? 'student' : 'engineer') as AppMode,
        recentCidrs: recentCidrsRaw ? JSON.parse(recentCidrsRaw) : [],
      })
    } catch (err) {
      console.warn('Failed to load preferences:', err)
    }
  },
}))
