/**
 * components/ui/ValidatePhaseIndicator.tsx
 *
 * Displays 5 phase dots in a horizontal row:
 *   - Past phases:   filled circle in Colors.primary
 *   - Current phase: pulsing filled circle in Colors.primary
 *   - Pending phases: empty circle (border only) in Colors.border
 *
 * Uses Animated.loop for the pulse effect on the current phase.
 */

import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { Colors } from '@/constants/colors'

const PHASE_LABELS: Record<string, string> = {
  connectivity:  'Connectivity',
  addressing:    'Addressing',
  resilience:    'Resilience',
  correctness:   'Correctness',
  optimization:  'Optimization',
}

type Props = {
  phases: string[]
  currentPhase: number  // index (0-based), -1 = not started, phases.length = done
}

function PhaseDot({ state }: { state: 'done' | 'current' | 'pending' }) {
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (state !== 'current') {
      pulse.setValue(1)
      return
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [state, pulse])

  if (state === 'pending') {
    return <View style={styles.dotPending} />
  }

  if (state === 'current') {
    return (
      <Animated.View style={[styles.dotFilled, { opacity: pulse }]} />
    )
  }

  // done
  return <View style={[styles.dotFilled, styles.dotDone]} />
}

function ConnectorLine({ active }: { active: boolean }) {
  return (
    <View
      style={[
        styles.connector,
        { backgroundColor: active ? Colors.primary : Colors.border },
      ]}
    />
  )
}

export function ValidatePhaseIndicator({ phases, currentPhase }: Props) {
  return (
    <View style={styles.container}>
      {/* Dots + connectors */}
      <View style={styles.dotRow}>
        {phases.map((phase, i) => {
          const state =
            i < currentPhase ? 'done' :
            i === currentPhase ? 'current' :
            'pending'
          return (
            <React.Fragment key={phase}>
              <PhaseDot state={state} />
              {i < phases.length - 1 && (
                <ConnectorLine active={i < currentPhase} />
              )}
            </React.Fragment>
          )
        })}
      </View>

      {/* Labels */}
      <View style={styles.labelRow}>
        {phases.map((phase, i) => (
          <Text
            key={phase}
            style={[
              styles.label,
              i < currentPhase && styles.labelDone,
              i === currentPhase && styles.labelCurrent,
            ]}
            numberOfLines={1}
          >
            {PHASE_LABELS[phase] ?? phase}
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingHorizontal: 4,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dotFilled: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
  },
  dotDone: {
    // Same as filled, different state for clarity
  },
  dotPending: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  connector: {
    flex: 1,
    height: 2,
    marginHorizontal: 2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'center',
    width: 60,
    flexShrink: 1,
  },
  labelDone: {
    color: Colors.primary,
  },
  labelCurrent: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
})
