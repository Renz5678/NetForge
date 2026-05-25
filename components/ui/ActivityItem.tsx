import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '@/constants/colors'
import { formatActivityTime } from '@/lib/formatters'

type ActivityItemProps = {
  icon: string
  description: string
  timestamp: string
  showDivider?: boolean
}

export function ActivityItem({ icon, description, timestamp, showDivider = true }: ActivityItemProps) {
  return (
    <View>
      {showDivider && <View style={styles.divider} />}
      <View style={styles.row}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.description}>{description}</Text>
          <Text style={styles.timestamp}>{formatActivityTime(timestamp)}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: -16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}14`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  timestamp: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
})
