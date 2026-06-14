import React, { useEffect, useRef, type ReactNode } from 'react'
import {
  Modal,
  View,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  PanResponder,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/constants/colors'
import { useHaptics } from '@/hooks/useHaptics'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

type BottomSheetProps = {
  visible: boolean
  onClose: () => void
  children: ReactNode
  snapHeight?: number | 'auto'
}

export function BottomSheet({ visible, onClose, children, snapHeight = 'auto' }: BottomSheetProps) {
  const insets = useSafeAreaInsets()
  const haptics = useHaptics()
  const translateY   = useRef(new Animated.Value(SCREEN_HEIGHT)).current
  const opacity      = useRef(new Animated.Value(0)).current
  const handleScale  = useRef(new Animated.Value(1)).current
  const handleOpacity = useRef(new Animated.Value(0.4)).current

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Animate handle hint on open
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 42,
          stiffness: 380,
          mass: 0.8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Subtle handle fade-in only — no scale bounce
        Animated.timing(handleOpacity, {
          toValue: 0.5,
          duration: 200,
          useNativeDriver: true,
        }).start()
      })
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()
      handleScale.setValue(1)
      handleOpacity.setValue(0.4)
    }
  }, [visible])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          haptics.light()
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: SCREEN_HEIGHT,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onCloseRef.current()
          })
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 42,
            stiffness: 380,
            mass: 0.8,
          }).start()
        }
      },
    })
  ).current

  const sheetHeight = snapHeight === 'auto' ? undefined : snapHeight

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
        keyboardVerticalOffset={0}
      >
        <Animated.View style={[styles.backdrop, { opacity }]} accessibilityViewIsModal={true}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY }], flexShrink: 1 },
            sheetHeight !== undefined ? { height: sheetHeight } : null,
            { paddingBottom: insets.bottom + 16, maxHeight: SCREEN_HEIGHT * 0.90 },
          ]}
        >
          {/* Animated handle bar */}
          <View style={styles.handleContainer} {...panResponder.panHandlers}>
            <Animated.View
              style={[
                styles.handle,
                {
                  transform: [{ scaleX: handleScale }],
                  opacity: handleOpacity,
                },
              ]}
            />
          </View>

          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 26, 65, 0.45)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.10,
        shadowRadius: 20,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
})
