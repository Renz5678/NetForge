import React from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import { Colors } from '@/constants/colors'

import { Check } from 'phosphor-react-native'

type PeerChipProps = {
  label: string
  selected: boolean
  onPress: () => void
}

export function PeerChip({ label, selected, onPress }: PeerChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected ? styles.selected : styles.unselected]}
    >
      {selected && <Check size={14} color={Colors.white} style={{ marginRight: 4 }} />}
      <Text style={[styles.label, selected ? styles.selectedLabel : styles.unselectedLabel]}>
        {label}
      </Text>
    </Pressable>
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
  checkmark: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
})
