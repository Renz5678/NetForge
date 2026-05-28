// AlgorithmToast.tsx
// Brief floating badge that appears after an auto-triggered algorithm completes.
// Shows the algorithm name and result in network-engineer language (not CS textbook).
// Auto-dismisses after 3 seconds. Tapping it opens the full step-by-step replay.

import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { Colors } from '@/constants/colors'

export type ToastData = {
  label: string        // e.g. "Shortest path · Dijkstra · 3 hops"
  success: boolean     // green vs amber
  onReplay?: () => void // tap to open step-by-step panel
}

type Props = {
  toast: ToastData | null
  onDismiss: () => void
}

export function AlgorithmToast({ toast, onDismiss }: Props) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-8)).current

  useEffect(() => {
    if (!toast) {
      // Fade out
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -8, duration: 200, useNativeDriver: true }),
      ]).start()
      return
    }

    // Fade in
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 160, friction: 14 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 160, friction: 14 }),
    ]).start()

    // Auto-dismiss after 3.5 seconds
    const timer = setTimeout(onDismiss, 3500)
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null

  const bg = toast.success ? Colors.successContainer : Colors.warningContainer
  const border = toast.success ? Colors.success : Colors.warning
  const textColor = toast.success ? Colors.success : Colors.warning
  const dot = toast.success ? Colors.success : Colors.warning

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: bg, borderColor: border, opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {toast.label}
      </Text>
      {toast.onReplay && (
        <Pressable onPress={toast.onReplay} style={styles.replayBtn} hitSlop={8}>
          <Text style={[styles.replayText, { color: textColor }]}>Step-by-step ›</Text>
        </Pressable>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    flex: 1,
  },
  replayBtn: {
    paddingLeft: 4,
  },
  replayText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
})
