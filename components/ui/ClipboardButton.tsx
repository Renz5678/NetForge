// Shows a Copy button that animates to a checkmark for 1.5s after copying
import React, { useState, useRef } from 'react'
import { Pressable, Text, View, StyleSheet, Animated } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Copy, Check } from 'phosphor-react-native'
import { Colors } from '@/constants/colors'

type Props = { text: string; label?: string; style?: any }

export function ClipboardButton({ text, label = 'Copy', style }: Props) {
  const [copied, setCopied] = useState(false)
  const scaleAnim = useRef(new Animated.Value(1)).current

  const handleCopy = async () => {
    await Clipboard.setStringAsync(text)
    setCopied(true)
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start()
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.btn, copied && styles.btnCopied, pressed && { opacity: 0.8 }, style]}
      onPress={handleCopy}
    >
      <Animated.View style={[styles.inner, { transform: [{ scale: scaleAnim }] }]}>
        {copied
          ? <Check size={14} color={Colors.success} weight="bold" />
          : <Copy size={14} color={Colors.primary} weight="duotone" />}
        <Text style={[styles.label, copied && styles.labelCopied]}>
          {copied ? 'Copied!' : label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  btnCopied: {
    borderColor: Colors.success,
    backgroundColor: `${Colors.success}10`,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: Colors.primary },
  labelCopied: { color: Colors.success },
})
