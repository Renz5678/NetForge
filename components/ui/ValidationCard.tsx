import React, { useRef, useEffect } from 'react'
import { View, Text, StyleSheet, Animated, ScrollView, Alert, Pressable } from 'react-native'
import { Question, CheckCircle, WarningCircle, Warning } from 'phosphor-react-native'
import { Colors } from '@/constants/colors'
import type { CheckResult } from '@/types'

// 'warning' variant: amber colouring for issues that are notable but not failures
// (e.g. articulation points — the topology is valid but redundancy is reduced).
export type ValidationCardVariant = 'pass' | 'fail' | 'warning'

type ValidationCardProps = {
  title: string
  description: string
  result: CheckResult
  index?: number
  /** Override the auto-derived pass/fail/warning colouring. If omitted, inferred from result.passed. */
  variant?: ValidationCardVariant
  explanationTitle?: string
  explanation?: string
}

// Resolve the effective variant from props or result
function resolveVariant(variant: ValidationCardVariant | undefined, passed: boolean): ValidationCardVariant {
  if (variant !== undefined) return variant
  return passed ? 'pass' : 'fail'
}

const VARIANT_COLORS: Record<ValidationCardVariant, { bar: string; badge: string; bg: string; text: string; border: string }> = {
  pass: {
    bar:    Colors.success,
    badge:  Colors.success,
    bg:     `${Colors.success}1A`,
    text:   Colors.success,
    border: Colors.border,
  },
  fail: {
    bar:    Colors.error,
    badge:  Colors.error,
    bg:     `${Colors.error}1A`,
    text:   Colors.error,
    border: `${Colors.error}40`,
  },
  warning: {
    bar:    Colors.warning,
    badge:  Colors.warning,
    bg:     `${Colors.warning}1A`,
    text:   Colors.warning,
    border: `${Colors.warning}40`,
  },
}

const VARIANT_BADGE_LABELS: Record<ValidationCardVariant, string> = {
  pass:    'PASS',
  fail:    'FAIL',
  warning: 'WARN',
}

export function ValidationCard({
  title,
  description,
  result,
  index = 0,
  variant,
  explanationTitle,
  explanation,
}: ValidationCardProps) {
  const slideAnim = useRef(new Animated.Value(8)).current
  const fadeAnim  = useRef(new Animated.Value(0)).current
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

  const effectiveVariant = resolveVariant(variant, result.passed)
  const theme = VARIANT_COLORS[effectiveVariant]
  const badgeLabel = VARIANT_BADGE_LABELS[effectiveVariant]

  const StatusIcon =
    effectiveVariant === 'pass'
      ? <CheckCircle size={18} color={Colors.success} weight="fill" />
      : effectiveVariant === 'warning'
      ? <Warning size={18} color={Colors.warning} weight="fill" />
      : <WarningCircle size={18} color={Colors.error} weight="fill" />

  return (
    <Animated.View
      style={[
        styles.card,
        { borderColor: theme.border },
        {
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      {/* Left colour bar — indicates severity at a glance */}
      <View style={[styles.colorBar, { backgroundColor: theme.bar }]} />

      <View style={styles.body}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, paddingRight: 8 }}>
            <Text style={styles.title}>{title}</Text>
            {explanation && (
              <Pressable onPress={() => Alert.alert(explanationTitle || title, explanation)} hitSlop={8}>
                <Question size={18} color={Colors.textMuted} weight="fill" />
              </Pressable>
            )}
          </View>
          <View style={styles.badgeRow}>
            {StatusIcon}
            <View style={[styles.badge, { backgroundColor: theme.bg }]}>
              <Text style={[styles.badgeText, { color: theme.text }]}>{badgeLabel}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.description}>{description}</Text>

        {/* Affected items — shown for fail/warning states when the `affected` array is present */}
        {!result.passed && result.affected && result.affected.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 8 }}
          >
            <View style={{ flexDirection: 'row', gap: 6, paddingBottom: 4 }}>
              {result.affected.slice(0, 8).map((name, i) => (
                <View
                  key={i}
                  style={{
                    backgroundColor: effectiveVariant === 'warning'
                      ? Colors.warningContainer
                      : Colors.errorContainer,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderWidth: 1,
                    borderColor: `${theme.badge}30`,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      fontSize: 11,
                      color: theme.text,
                    }}
                  >
                    {name}
                  </Text>
                </View>
              ))}
              {result.affected.length > 8 && (
                <View
                  style={{
                    backgroundColor: effectiveVariant === 'warning'
                      ? Colors.warningContainer
                      : Colors.errorContainer,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter_500Medium',
                      fontSize: 11,
                      color: theme.text,
                    }}
                  >
                    +{result.affected.length - 8} more
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
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
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
})
