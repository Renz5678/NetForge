import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native'
import { useRouter } from 'expo-router'
import {
  Plus,
  MagnifyingGlass,
  CaretRight,
  Trash,
  Copy,
  ShareNetwork,
  FolderSimpleDashed,
} from 'phosphor-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { useConfigStore } from '@/stores/useConfigStore'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Colors } from '@/constants/colors'
import { pluralize, formatRelativeTime } from '@/lib/formatters'
import type { NetworkConfig } from '@/types'

function getStatusBadge(config: NetworkConfig): { label: string; variant: BadgeVariant } {
  if (config.isValid === undefined || config.departments.length === 0) {
    return { label: 'Pending', variant: 'neutral' }
  }
  if (config.isValid) return { label: 'Valid', variant: 'success' }
  return { label: 'Invalid', variant: 'error' }
}

function ConfigSkeleton() {
  const pulseAnim = React.useRef(new Animated.Value(0.4)).current

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [pulseAnim])

  const cardStyle = { opacity: pulseAnim }

  return (
    <View style={styles.listContent}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Animated.View key={i} style={[styles.configCard, cardStyle]}>
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.iconContainer, { backgroundColor: Colors.border, width: 40, height: 40, borderRadius: 20 }]} />
                <View style={[styles.textContainer, { gap: 6 }]}>
                  <View style={{ width: 140, height: 16, backgroundColor: Colors.border, borderRadius: 4 }} />
                  <View style={{ width: 90, height: 12, backgroundColor: Colors.border, borderRadius: 4 }} />
                </View>
              </View>
              <View style={{ width: 60, height: 22, backgroundColor: Colors.border, borderRadius: 12 }} />
            </View>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.cardActions}>
            <View style={{ width: 120, height: 12, backgroundColor: Colors.border, borderRadius: 4 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 70, height: 24, backgroundColor: Colors.border, borderRadius: 6 }} />
              <View style={{ width: 60, height: 24, backgroundColor: Colors.border, borderRadius: 6 }} />
            </View>
          </View>
        </Animated.View>
      ))}
    </View>
  )
}

export default function ConfigsScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { configs, loadConfigs, createConfig, deleteConfig, duplicateConfig, loading } = useConfigStore()

  const [search, setSearch] = useState('')
  const [showNewSheet, setShowNewSheet] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [nameError, setNameError] = useState('')
  const [baseIp, setBaseIp] = useState('10.0.0.0')
  const [vlanStart, setVlanStart] = useState('10')
  const [ipError, setIpError] = useState('')
  const [vlanError, setVlanError] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) loadConfigs(user.id)
  }, [user?.id])

  const filtered = configs.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const validateIp = (ip: string) => {
    return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip.trim())
  }

  const handleCreate = async () => {
    setNameError('')
    setIpError('')
    setVlanError('')

    let valid = true
    if (!newName.trim()) {
      setNameError('Please enter a configuration name')
      valid = false
    }

    if (!baseIp.trim()) {
      setIpError('Base IP Address is required')
      valid = false
    } else if (!validateIp(baseIp)) {
      setIpError('Please enter a valid IPv4 address (e.g. 10.0.0.0)')
      valid = false
    }

    const vlanNum = parseInt(vlanStart, 10)
    if (!vlanStart.trim()) {
      setVlanError('Starting VLAN ID is required')
      valid = false
    } else if (isNaN(vlanNum) || vlanNum < 1 || vlanNum > 4094) {
      setVlanError('VLAN ID must be a number between 1 and 4094')
      valid = false
    }

    if (!valid || !user?.id) return

    setCreating(true)
    const config = await createConfig(newName.trim(), user.id, baseIp.trim(), vlanNum)
    setCreating(false)
    setShowNewSheet(false)
    setNewName('')
    setBaseIp('10.0.0.0')
    setVlanStart('10')
    setNameError('')
    setIpError('')
    setVlanError('')
    if (config) {
      router.push(`/config/${config.id}`)
    }
  }

  const handleDelete = (id: string) => {
    deleteConfig(id)
  }

  const handleDuplicate = (id: string) => {
    if (user?.id) duplicateConfig(id, user.id)
  }

  const renderConfig = ({ item }: { item: NetworkConfig }) => {
    const badge = getStatusBadge(item)
    const deptCount = item.departments.length
    const vlanCount = item.departments.filter((d) => d.vlanId !== undefined).length

    return (
      <View style={styles.configCard}>
        <Pressable
          style={styles.cardContent}
          onPress={() => router.push(`/config/${item.id}`)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconContainer}>
                <ShareNetwork size={20} color={Colors.primary} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.configName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.configMeta}>
                  {pluralize(deptCount, 'Department')} • {pluralize(vlanCount, 'VLAN')}
                </Text>
              </View>
            </View>
            <View style={styles.cardHeaderRight}>
              <Badge label={badge.label} variant={badge.variant} />
              <CaretRight size={18} color={Colors.pale} style={styles.caret} />
            </View>
          </View>
        </Pressable>

        <View style={styles.cardDivider} />

        <View style={styles.cardActions}>
          <Text style={styles.dateText}>Edited {formatRelativeTime(item.updatedAt)}</Text>
          <View style={styles.actionButtons}>
            <Pressable style={styles.actionBtn} onPress={() => handleDuplicate(item.id)}>
              <Copy size={14} color={Colors.medium} />
              <Text style={styles.actionBtnText}>Duplicate</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => setDeleteConfirmId(item.id)}>
              <Trash size={14} color={Colors.error} />
              <Text style={[styles.actionBtnText, styles.deleteBtnText]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />
      
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ShareNetwork size={22} color={Colors.primary} weight="bold" />
        </View>
        <Text style={styles.title}>My Configurations</Text>
        <Pressable
          style={styles.headerPlus}
          onPress={() => {
            setNewName('')
            setBaseIp('10.0.0.0')
            setVlanStart('10')
            setNameError('')
            setIpError('')
            setVlanError('')
            setShowNewSheet(true)
          }}
        >
          <Plus size={24} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Sleek Search Bar */}
      <View style={styles.searchContainer}>
        <MagnifyingGlass size={20} color={Colors.primary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search configurations..."
          placeholderTextColor={`${Colors.medium}66`}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Config list */}
      {loading ? (
        <ConfigSkeleton />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderConfig}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <FolderSimpleDashed size={48} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No configurations yet</Text>
              <Text style={styles.emptySubtitle}>
                Create a new topology configuration to design and visualize routing algorithms in real time.
              </Text>
              <View style={{ marginTop: 8, width: 220 }}>
                <Button
                  label="Create Configuration"
                  variant="primary"
                  onPress={() => {
                    setNewName('')
                    setBaseIp('10.0.0.0')
                    setVlanStart('10')
                    setNameError('')
                    setIpError('')
                    setVlanError('')
                    setShowNewSheet(true)
                  }}
                />
              </View>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button (FAB) */}
      <Pressable
        style={styles.fab}
        onPress={() => {
          setNewName('')
          setBaseIp('10.0.0.0')
          setVlanStart('10')
          setNameError('')
          setIpError('')
          setVlanError('')
          setShowNewSheet(true)
        }}
      >
        <Plus size={28} color={Colors.white} />
      </Pressable>

      {/* New Config Bottom Sheet */}
      <BottomSheet
        visible={showNewSheet}
        onClose={() => setShowNewSheet(false)}
        snapHeight={460}
      >
        <Text style={styles.sheetTitle}>New configuration</Text>
        <View style={styles.sheetContent}>
          <Input
            label="Configuration name"
            placeholder="e.g. Office Network Q3"
            value={newName}
            onChangeText={setNewName}
            error={nameError}
            autoFocus
          />
          <Input
            label="Base IP Address"
            placeholder="e.g. 10.0.0.0"
            value={baseIp}
            onChangeText={setBaseIp}
            error={ipError}
          />
          <Input
            label="Starting VLAN ID"
            placeholder="e.g. 10"
            value={vlanStart}
            onChangeText={setVlanStart}
            error={vlanError}
            keyboardType="numeric"
          />
          <View style={styles.sheetButtons}>
            <Button
              label="Create"
              variant="primary"
              fullWidth
              loading={creating}
              onPress={handleCreate}
            />
            <Button
              label="Cancel"
              variant="ghost"
              fullWidth
              onPress={() => setShowNewSheet(false)}
            />
          </View>
        </View>
      </BottomSheet>

      {/* Delete Confirmation Bottom Sheet */}
      <BottomSheet
        visible={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        snapHeight={250}
      >
        <Text style={styles.sheetTitle}>Delete Configuration?</Text>
        <Text style={[styles.sheetSubtitle, { marginBottom: 20 }]}>
          This action is permanent. All departments, routing tables, and configurations in this network will be deleted.
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => setDeleteConfirmId(null)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Delete"
              variant="destructive"
              onPress={() => {
                if (deleteConfirmId) {
                  handleDelete(deleteConfirmId)
                  setDeleteConfirmId(null)
                }
              }}
            />
          </View>
        </View>
      </BottomSheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surfaceAlt },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  headerLeft: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
  },
  headerPlus: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#AABFEF',
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 100,
  },
  configCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#AABFEF',
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.ice,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  configName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  configMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  caret: {
    marginLeft: 4,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFF',
  },
  dateText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  actionBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.medium,
  },
  deleteBtn: {},
  deleteBtnText: {
    color: Colors.error,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.ice,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sheetTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  sheetSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  sheetContent: { gap: 16 },
  sheetButtons: { gap: 8 },
})
