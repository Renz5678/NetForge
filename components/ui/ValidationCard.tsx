import React, { useRef, useEffect } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { Colors } from '@/constants/colors'
import type { CheckResult } from '@/types'

type ValidationCardProps = {
  title: string
  description: string
  result: CheckResult
  index?: number
}

export function ValidationCard({ title, description, result, index = 0 }: ValidationCardProps) {
  const slideAnim = useRef(new Animated.Value(8)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.9)).current

  useEffect(() => {
    const delay = index * 80
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 120,
        friction: 8,
        delay,
        useNativeDriver: true,
      }),
    ]).start()
  }, [slideAnim, fadeAnim, scaleAnim, index])

  const barColor = result.passed ? Colors.primary : Colors.error
  const badgeLabel = result.passed ? 'PASS' : 'FAIL'
  const badgeBg = result.passed ? `${Colors.primary}1A` : `${Colors.error}1A`
  const badgeText = result.passed ? Colors.primary : Colors.error

  return (
    <Animated.View
      style={[
        styles.card,
        result.passed ? styles.cardPass : styles.cardFail,
        {
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      {/* Left color bar */}
      <View style={[styles.colorBar, { backgroundColor: barColor }]} />

      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.badgeText, { color: badgeText }]}>{badgeLabel}</Text>
          </View>
        </View>
        <Text style={styles.description}>{description}</Text>

        {/* Failure detail section */}
        {!result.passed && result.affected && result.affected.length > 0 && (
          <View style={styles.failDetail}>
            <Text style={styles.failDetailLabel}>Affected:</Text>
            <View style={styles.chipRow}>
              {result.affected.map((name, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardPass: {
    borderColor: Colors.border,
  },
  cardFail: {
    borderColor: `${Colors.error}40`,
  },
  colorBar: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: 16,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  badgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  failDetail: {
    marginTop: 8,
    backgroundColor: Colors.errorContainer,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  failDetailLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.error,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: `${Colors.error}1A`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.error,
  },
})
