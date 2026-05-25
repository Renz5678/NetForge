import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '@/constants/colors'

type MetricTileProps = {
  label: string
  value: number | string
}

export function MetricTile({ label, value }: MetricTileProps) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.value}>{typeof value === 'number' ? String(value).padStart(2, '0') : value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: Colors.ice,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  value: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 28,
    color: Colors.primary,
  },
})
