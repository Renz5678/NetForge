/**
 * components/ui/DeviceTypePicker.tsx
 *
 * Icon-grid device type selector.
 * Shows 5 device types as interactive tiles (icon + label + short description).
 * Selected state is highlighted with the app's primary color palette.
 */

import React from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native'
import { Colors } from '@/constants/colors'
import {
  RouterIcon,
  SwitchIcon,
  FirewallIcon,
  WanIcon,
  DepartmentIcon,
} from '@/components/ui/DeviceIcons'
import type { DeviceType } from '@/types'

// ── Device option definitions ─────────────────────────────────────────────────

type DeviceOption = {
  type: DeviceType
  label: string
  description: string
  activeColor: string
  activeBg: string
}

const DEVICE_OPTIONS: DeviceOption[] = [
  {
    type: 'department',
    label: 'Host',
    description: 'End device / workstation group',
    activeColor: '#3B82F6',
    activeBg: '#1E3A5F',
  },
  {
    type: 'router',
    label: 'Router',
    description: 'L3 routing & forwarding',
    activeColor: '#60A5FA',
    activeBg: '#1E3A8A',
  },
  {
    type: 'switch',
    label: 'Switch',
    description: 'L2 switching & VLANs',
    activeColor: '#10B981',
    activeBg: '#064E3B',
  },
  {
    type: 'firewall',
    label: 'Firewall',
    description: 'ACL & security boundary',
    activeColor: '#F97316',
    activeBg: '#7C2D12',
  },
  {
    type: 'wan',
    label: 'WAN',
    description: 'Internet / external link',
    activeColor: '#2DD4BF',
    activeBg: '#134E4A',
  },
]

// ── Icon renderer ─────────────────────────────────────────────────────────────

function DeviceOptionIcon({
  type,
  size,
  isSelected,
}: {
  type: DeviceType
  size: number
  isSelected: boolean
}) {
  const color = isSelected ? '#FFFFFF' : Colors.textMuted
  switch (type) {
    case 'router':     return <RouterIcon     size={size} color={color} />
    case 'switch':     return <SwitchIcon     size={size} color={color} />
    case 'firewall':   return <FirewallIcon   size={size} color={color} />
    case 'wan':        return <WanIcon        size={size} color={color} />
    default:           return <DepartmentIcon size={size} color={color} />
  }
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  value: DeviceType
  onChange: (type: DeviceType) => void
}

export function DeviceTypePicker({ value, onChange }: Props) {
  return (
    <View style={styles.grid}>
      {DEVICE_OPTIONS.map((opt) => {
        const isSelected = value === opt.type
        return (
          <Pressable
            key={opt.type}
            style={({ pressed }) => [
              styles.tile,
              isSelected && { backgroundColor: opt.activeBg, borderColor: opt.activeColor },
              pressed && !isSelected && styles.tilePressed,
            ]}
            onPress={() => onChange(opt.type)}
            accessibilityLabel={`Select ${opt.label}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          >
            {/* Icon */}
            <View style={[styles.iconWrap, isSelected && { backgroundColor: opt.activeColor + '30' }]}>
              <DeviceOptionIcon type={opt.type} size={28} isSelected={isSelected} />
            </View>

            {/* Label */}
            <Text
              style={[
                styles.tileLabel,
                isSelected && { color: Colors.white },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>

            {/* Description */}
            <Text
              style={[
                styles.tileDesc,
                isSelected && { color: 'rgba(255,255,255,0.60)' },
              ]}
              numberOfLines={2}
            >
              {opt.description}
            </Text>

            {/* Selected indicator dot */}
            {isSelected && (
              <View style={[styles.selectedDot, { backgroundColor: opt.activeColor }]} />
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    // 2 columns with gap: each tile is ~(containerWidth - 8) / 2
    // Using flex-basis % approach: wrap handles the rest
    width: '47.5%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 12,
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  tilePressed: {
    backgroundColor: Colors.ice,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.ice,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
  },
  tileDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    lineHeight: 14,
  },
  selectedDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})
