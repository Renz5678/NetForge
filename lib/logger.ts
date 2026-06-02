/**
 * logger.ts
 *
 * Lightweight structured logger for NetForge.
 * - In __DEV__: forwards to console (info/warn/error) for easy development.
 * - In production: persists error logs to AsyncStorage (capped at MAX_LOG_ENTRIES)
 *   and swallows lower-severity logs to keep the production bundle quiet.
 *
 * Usage:
 *   AppLogger.info('Config loaded', { configId })
 *   AppLogger.warn('Supabase offline', { reason })
 *   AppLogger.error('Render crash', { error, errorInfo })
 *   const logs = await AppLogger.getLogs()
 *   await AppLogger.clearLogs()
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

const LOG_KEY = '@netforge_error_log'
const MAX_LOG_ENTRIES = 100

export type LogLevel = 'info' | 'warn' | 'error'

export type LogEntry = {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  return value
}

function serializeContext(
  context?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!context) return undefined
  return Object.fromEntries(
    Object.entries(context).map(([k, v]) => [k, serialize(v)])
  )
}

async function persist(entry: LogEntry): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY)
    const logs: LogEntry[] = raw ? JSON.parse(raw) : []
    logs.push(entry)
    // Keep only the most recent MAX_LOG_ENTRIES
    const trimmed = logs.slice(-MAX_LOG_ENTRIES)
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(trimmed))
  } catch {
    // Never throw from a logger
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const AppLogger = {
  info(message: string, context?: Record<string, unknown>): void {
    if (__DEV__) {
      console.info(`[NetForge] ${message}`, context ?? '')
    }
    // info logs are not persisted in production
  },

  warn(message: string, context?: Record<string, unknown>): void {
    if (__DEV__) {
      console.warn(`[NetForge] ${message}`, context ?? '')
    } else {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'warn',
        message,
        context: serializeContext(context),
      }
      void persist(entry)
    }
  },

  error(message: string, context?: Record<string, unknown>): void {
    if (__DEV__) {
      console.error(`[NetForge] ${message}`, context ?? '')
    } else {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message,
        context: serializeContext(context),
      }
      void persist(entry)
    }
  },

  /** Retrieve all persisted log entries from AsyncStorage. */
  async getLogs(): Promise<LogEntry[]> {
    try {
      const raw = await AsyncStorage.getItem(LOG_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  },

  /** Clear all persisted log entries. */
  async clearLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LOG_KEY)
    } catch {
      // Silently ignore
    }
  },
}
