import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { Colors } from '@/constants/colors'

type MetricTileProps = {
  label: string
  value: number | string
  icon?: React.ReactNode
  progressValue?: number
  valueColor?: string
}

export function MetricTile({ label, value, icon, progressValue, valueColor }: MetricTileProps) {
  const textColor = valueColor ?? Colors.textPrimary
  const numericValue = typeof value === 'number' ? value : parseFloat(value as string)

  // Animate numeric values from 0 to final on mount
  const animValue = useRef(new Animated.Value(0)).current
  const [displayValue, setDisplayValue] = React.useState<number | string>(
    typeof value === 'number' ? 0 : value
  )

  useEffect(() => {
    if (typeof value !== 'number' || isNaN(numericValue)) {
      setDisplayValue(value)
      return
    }
    animValue.setValue(0)
    const anim = Animated.timing(animValue, {
      toValue: numericValue,
      duration: 600,
      useNativeDriver: false,
    })
    anim.start()
    const listener = animValue.addListener(({ value: v }) => {
      setDisplayValue(Math.round(v))
    })
    return () => {
      animValue.removeListener(listener)
      anim.stop()
    }
  }, [value, numericValue, animValue])

  return (
    <View style={styles.tile}>
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: textColor }]}>{displayValue}</Text>

      {progressValue !== undefined && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.max(0, Math.min(progressValue, 100))}%`,
                backgroundColor: textColor !== Colors.textPrimary ? textColor : Colors.primary,
              },
            ]}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 90,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.ice,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: `${Colors.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  label: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 26,
    lineHeight: 30,
  },
  progressTrack: {
    width: '70%',
    height: 3,
    backgroundColor: `${Colors.primary}15`,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
})
