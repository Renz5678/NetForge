import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

type PreferencesStore = {
  notifications: boolean
  defaultBaseIp: string
  defaultVlanStart: string
  setNotifications: (val: boolean) => Promise<void>
  setDefaultBaseIp: (val: string) => Promise<void>
  setDefaultVlanStart: (val: string) => Promise<void>
  loadPreferences: () => Promise<void>
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  notifications: true,
  defaultBaseIp: '10.0.0.0',
  defaultVlanStart: '10',

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
  loadPreferences: async () => {
    try {
      const notifs = await AsyncStorage.getItem('@netforge_notifications')
      const baseIp = await AsyncStorage.getItem('@netforge_base_ip')
      const vlanStart = await AsyncStorage.getItem('@netforge_vlan_start')
      
      set({
        notifications: notifs !== null ? JSON.parse(notifs) : true,
        defaultBaseIp: baseIp ?? '10.0.0.0',
        defaultVlanStart: vlanStart ?? '10',
      })
    } catch (err) {
      console.warn('Failed to load preferences:', err)
    }
  },
}))
