import React, { useEffect } from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from '@/constants/colors'
import { Check } from 'phosphor-react-native'
import { useHaptics } from '@/hooks/useHaptics'

type PeerChipProps = {
  label: string
  selected: boolean
  onPress: () => void
}

export function PeerChip({ label, selected, onPress }: PeerChipProps) {
  const haptics       = useHaptics()
  const scale       = useSharedValue(1)
  const checkOpacity = useSharedValue(selected ? 1 : 0)

  // Animate check icon when selected changes
  useEffect(() => {
    checkOpacity.value = withTiming(selected ? 1 : 0, { duration: 160 })
  }, [selected])

  const chipAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const checkAnimStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    marginRight: 4,
  }))

  const handlePress = () => {
    haptics.light()
    onPress()
    scale.value = withSequence(
      withTiming(0.94, { duration: 40 }),
      withTiming(1, { duration: 100 })
    )
  }

  return (
    <Animated.View style={chipAnimStyle}>
      <Pressable
        onPress={handlePress}
        style={[styles.chip, selected ? styles.selected : styles.unselected]}
      >
        {selected && (
          <Animated.View style={checkAnimStyle}>
            <Check size={14} color={Colors.white} />
          </Animated.View>
        )}
        <Text style={[styles.label, selected ? styles.selectedLabel : styles.unselectedLabel]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  selected: {
    backgroundColor: Colors.primary,
  },
  unselected: {
    backgroundColor: Colors.ice,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  selectedLabel: {
    color: Colors.white,
  },
  unselectedLabel: {
    color: Colors.medium,
  },
})
