// ExplainModeToggle.tsx
// Floating toggle that switches between professional mode and educational overlay mode.
// When Explain Mode is OFF: the app behaves like a professional engineering tool.
// When Explain Mode is ON: algorithm decisions, route reasoning, and validation logic become visible.

import React, { useRef, useEffect } from 'react'
import {
  Pressable,
  Text,
  StyleSheet,
  Animated,
  View,
  Alert,
} from 'react-native'
import { GraduationCap, EyeSlash } from 'phosphor-react-native'
import { Colors } from '@/constants/colors'
import { useConfigStore } from '@/stores/useConfigStore'

type ExplainModeToggleProps = {
  style?: object
}

export function ExplainModeToggle({ style }: ExplainModeToggleProps) {
  const explainMode = useConfigStore((s) => s.explainMode)
  const setExplainMode = useConfigStore((s) => s.setExplainMode)

  const scaleAnim = useRef(new Animated.Value(1)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  // Pulse animation when explain mode turns on
  useEffect(() => {
    if (explainMode) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start()
    } else {
      glowAnim.stopAnimation()
      glowAnim.setValue(0)
    }
  }, [explainMode, glowAnim])

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.88,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 180,
        friction: 8,
      }),
    ]).start()
    setExplainMode(!explainMode)
  }

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  })

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      {/* Glow ring when active */}
      {explainMode && (
        <Animated.View
          style={[
            styles.glowRing,
            { opacity: glowOpacity },
          ]}
          pointerEvents="none"
        />
      )}

      <Pressable
        onPress={handlePress}
        onLongPress={() =>
          Alert.alert(
            'Learn Mode',
            'When Learn Mode is on, the app shows you why the algorithm made each decision — hop-by-hop routing logic, subnet selection, and validation reasoning. Great for understanding how networks actually work.',
            [{ text: 'Got it' }]
          )
        }
        style={[
          styles.toggle,
          explainMode ? styles.toggleActive : styles.toggleInactive,
        ]}
        accessibilityRole="button"
        accessibilityLabel={explainMode ? 'Disable Learn Mode' : 'Enable Learn Mode'}
        accessibilityState={{ selected: explainMode }}
      >
        <GraduationCap
          size={16}
          color={explainMode ? Colors.white : Colors.textSecondary}
          weight={explainMode ? 'fill' : 'regular'}
        />
        <Text style={[styles.label, explainMode ? styles.labelActive : styles.labelInactive]}>
          {explainMode ? 'Learn On' : 'Learn'}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  glowRing: {
    position: 'absolute',
    inset: -6,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    zIndex: -1,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  toggleInactive: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.1,
  },
  labelActive: {
    color: Colors.white,
  },
  labelInactive: {
    color: Colors.textSecondary,
  },
})
