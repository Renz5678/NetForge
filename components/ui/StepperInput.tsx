import React from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { Colors } from '@/constants/colors'

type StepperInputProps = {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
}

export function StepperInput({ value, onChange, min = 0, max = 16_777_214 }: StepperInputProps) {
  const decrement = () => {
    if (value > min) onChange(value - 1)
  }

  const increment = () => {
    if (value < max) onChange(value + 1)
  }

  const handleTextChange = (text: string) => {
    const parsed = parseInt(text, 10)
    if (!isNaN(parsed)) {
      const clamped = Math.min(Math.max(parsed, min), max)
      onChange(clamped)
    } else if (text === '') {
      onChange(min)
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        onPress={decrement}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        disabled={value <= min}
      >
        <Text style={[styles.buttonText, value <= min && styles.disabledText]}>−</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        value={String(value)}
        onChangeText={handleTextChange}
        keyboardType="numeric"
        textAlign="center"
        selectTextOnFocus
      />
      <Pressable
        onPress={increment}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        disabled={value >= max}
      >
        <Text style={[styles.buttonText, value >= max && styles.disabledText]}>+</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.ice,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 52,
    overflow: 'hidden',
  },
  button: {
    width: 52,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: Colors.border,
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: Colors.primary,
  },
  disabledText: {
    color: Colors.pale,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
})
