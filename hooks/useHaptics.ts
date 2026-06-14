/**
 * useHaptics.ts
 *
 * Thin wrapper around expo-haptics that silently no-ops if the module
 * isn't available (e.g. in web/simulator environments that don't support it).
 *
 * Usage:
 *   const haptics = useHaptics()
 *   haptics.light()       // Tap feedback
 *   haptics.success()     // Successful operation
 *   haptics.error()       // Error / destructive action
 *   haptics.medium()      // Node placed, important interaction
 */

import { useCallback } from 'react'

type HapticsHook = {
  light: () => void
  medium: () => void
  heavy: () => void
  success: () => void
  warning: () => void
  error: () => void
}

let Haptics: typeof import('expo-haptics') | null = null

try {
  // Lazy-load so it doesn't blow up in environments without the native module
  Haptics = require('expo-haptics')
} catch {
  Haptics = null
}

export function useHaptics(): HapticsHook {
  const light = useCallback(() => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle?.Light ?? ('light' as any)).catch(() => {})
  }, [])

  const medium = useCallback(() => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle?.Light ?? ('light' as any)).catch(() => {})
  }, [])

  const heavy = useCallback(() => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle?.Medium ?? ('medium' as any)).catch(() => {})
  }, [])

  const success = useCallback(() => {
    Haptics?.notificationAsync(Haptics.NotificationFeedbackType?.Success ?? ('success' as any)).catch(() => {})
  }, [])

  const warning = useCallback(() => {
    Haptics?.notificationAsync(Haptics.NotificationFeedbackType?.Warning ?? ('warning' as any)).catch(() => {})
  }, [])

  const error = useCallback(() => {
    Haptics?.notificationAsync(Haptics.NotificationFeedbackType?.Error ?? ('error' as any)).catch(() => {})
  }, [])

  return { light, medium, heavy, success, warning, error }
}
