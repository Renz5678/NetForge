/**
 * components/ui/FindingRow.tsx
 *
 * A single inline validation finding row.
 *
 * Left:  severity dot (red / yellow / blue)
 * Body:  title + affected names (monospace, muted, comma-separated)
 * Right: tap-able › chevron → onDrillDown()
 *
 * No card background — sits inside a grouped section card.
 */

import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { CaretRight } from 'phosphor-react-native'
import { Colors } from '@/constants/colors'
import type { Finding, FindingSeverity } from '@/lib/validatePass'
import { severityColor, severityLabel } from '@/lib/validateColors'

type Props = {
  finding: Finding
  onDrillDown: (finding: Finding) => void
  showDivider?: boolean
}



export function FindingRow({ finding, onDrillDown, showDivider = false }: Props) {
  const color = severityColor(finding.severity)

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: Colors.surfaceAlt }]}
        onPress={() => onDrillDown(finding)}
        accessibilityRole="button"
        accessibilityLabel={`${severityLabel(finding.severity)}: ${finding.title}`}
      >
        {/* Severity dot */}
        <View style={[styles.dot, { backgroundColor: color }]} />

        {/* Content */}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>{finding.title}</Text>
          {finding.affected.length > 0 && (
            <Text style={styles.affected} numberOfLines={1}>
              {finding.affected.join(', ')}
            </Text>
          )}
        </View>

        {/* Drill-down chevron */}
        <CaretRight size={16} color={Colors.pale} />
      </Pressable>

      {showDivider && <View style={styles.divider} />}
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    minHeight: 52,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  affected: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
})
