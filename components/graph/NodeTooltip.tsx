// NodeTooltip.tsx
// Floating React Native View anchored near a selected node.
// Converts canvas (node.x, node.y) → screen position using current pan/zoom.
//
// Shows:
//   - Device name + type badge
//   - IP / Subnet + VLAN ID
//   - Port count + peer link count
//
// Quick-action buttons:
//   - Analyze Network (triggers full viz from this node)
//   - Simulate Failure (long-press equivalent)
//   - Close

import React from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native'
import {
  ChartBar,
  Warning,
  X,
  WifiHigh,
  ShieldSlash,
  Desktop,
  Graph,
} from 'phosphor-react-native'
import { Colors } from '@/constants/colors'
import type { NetworkNode } from '@/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// ── Device type labels ────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  router:     'Router',
  switch:     'Switch',
  firewall:   'Firewall',
  wan:        'WAN Gateway',
  NetworkNode: 'Endpoint',
}

const TYPE_COLOR: Record<string, string> = {
  router:     '#3B82F6',
  switch:     '#10B981',
  firewall:   '#F97316',
  wan:        '#2DD4BF',
  NetworkNode: '#60A5FA',
}

type NodeTooltipProps = {
  dept:          NetworkNode
  screenX:       number   // screen-space X of node centre
  screenY:       number   // screen-space Y of node centre
  peerCount:     number
  nodeHeight:    number   // current rendered node height in screen pixels
  onClose:       () => void
  onAnalyze:     () => void
  onSimFailure:  () => void
}

export function NodeTooltip({
  dept,
  screenX,
  screenY,
  peerCount,
  nodeHeight,
  onClose,
  onAnalyze,
  onSimFailure,
}: NodeTooltipProps) {
  const typeKey    = dept.type ?? 'NetworkNode'
  const typeLabel  = TYPE_LABEL[typeKey] ?? 'Device'
  const typeColor  = TYPE_COLOR[typeKey] ?? Colors.primary

  const portCount  = dept.ports?.length ?? 0
  const hasIp      = !!dept.subnet && dept.subnet !== '—'
  const vlanLabel  = dept.vlanId ? `VLAN ${dept.vlanId}` : 'No VLAN'

  // Position tooltip above the node with a small gap
  // Clamp so it doesn't overflow left/right screen edges
  const TOOLTIP_W = 230
  const TOOLTIP_OFFSET_Y = nodeHeight / 2 + 14
  const rawLeft = screenX - TOOLTIP_W / 2
  const clampedLeft = Math.max(12, Math.min(SCREEN_WIDTH - TOOLTIP_W - 12, rawLeft))
  const top = screenY - TOOLTIP_OFFSET_Y - 130  // 130 ≈ tooltip card height

  return (
    <View
      style={[styles.container, { left: clampedLeft, top }]}
      pointerEvents="box-none"
    >
      {/* Caret / pointer at bottom */}
      <View style={[styles.caret, { left: screenX - clampedLeft - 7 }]} />

      {/* Header row */}
      <View style={styles.header}>
        <View style={[styles.typeBadge, { backgroundColor: `${typeColor}22`, borderColor: `${typeColor}44` }]}>
          <Text style={[styles.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        <Text style={styles.deviceName} numberOfLines={1}>{dept.name}</Text>
        <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
          <X size={14} color={Colors.textMuted} />
        </Pressable>
      </View>

      {/* Info rows */}
      <View style={styles.infoGrid}>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>SUBNET</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{hasIp ? dept.subnet : '—'}</Text>
        </View>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>VLAN</Text>
          <Text style={styles.infoValue}>{vlanLabel}</Text>
        </View>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>PORTS</Text>
          <Text style={styles.infoValue}>{portCount > 0 ? portCount : '—'}</Text>
        </View>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>LINKS</Text>
          <Text style={styles.infoValue}>{peerCount}</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Quick actions */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.action, styles.actionPrimary, pressed && { opacity: 0.8 }]}
          onPress={onAnalyze}
        >
          <Graph size={13} color={Colors.white} weight="fill" />
          <Text style={styles.actionTextPrimary}>Analyze</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.action, styles.actionDanger, pressed && { opacity: 0.8 }]}
          onPress={onSimFailure}
        >
          <Warning size={13} color={Colors.error} weight="fill" />
          <Text style={styles.actionTextDanger}>Sim Failure</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 230,
    backgroundColor: 'rgba(13,17,23,0.96)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99,132,255,0.20)',
    padding: 12,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  caret: {
    position: 'absolute',
    bottom: -7,
    width: 14,
    height: 14,
    backgroundColor: 'rgba(13,17,23,0.96)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(99,132,255,0.20)',
    transform: [{ rotate: '45deg' }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  typeBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  deviceName: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#E2E8F0',
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 2,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  infoCell: {
    flex: 1,
    minWidth: '44%',
  },
  infoLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 8,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  infoValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#CBD5E1',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(99,132,255,0.14)',
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 8,
    paddingVertical: 7,
  },
  actionPrimary: {
    backgroundColor: Colors.primary,
  },
  actionDanger: {
    backgroundColor: Colors.errorContainer,
    borderWidth: 1,
    borderColor: `${Colors.error}40`,
  },
  actionTextPrimary: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.white,
  },
  actionTextDanger: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.error,
  },
})
