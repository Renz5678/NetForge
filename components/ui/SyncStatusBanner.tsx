import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { CloudSlash } from 'phosphor-react-native'
import { useConfigStore } from '@/stores/useConfigStore'
import { Colors } from '@/constants/colors'

export function SyncStatusBanner() {
  const pendingOps = useConfigStore((s) => s.pendingOps)
  const syncing = useConfigStore((s) => s.syncing)

  if (pendingOps.length === 0) return null

  return (
    <View
      style={[
        styles.container,
        syncing ? styles.containerSyncing : styles.containerOffline,
      ]}
    >
      {syncing ? (
        <>
          <ActivityIndicator size="small" color={Colors.primary} style={styles.icon} />
          <Text style={[styles.text, styles.textSyncing]}>
            Syncing {pendingOps.length} pending change{pendingOps.length !== 1 ? 's' : ''} to cloud...
          </Text>
        </>
      ) : (
        <>
          <CloudSlash size={18} color={Colors.warning} style={styles.icon} />
          <Text style={[styles.text, styles.textOffline]}>
            Offline — {pendingOps.length} change{pendingOps.length !== 1 ? 's' : ''} pending sync
          </Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  containerSyncing: {
    backgroundColor: Colors.ice,
    borderBottomColor: Colors.border,
  },
  containerOffline: {
    backgroundColor: Colors.warningContainer,
    borderBottomColor: Colors.warning,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  textSyncing: {
    color: Colors.textPrimary,
  },
  textOffline: {
    color: Colors.textPrimary,
  },
})
