import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../lib/supabase'

// Define __DEV__ globally for Jest if not defined
;(global as any).__DEV__ = true

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(null),
  },
}))

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

  afterEach(async () => {
    // Always restore real timers in case a test threw before reaching useRealTimers().
    // Also drain the microtask queue so dangling Promises (e.g. the never-resolving
    // getSession mock) don't keep the Jest worker alive after the suite finishes.
    jest.useRealTimers()
    await new Promise((resolve) => setImmediate(resolve))
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

    // Await the promise — restoreSession catches the timeout and sets loading: false
    await restorePromise

    // Restore real timers synchronously INSIDE the test so the next test's
    // beforeEach doesn't start with fake timers still active.
    jest.useRealTimers()

    expect(useAuthStore.getState().loading).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })

  test('restoreSession sets session when successful', async () => {
    const mockGetSession = supabase.auth.getSession as jest.Mock
    const mockUser = { id: 'user-123', email: 'test@netforge.com' }
    const mockSession = { user: mockUser, access_token: 'token' }

    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
    })

    const unsubscribe = await useAuthStore.getState().restoreSession()
    // Clean up the auth state subscription to prevent the listener
    // from outliving the test and triggering the worker force-exit.
    unsubscribe()

    expect(typeof unsubscribe).toBe('function')
    expect(useAuthStore.getState().loading).toBe(false)
    expect(useAuthStore.getState().user).toEqual(mockUser)
    expect(useAuthStore.getState().session).toEqual(mockSession)
  })
})

