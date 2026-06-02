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
    addEventListener: jest.fn(),
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
    // Reset Zustand store state before each test
    useConfigStore.setState({
      configs: [],
      activeConfig: null,
      loading: false,
      error: null,
      pendingOps: [],
      syncing: false,
      conflictConfig: null,
    })
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

    // Expect that a pending op was enqueued because the insert failed (offline)
    expect(useConfigStore.getState().pendingOps.length).toBe(1)
    expect(useConfigStore.getState().pendingOps[0].type).toBe('create')
    expect(useConfigStore.getState().pendingOps[0].configId).toBe(created?.id)
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
    expect(configs.some(c => c.id === 'demo_enterprise_config_v5')).toBe(true)
    expect(useConfigStore.getState().loading).toBe(false)
  })
})
