import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '@/constants/colors'

export type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral' | 'primary'

type BadgeProps = {
  label: string
  variant?: BadgeVariant
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: `${Colors.success}1A`, text: Colors.success },
  warning: { bg: `${Colors.warning}1A`, text: Colors.warning },
  error: { bg: `${Colors.error}1A`, text: Colors.error },
  neutral: { bg: Colors.ice, text: Colors.medium },
  primary: { bg: `${Colors.primary}1A`, text: Colors.primary },
}

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const vs = variantStyles[variant]
  return (
    <View style={[styles.badge, { backgroundColor: vs.bg }]}>
      <Text style={[styles.label, { color: vs.text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
})
