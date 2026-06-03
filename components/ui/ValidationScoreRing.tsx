import React, { useRef, useEffect } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { Colors } from '@/constants/colors'

type Props = {
  score: number
  label: string
  sublabel: string
}

function getScoreColor(score: number): string {
  if (score > 80) return Colors.success
  if (score >= 60) return Colors.warning
  return Colors.error
}

export function ValidationScoreRing({ score, label, sublabel }: Props) {
  const scaleAnim = useRef(new Animated.Value(0.7)).current
  const fadeAnim  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scoreColor = getScoreColor(score)

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      {/* Background ring (track) */}
      <View style={styles.ringTrack}>
        {/* Foreground ring (colored border) */}
        <View style={[styles.ringForeground, { borderColor: scoreColor }]}>
          {/* Center content */}
          <View style={styles.center}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>
              {score}%
            </Text>
          </View>
        </View>
      </View>

      {/* Labels below the ring */}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.sublabel}>{sublabel}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  ringTrack: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringForeground: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 28,
    lineHeight: 34,
  },
  label: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  sublabel: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
})
