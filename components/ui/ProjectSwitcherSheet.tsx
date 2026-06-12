/**
 * components/ui/ProjectSwitcherSheet.tsx
 *
 * Bottom sheet listing all NetworkConfigs with:
 *   - Name, last-modified timestamp, node count, validate score
 *   - Tap to set active + dismiss
 *   - Swipe-left to delete (long-press → confirm via Alert)
 *   - Create / Duplicate pinned at the bottom
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native'
import {
  Plus,
  Copy,
  Trash,
  ShieldCheck,
  Warning,
  Clock,
} from 'phosphor-react-native'
import { useRouter } from 'expo-router'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Colors } from '@/constants/colors'
import { useConfigStore } from '@/stores/useConfigStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { formatRelativeTime } from '@/lib/formatters'
import type { NetworkConfig } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number | undefined, isValid: boolean | undefined): string {
  if (isValid === false) return Colors.error
  if (score === undefined) return Colors.textMuted
  if (score >= 90) return Colors.success
  if (score >= 70) return Colors.warning
  return Colors.error
}

function scoreLabel(isValid: boolean | undefined): string {
  if (isValid === true) return 'Valid'
  if (isValid === false) return 'Invalid'
  return 'Not run'
}

// ─── Config Row ───────────────────────────────────────────────────────────────

function ConfigRow({
  config,
  isActive,
  onSelect,
  onDelete,
}: {
  config: NetworkConfig
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const color = scoreColor(undefined, config.isValid)
  const label = scoreLabel(config.isValid)

  const isDemoConfig = config.id.startsWith('demo_')

  return (
    <Pressable
      style={({ pressed }) => [
        styles.configRow,
        isActive && styles.configRowActive,
        pressed && { backgroundColor: Colors.surfaceAlt },
      ]}
      onPress={onSelect}
    >
      {/* Active indicator stripe */}
      {isActive && <View style={styles.activeStripe} />}

      <View style={styles.configBody}>
        {/* Top: name + status badge */}
        <View style={styles.configTop}>
          <Text style={[styles.configName, isActive && styles.configNameActive]} numberOfLines={1}>
            {config.name}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: color + '18', borderColor: color + '30' }]}>
            {config.isValid ? (
              <ShieldCheck size={10} color={color} weight="fill" />
            ) : (
              <Warning size={10} color={color} weight="fill" />
            )}
            <Text style={[styles.statusText, { color }]}>{label}</Text>
          </View>
        </View>

        {/* Bottom: meta row */}
        <View style={styles.configMeta}>
          <Clock size={11} color={Colors.textMuted} />
          <Text style={styles.configMetaText}>
            {formatRelativeTime(config.updatedAt)}
          </Text>
          <View style={styles.metaDivider} />
          <Text style={styles.configMetaText}>
            {config.departments.length} nodes
          </Text>
          <View style={styles.metaDivider} />
          <Text style={styles.configMetaText}>
            {config.departments.reduce(
              (sum, d) => sum + d.peers.length, 0
            ) / 2 | 0} links
          </Text>
        </View>
      </View>

      {/* Delete — hidden for demo configs */}
      {!isDemoConfig && (
        <Pressable
          style={styles.deleteBtn}
          onPress={onDelete}
          hitSlop={8}
          accessibilityLabel={`Delete ${config.name}`}
        >
          <Trash size={16} color={Colors.error} />
        </Pressable>
      )}
    </Pressable>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Props = {
  visible: boolean
  onClose: () => void
}

export function ProjectSwitcherSheet({ visible, onClose }: Props) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  // useConfigStore: always use granular selectors — never destructure the whole store.
  // See AGENTS.md §6 for rationale.
  const configs        = useConfigStore((s) => s.configs)
  const activeConfig   = useConfigStore((s) => s.activeConfig)
  const setActiveConfig = useConfigStore((s) => s.setActiveConfig)
  const createConfig   = useConfigStore((s) => s.createConfig)
  const deleteConfig   = useConfigStore((s) => s.deleteConfig)
  const duplicateConfig = useConfigStore((s) => s.duplicateConfig)

  const [creating, setCreating] = useState(false)

  const userConfigs = configs.filter((c) => !c.id.startsWith('local_tpl_'))

  const handleSelect = (config: NetworkConfig) => {
    setActiveConfig(config.id)
    onClose()
    router.push(`/config/${config.id}`)
  }

  const handleCreate = async () => {
    if (!user?.id) return
    setCreating(true)
    const newConfig = await createConfig('New Network', user.id)
    setCreating(false)
    if (newConfig) {
      setActiveConfig(newConfig.id)
      onClose()
      router.push(`/config/${newConfig.id}`)
    }
  }

  const handleDelete = (config: NetworkConfig) => {
    Alert.alert(
      `Delete "${config.name}"?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteConfig(config.id),
        },
      ]
    )
  }

  const handleDuplicate = (config: NetworkConfig) => {
    if (!user?.id) return
    duplicateConfig(config.id, user.id)
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Projects</Text>
        <Text style={styles.headerCount}>{userConfigs.length}</Text>
      </View>

      {/* Config list */}
      <FlatList
        data={userConfigs}
        keyExtractor={(item) => item.id}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ConfigRow
            config={item}
            isActive={activeConfig?.id === item.id}
            onSelect={() => handleSelect(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No projects yet. Create one below.</Text>
          </View>
        }
      />

      {/* Footer actions */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.footerBtn, styles.footerBtnPrimary, pressed && { opacity: 0.85 }]}
          onPress={handleCreate}
          disabled={creating}
        >
          {creating
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Plus size={16} color={Colors.white} weight="bold" />
          }
          <Text style={styles.footerBtnTextPrimary}>New Project</Text>
        </Pressable>

        {activeConfig && !activeConfig.id.startsWith('demo_') && (
          <Pressable
            style={({ pressed }) => [styles.footerBtn, styles.footerBtnSecondary, pressed && { opacity: 0.8 }]}
            onPress={() => handleDuplicate(activeConfig)}
          >
            <Copy size={16} color={Colors.primary} />
            <Text style={styles.footerBtnTextSecondary}>Duplicate Active</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    flex: 1,
  },
  headerCount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textMuted,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  list: {
    maxHeight: 320,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
    position: 'relative',
  },
  configRowActive: {
    backgroundColor: `${Colors.primary}08`,
  },
  activeStripe: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  configBody: {
    flex: 1,
    gap: 4,
  },
  configTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  configName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
  },
  configNameActive: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  configMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  configMetaText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.pale,
  },
  deleteBtn: {
    padding: 6,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  footer: {
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
  },
  footerBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  footerBtnSecondary: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  footerBtnTextPrimary: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
  footerBtnTextSecondary: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
  },
})
