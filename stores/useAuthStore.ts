import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { User, Session } from '@supabase/supabase-js'

// Stable guest UUID — generated once and persisted so it never changes between sessions.
// Using a real UUID format ensures Supabase postgres never rejects it.
const GUEST_UUID_KEY = '@netforge_guest_uuid'
function makeUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
async function getOrCreateGuestId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(GUEST_UUID_KEY)
    if (stored) return stored
    const fresh = makeUUID()
    await AsyncStorage.setItem(GUEST_UUID_KEY, fresh)
    return fresh
  } catch {
    return makeUUID() // fallback: ephemeral UUID if storage fails
  }
}

type AuthStore = {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  restoreSession: () => Promise<() => void>
  signInAsGuest: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  loading: true,

  signUp: async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) {
        console.warn('Supabase signUp failed, checking offline fallback:', error.message)
        if (__DEV__) {
          if (
            email.includes('netforge.local') ||
            email === 'guest@netforge.com' ||
            error.message.includes('Fetch') ||
            error.message.includes('Invalid API key') ||
            error.message.toLowerCase().includes('network')
          ) {
            const guestId = await getOrCreateGuestId()
            const mockUser = {
              id: guestId,
              email: email,
              user_metadata: { full_name: fullName || 'Offline Administrator' },
            } as any
            const mockSession = { access_token: 'offline_token', user: mockUser } as any
            set({ user: mockUser, session: mockSession, loading: false })
            return null
          }
        }
        return error.message
      }
      set({ user: data.user, session: data.session })
      return null
    } catch (err) {
      if (__DEV__) {
        console.warn('signUp exception, falling back to offline:', err)
        const guestId = await getOrCreateGuestId()
        const mockUser = {
          id: guestId,
          email: email,
          user_metadata: { full_name: fullName || 'Offline Administrator' },
        } as any
        const mockSession = { access_token: 'offline_token', user: mockUser } as any
        set({ user: mockUser, session: mockSession, loading: false })
        return null
      }
      return err instanceof Error ? err.message : 'An unexpected error occurred'
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        console.warn('Supabase signIn failed, checking offline fallback:', error.message)
        if (__DEV__) {
          if (
            email.includes('netforge.local') ||
            email === 'guest@netforge.com' ||
            error.message.includes('Fetch') ||
            error.message.includes('Invalid API key') ||
            error.message.toLowerCase().includes('network')
          ) {
            const guestId = await getOrCreateGuestId()
            const mockUser = {
              id: guestId,
              email: email,
              user_metadata: { full_name: 'Offline Administrator' },
            } as any
            const mockSession = { access_token: 'offline_token', user: mockUser } as any
            set({ user: mockUser, session: mockSession, loading: false })
            return null
          }
        }
        return error.message
      }
      set({ user: data.user, session: data.session })
      return null
    } catch (err) {
      if (__DEV__) {
        console.warn('signIn exception, falling back to offline:', err)
        const guestId = await getOrCreateGuestId()
        const mockUser = {
          id: guestId,
          email: email,
          user_metadata: { full_name: 'Offline Administrator' },
        } as any
        const mockSession = { access_token: 'offline_token', user: mockUser } as any
        set({ user: mockUser, session: mockSession, loading: false })
        return null
      }
      return err instanceof Error ? err.message : 'An unexpected error occurred'
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut()
      set({ user: null, session: null })
    } catch (err) {
      console.error('SignOut error:', err)
      set({ user: null, session: null })
    }
  },

  restoreSession: async () => {
    try {
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Session restore timed out')), 30000)
      )
      
      const { data } = await Promise.race([sessionPromise, timeoutPromise])
      set({
        user: data.session?.user ?? null,
        session: data.session,
        loading: false,
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null, session })
      })
      return () => subscription.unsubscribe()
    } catch (err) {
      console.error('Session restore error:', err)
      set({ loading: false })
      return () => {}
    }
  },

  signInAsGuest: async () => {
    // Creates a stable guest session backed by a locally persisted UUID.
    // Data is stored on-device only and never synced to Supabase.
    // This is intentionally available in all builds.
    const guestId = await getOrCreateGuestId()
    const mockUser = {
      id: guestId,
      email: 'guest@netforge.local',
      user_metadata: { full_name: 'Guest' },
    } as any
    const mockSession = { access_token: 'offline_token', user: mockUser } as any
    set({ user: mockUser, session: mockSession, loading: false })
  },
}))
