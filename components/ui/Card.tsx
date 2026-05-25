import React, { type ReactNode } from 'react'
import { View, StyleSheet, type ViewProps } from 'react-native'
import { Colors } from '@/constants/colors'

type CardProps = ViewProps & {
  children: ReactNode
  padding?: number
}

export function Card({ children, style, padding = 16, ...rest }: CardProps) {
  return (
    <View style={[styles.card, { padding }, style]} {...rest}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
  },
})
