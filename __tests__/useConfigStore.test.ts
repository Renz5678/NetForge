import { useConfigStore } from '../stores/useConfigStore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(null),
  },
}))

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    // Return an unsubscribe no-op so the store's addEventListener listener
    // can be properly torn down — prevents the test worker force-exit.
    addEventListener: jest.fn(() => () => {}),
    fetch: jest.fn().mockResolvedValue({ isConnected: false, isInternetReachable: false }),
  },
}))

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

describe('useConfigStore Offline Sync and Optimistic Updates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset Zustand store state before each test.
    // isNetInfoSubscribed must also be reset so the subscription guard
    // doesn't skip re-registration and leave an open handle between tests.
    useConfigStore.setState({
      configs: [],
      activeConfig: null,
      loading: false,
      error: null,
      pendingOps: [],
      syncing: false,
      conflictConfig: null,
      isNetInfoSubscribed: false,
    })
  })

  afterEach(async () => {
    // Drain the microtask queue so fire-and-forget AsyncStorage.setItem calls
    // (called with .catch() inside the store) don't outlive the test and cause
    // the Jest worker-force-exit warning.
    await new Promise((resolve) => setImmediate(resolve))
  })

  test('createConfig optimistic update adds to local state immediately', async () => {
    const mockFrom = supabase.from as jest.Mock
    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockRejectedValue(new Error('Network request failed')), // Simulate offline
        }),
      }),
    })

    const newConfigPromise = useConfigStore.getState().createConfig(
      'Optimistic Config',
      'user-123',
      '10.0.0.0',
      10
    )

    // Check that state updated immediately (optimistic) before the promise even resolves
    const configs = useConfigStore.getState().configs
    expect(configs.length).toBe(1)
    expect(configs[0].name).toBe('Optimistic Config')
    expect(configs[0].id).toContain('local_')

    const created = await newConfigPromise
    expect(created).toBeDefined()
    expect(created?.id).toContain('local_')

    // local_ prefixed configs are intentionally NOT queued in pendingOps
    // (store skips syncing local-only configs to Supabase — they live only in AsyncStorage)
    expect(useConfigStore.getState().pendingOps.length).toBe(0)
    // But the config WAS added to local state
    expect(useConfigStore.getState().configs.some((c) => c.id === created?.id)).toBe(true)
  })

  test('loadConfigs merges local fallbacks when Supabase is unreachable', async () => {
    const mockFrom = supabase.from as jest.Mock
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockRejectedValue(new Error('FetchError: Network request failed')),
        }),
      }),
    })

    const mockGetItem = AsyncStorage.getItem as jest.Mock
    const mockSavedConfig = {
      id: 'synced-config-1',
      userId: 'user-123',
      name: 'Saved Config',
      departments: [],
      baseIp: '10.0.0.0',
      vlanStart: 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockGetItem.mockResolvedValue(JSON.stringify([mockSavedConfig]))

    await useConfigStore.getState().loadConfigs('user-123')

    const configs = useConfigStore.getState().configs
    // Should have Saved Config plus the demo campus network config (since it injects the demo config automatically if missing)
    expect(configs.some(c => c.name === 'Saved Config')).toBe(true)
    expect(configs.some(c => c.id === 'demo_enterprise_config_v9')).toBe(true)
    expect(useConfigStore.getState().loading).toBe(false)
  })
})
