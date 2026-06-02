import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../lib/supabase'

// Define __DEV__ globally for Jest if not defined
;(global as any).__DEV__ = true

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  },
}))

describe('useAuthStore Auth and Timeout Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({
      user: null,
      session: null,
      loading: true,
    })
  })

  test('restoreSession handles 30s timeout guard', async () => {
    const mockGetSession = supabase.auth.getSession as jest.Mock
    // Make getSession hang forever (return a promise that never resolves)
    mockGetSession.mockReturnValue(new Promise(() => {}))

    // Use fake timers to speed up the 30s timeout
    jest.useFakeTimers()

    const restorePromise = useAuthStore.getState().restoreSession()

    // Fast-forward 30 seconds
    jest.advanceTimersByTime(30000)

    // Await the promise
    await restorePromise

    expect(useAuthStore.getState().loading).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()

    jest.useRealTimers()
  })

  test('restoreSession sets session when successful', async () => {
    const mockGetSession = supabase.auth.getSession as jest.Mock
    const mockUser = { id: 'user-123', email: 'test@netforge.com' }
    const mockSession = { user: mockUser, access_token: 'token' }
    
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
    })

    const unsubscribe = await useAuthStore.getState().restoreSession()
    expect(typeof unsubscribe).toBe('function')
    expect(useAuthStore.getState().loading).toBe(false)
    expect(useAuthStore.getState().user).toEqual(mockUser)
    expect(useAuthStore.getState().session).toEqual(mockSession)
  })
})
