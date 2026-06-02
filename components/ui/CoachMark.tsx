import React, { useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated'
import { Colors } from '@/constants/colors'
import { CaretDown } from 'phosphor-react-native'

type CoachMarkProps = {
  visible: boolean
  text: string
  onDismiss: () => void
}

export function CoachMark({ visible, text, onDismiss }: CoachMarkProps) {
  const scale = useSharedValue(0)
  const arrowY = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15 })
      arrowY.value = withRepeat(
        withSequence(
          withTiming(6, { duration: 600 }),
          withTiming(0, { duration: 600 })
        ),
        -1,
        true
      )
    } else {
      scale.value = withTiming(0)
    }
  }, [visible])

  if (!visible) return null

  const animatedBubbleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const animatedArrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: arrowY.value }],
  }))

  return (
    <Pressable style={styles.overlay} onPress={onDismiss}>
      <Animated.View style={[styles.bubbleContainer, animatedBubbleStyle]}>
        <View style={styles.bubble}>
          <Text style={styles.text}>{text}</Text>
        </View>
        <Animated.View style={[styles.arrowContainer, animatedArrowStyle]}>
          <CaretDown size={24} color={Colors.primary} weight="fill" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    zIndex: 999,
  },
  bubbleContainer: {
    position: 'absolute',
    bottom: 84, // Float above the "Run Algorithm" button
    left: 16,
    width: 260,
    alignItems: 'flex-start',
  },
  bubble: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  text: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.white,
    lineHeight: 18,
  },
  arrowContainer: {
    marginLeft: 24, // align with the center of the Run Algorithm button icon
    marginTop: -2,
  },
})
