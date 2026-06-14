// AlgorithmToast.tsx
// Brief floating badge that appears after an auto-triggered algorithm completes.
// Shows the algorithm name and result in network-engineer language (not CS textbook).
// Auto-dismisses after 3.5 seconds. Tapping it opens the full step-by-step replay.
// Swipe right to dismiss manually.

import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, Animated, PanResponder } from 'react-native'
import { Colors } from '@/constants/colors'

export type ToastData = {
  label: string        // e.g. "3 hops: Staff → Servers"
  success: boolean     // green vs amber
  insight?: string     // plain-language explanation of what the result means
  replayLabel?: string // e.g. "via Dijkstra ›", "via Prim's ›", "via DFS ›"
  onReplay?: () => void // tap to open step-by-step panel
}

type Props = {
  toast: ToastData | null
  onDismiss: () => void
}

export function AlgorithmToast({ toast, onDismiss }: Props) {
  const opacity    = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(20)).current
  const scaleAnim  = useRef(new Animated.Value(0.88)).current
  const translateX = useRef(new Animated.Value(0)).current

  const onDismissRef = useRef(onDismiss)
  useEffect(() => { onDismissRef.current = onDismiss }, [onDismiss])

  // Swipe-right-to-dismiss pan responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy) && gs.dx > 0,
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) translateX.setValue(gs.dx)
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 80 || gs.vx > 0.6) {
          Animated.parallel([
            Animated.timing(translateX, { toValue: 400, duration: 200, useNativeDriver: true }),
            Animated.timing(opacity,    { toValue: 0,   duration: 180, useNativeDriver: true }),
          ]).start(() => onDismissRef.current())
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 25, stiffness: 150 }).start()
        }
      },
    })
  ).current

  useEffect(() => {
    if (!toast) {
      // Fade + slide out
      Animated.parallel([
        Animated.timing(opacity,     { toValue: 0,  duration: 180, useNativeDriver: true }),
        Animated.timing(translateY,  { toValue: 20, duration: 180, useNativeDriver: true }),
        Animated.timing(scaleAnim,   { toValue: 0.88, duration: 180, useNativeDriver: true }),
      ]).start()
      translateX.setValue(0)
      return
    }

    // Reset X before each new toast
    translateX.setValue(0)

    // Spring pop-up entrance
    Animated.parallel([
      Animated.spring(opacity,    { toValue: 1, useNativeDriver: true, damping: 25, stiffness: 150, mass: 1 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 25, stiffness: 150, mass: 1 }),
      Animated.spring(scaleAnim,  { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 150, mass: 1 }),
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
        toast.insight && styles.containerWide,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity,
          transform: [
            { translateY },
            { translateX },
            { scale: scaleAnim },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.topRow}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
          {toast.label}
        </Text>
        {toast.onReplay && (
          <Pressable onPress={toast.onReplay} style={styles.replayBtn} hitSlop={8}>
            <Text style={[styles.replayText, { color: textColor }]}>
              {toast.replayLabel ?? 'See how ›'}
            </Text>
          </Pressable>
        )}
      </View>
      {toast.insight && (
        <Text style={[styles.insight, { color: textColor }]}>{toast.insight}</Text>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
    maxWidth: 320,
  },
  containerWide: {
    borderRadius: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
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
  insight: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 5,
    paddingLeft: 15,   // aligns under label (past the dot)
    opacity: 0.78,
    lineHeight: 16,
  },
})
