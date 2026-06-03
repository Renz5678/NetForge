/**
 * AppSplashScreen.tsx
 *
 * Displayed while fonts are loading or the auth session is being restored.
 * Shows the app icon with a smooth fade-in + gentle scale animation and
 * pulsing loading dots.
 */

import React, { useEffect, useRef } from 'react'
import { View, Text, Image, StyleSheet, Animated } from 'react-native'
import { Colors } from '@/constants/colors'

export function AppSplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.86)).current
  const dotOpacity1 = useRef(new Animated.Value(0.25)).current
  const dotOpacity2 = useRef(new Animated.Value(0.25)).current
  const dotOpacity3 = useRef(new Animated.Value(0.25)).current

  useEffect(() => {
    let isMounted = true

    // 1. Fade + scale in the logo
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start()

    // 2. Staggered loading dots (loop)
    let dotAnim: Animated.CompositeAnimation | null = null
    const animateDots = () => {
      dotAnim = Animated.sequence([
        Animated.timing(dotOpacity1, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(dotOpacity1, { toValue: 0.25, duration: 240, useNativeDriver: true }),
        Animated.timing(dotOpacity2, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(dotOpacity2, { toValue: 0.25, duration: 240, useNativeDriver: true }),
        Animated.timing(dotOpacity3, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(dotOpacity3, { toValue: 0.25, duration: 240, useNativeDriver: true }),
      ])
      dotAnim.start(({ finished }) => {
        if (finished && isMounted) animateDots()
      })
    }
    const timer = setTimeout(animateDots, 550)
    return () => {
      isMounted = false
      clearTimeout(timer)
      dotAnim?.stop()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={styles.container}>
      {/* Logo card + Wordmark */}
      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Icon card with shadow */}
        <View style={styles.iconCard}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.icon}
            resizeMode="cover"
          />
        </View>

        {/* Wordmark */}
        <View style={styles.wordmarkRow}>
          <Text style={styles.wordmark}>NetForge</Text>
        </View>
        <Text style={styles.tagline}>Network Design & Configuration</Text>
      </Animated.View>

      {/* Pulsing loading dots */}
      <Animated.View style={[styles.dotsRow, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.dot, { opacity: dotOpacity1 }]} />
        <Animated.View style={[styles.dot, { opacity: dotOpacity2 }]} />
        <Animated.View style={[styles.dot, { opacity: dotOpacity3 }]} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 56,
  },
  logoWrapper: {
    alignItems: 'center',
    gap: 18,
  },
  iconCard: {
    width: 104,
    height: 104,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  icon: {
    width: 104,
    height: 104,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 34,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 0.2,
    marginTop: -4,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
})
