import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { BottomSheet } from './BottomSheet'
import { Button } from './Button'
import { Colors } from '@/constants/colors'
import { useConfigStore } from '@/stores/useConfigStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { Warning } from 'phosphor-react-native'

export function SyncConflictSheet() {
  const user = useAuthStore((s) => s.user)
  const conflictConfig = useConfigStore((s) => s.conflictConfig)
  const resolveConflict = useConfigStore((s) => s.resolveConflict)

  const visible = conflictConfig !== null

  if (!visible || !conflictConfig || !user?.id) return null

  const handleKeepLocal = () => {
    resolveConflict('local', user.id)
  }

  const handleUseCloud = () => {
    resolveConflict('cloud', user.id)
  }

  return (
    <BottomSheet visible={visible} onClose={() => {}}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Warning size={40} color={Colors.warning} />
        </View>
        <Text style={styles.title}>Version Conflict Detected</Text>
        <Text style={styles.description}>
          The configuration "{conflictConfig.local.name}" has been modified on another device.
          Please select which version you would like to keep.
        </Text>
        
        <View style={styles.cardRow}>
          <View style={styles.versionCard}>
            <Text style={styles.cardLabel}>Local Version</Text>
            <Text style={styles.cardMeta}>
              Last modified:{'\n'}{new Date(conflictConfig.local.updatedAt).toLocaleString()}
            </Text>
            <Text style={styles.cardMeta}>
              Segments: {conflictConfig.local.departments.length}
            </Text>
          </View>
          <View style={styles.versionCard}>
            <Text style={styles.cardLabel}>Cloud Version</Text>
            <Text style={styles.cardMeta}>
              Last modified:{'\n'}{new Date(conflictConfig.remote.updatedAt).toLocaleString()}
            </Text>
            <Text style={styles.cardMeta}>
              Segments: {conflictConfig.remote.departments.length}
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            label="Keep Local Version (Overwrite Cloud)"
            variant="primary"
            onPress={handleKeepLocal}
            style={styles.button}
          />
          <Button
            label="Use Cloud Version (Discard Local)"
            variant="secondary"
            onPress={handleUseCloud}
            style={styles.button}
          />
        </View>
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.warningContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 20,
    marginBottom: 20,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 16,
    width: '100%',
  },
  versionCard: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.surfaceAlt,
  },
  cardLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  cardMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 16,
    gap: 10,
  },
  button: {
    width: '100%',
  },
})
