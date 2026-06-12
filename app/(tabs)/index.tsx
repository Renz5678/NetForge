/**
 * app/(tabs)/index.tsx  — Canvas tab
 *
 * The entry point of the engineer workflow.
 * Shows the active project with its metadata and provides one-tap navigation
 * to the Skia canvas (config detail screen).
 *
 * Header project name taps open the ProjectSwitcherSheet.
 * FAB creates a new project and navigates directly to canvas.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Plus,
  TreeStructure,
  CaretDown,
  ShieldCheck,
  Warning,
  ArrowRight,
  Buildings,
  ChartPieSlice,
  Atom,
  Storefront,
  Globe,
  HardDrives,
  Broadcast,
} from 'phosphor-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuthStore } from '@/stores/useAuthStore'
import { useConfigStore } from '@/stores/useConfigStore'
import { Colors } from '@/constants/colors'
import { formatRelativeTime, pluralize } from '@/lib/formatters'
import { useHaptics } from '@/hooks/useHaptics'
import { NETWORK_TEMPLATES, getTemplateConfig } from '@/lib/templates'
import { TopHeader } from '@/components/ui/TopHeader'
import { ProjectSwitcherSheet } from '@/components/ui/ProjectSwitcherSheet'
import type { NetworkConfig } from '@/types'

// ─── Template icon map ───────────────────────────────────────────────────────

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  Storefront,
  Buildings,
  Globe,
  HardDrives,
  Broadcast,
}

// ─── Mini Topology Thumbnail ─────────────────────────────────────────────────

function MiniTopologyThumbnail({ config }: { config: NetworkConfig }) {
  const depts = config.departments
  const visible = depts.slice(0, 8)
  const remaining = depts.length - 8

  const getDotColor = (type?: string) => {
    switch (type) {
      case 'router':
      case 'firewall':
      case 'wan':   return Colors.primary
      case 'switch': return Colors.medium
      default:       return Colors.pale
    }
  }

  return (
    <View style={thumb.container}>
      {visible.map((d) => (
        <View
          key={d.id}
          style={[thumb.dot, { backgroundColor: getDotColor(d.type) }]}
        />
      ))}
      {remaining > 0 && (
        <Text style={thumb.more}>+{remaining}</Text>
      )}
      {depts.length === 0 && (
        <Text style={thumb.empty}>Empty</Text>
      )}
    </View>
  )
}

const thumb = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    padding: 8,
    minHeight: 48,
    alignContent: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  more: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    color: Colors.textMuted,
    alignSelf: 'center',
  },
  empty: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
})

// ─── Active Project Hero ─────────────────────────────────────────────────────

function ActiveProjectHero({
  config,
  onPress,
}: {
  config: NetworkConfig
  onPress: () => void
}) {
  const nodeCount = config.departments.length
  const linkCount = Math.floor(
    config.departments.reduce((sum, d) => sum + d.peers.length, 0) / 2
  )
  const vlanCount = config.departments.filter((d) => d.vlanId !== undefined).length

  return (
    <Pressable
      style={({ pressed }) => [styles.heroCard, pressed && { opacity: 0.93 }]}
      onPress={onPress}
    >
      {/* Status strip */}
      <View style={styles.heroStatus}>
        <View
          style={[
            styles.validityDot,
            { backgroundColor: config.isValid ? Colors.success : Colors.error },
          ]}
        />
        <Text style={styles.heroStatusText}>
          {config.isValid ? 'Valid topology' : 'Needs attention'}
        </Text>
        <Text style={styles.heroTimestamp}>{formatRelativeTime(config.updatedAt)}</Text>
      </View>

      {/* Name */}
      <Text style={styles.heroName} numberOfLines={2}>{config.name}</Text>

      {/* Mini topology */}
      <MiniTopologyThumbnail config={config} />

      {/* Metrics strip */}
      <View style={styles.heroMetrics}>
        <View style={styles.heroMetric}>
          <Text style={styles.heroMetricValue}>{nodeCount}</Text>
          <Text style={styles.heroMetricLabel}>Nodes</Text>
        </View>
        <View style={styles.heroMetricDivider} />
        <View style={styles.heroMetric}>
          <Text style={styles.heroMetricValue}>{linkCount}</Text>
          <Text style={styles.heroMetricLabel}>Links</Text>
        </View>
        <View style={styles.heroMetricDivider} />
        <View style={styles.heroMetric}>
          <Text style={styles.heroMetricValue}>{vlanCount}</Text>
          <Text style={styles.heroMetricLabel}>VLANs</Text>
        </View>
      </View>

      {/* CTA */}
      <View style={styles.heroCta}>
        <TreeStructure size={16} color={Colors.primary} weight="duotone" />
        <Text style={styles.heroCtaText}>Open in Canvas</Text>
        <ArrowRight size={14} color={Colors.primary} />
      </View>
    </Pressable>
  )
}

// ─── Empty Project State ─────────────────────────────────────────────────────

function EmptyProjectState({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <TreeStructure size={44} color={Colors.primary} weight="duotone" />
      <Text style={styles.emptyTitle}>No active project</Text>
      <Text style={styles.emptySubtitle}>
        Create a network topology or start from a scenario template below.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.emptyButton, pressed && { opacity: 0.85 }]}
        onPress={onCreate}
      >
        <Plus size={16} color={Colors.white} weight="bold" />
        <Text style={styles.emptyButtonText}>New Project</Text>
      </Pressable>
    </View>
  )
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickAction({
  icon,
  label,
  onPress,
  isPrimary,
}: {
  icon: React.ReactNode
  label: string
  onPress: () => void
  isPrimary?: boolean
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.quickAction, isPrimary && styles.quickActionPrimary, pressed && { opacity: 0.8 }]}
      onPress={onPress}
    >
      <View style={[styles.quickActionIcon, isPrimary ? styles.quickActionIconPrimary : styles.quickActionIconLight]}>
        {icon}
      </View>
      <Text style={[styles.quickActionLabel, isPrimary && styles.quickActionLabelPrimary]}>
        {label}
      </Text>
    </Pressable>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  const pulse = React.useRef(new Animated.Value(0.4)).current
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start()
  }, [pulse])

  return (
    <Animated.View style={{ opacity: pulse }}>
      <View style={[styles.heroCard, { height: 220, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={{ height: 24, width: '60%', backgroundColor: Colors.border, borderRadius: 6 }} />
      </View>
    </Animated.View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CanvasScreen() {
  const router = useRouter()
  const haptics = useHaptics()
  const user = useAuthStore((s) => s.user)
  // useConfigStore: always use granular selectors — never destructure the whole store.
  // See AGENTS.md §6 for rationale.
  const configs        = useConfigStore((s) => s.configs)
  const activeConfig   = useConfigStore((s) => s.activeConfig)
  const loading        = useConfigStore((s) => s.loading)
  const loadConfigs    = useConfigStore((s) => s.loadConfigs)
  const createConfig   = useConfigStore((s) => s.createConfig)
  const setActiveConfig = useConfigStore((s) => s.setActiveConfig)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  useEffect(() => {
    if (user?.id) loadConfigs(user.id)
  }, [user?.id])

  const userConfigs = useMemo(
    () => configs.filter((c) => !c.id.startsWith('local_tpl_')),
    [configs]
  )

  const recentOthers = useMemo(
    () => userConfigs.filter((c) => c.id !== activeConfig?.id).slice(0, 4),
    [userConfigs, activeConfig]
  )

  const [namePromptOpen, setNamePromptOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameCreating, setNameCreating] = useState(false)
  const nameInputRef = useRef<TextInput>(null)

  // Open the name prompt instead of creating immediately
  const handleCreate = () => {
    setNameInput('')
    setNamePromptOpen(true)
    // Auto-focus after the modal animates in
    setTimeout(() => nameInputRef.current?.focus(), 200)
  }

  const handleConfirmCreate = async () => {
    if (!user?.id) return
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setNameCreating(true)
    haptics.light()
    const newConfig = await createConfig(trimmed, user.id)
    setNameCreating(false)
    setNamePromptOpen(false)
    if (newConfig) {
      haptics.medium()
      setActiveConfig(newConfig.id)
      router.push(`/config/${newConfig.id}`)
    } else {
      haptics.error()
    }
  }

  const handleOpenCanvas = (config: typeof activeConfig) => {
    if (!config) return
    haptics.light()
    setActiveConfig(config.id)
    router.push(`/config/${config.id}`)
  }

  return (
    <LinearGradient colors={['#EEF4FF', '#F5F8FF', '#FFFFFF']} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

        {/* ── Header with project switcher trigger ── */}
        <TopHeader
          title={activeConfig?.name ?? 'NetForge'}
          subtitle={
            <Pressable
              style={styles.switcherTrigger}
              onPress={() => setSwitcherOpen(true)}
              hitSlop={8}
            >
              <Text style={styles.switcherLabel}>
                {pluralize(userConfigs.length, 'project')}
              </Text>
              <CaretDown size={11} color={Colors.primary} weight="bold" />
            </Pressable>
          }
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Active Project ─────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>ACTIVE PROJECT</Text>
          </View>

          {loading ? (
            <Skeleton />
          ) : activeConfig ? (
            <ActiveProjectHero
              config={activeConfig}
              onPress={() => handleOpenCanvas(activeConfig)}
            />
          ) : (
            <EmptyProjectState onCreate={handleCreate} />
          )}

          {/* ── Quick Actions ──────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.quickActionsRow}>
            <QuickAction
              isPrimary
              icon={<Plus size={20} color={Colors.white} weight="bold" />}
              label="New Project"
              onPress={handleCreate}
            />
            <QuickAction
              icon={<ShieldCheck size={20} color={Colors.primary} weight="duotone" />}
              label="Validate"
              onPress={() => router.push('/(tabs)/validate')}
            />
            <QuickAction
              icon={<ChartPieSlice size={20} color={Colors.primary} weight="duotone" />}
              label="Subnet"
              onPress={() => router.push('/(tabs)/subnet')}
            />
          </View>

          {/* ── Recent Projects ────────────────────── */}
          {recentOthers.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Projects</Text>
                <Pressable onPress={() => setSwitcherOpen(true)}>
                  <Text style={styles.seeAll}>See all</Text>
                </Pressable>
              </View>
              <FlatList
                data={recentOthers}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentScroll}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [styles.recentCard, pressed && { opacity: 0.85 }]}
                    onPress={() => handleOpenCanvas(item)}
                  >
                    <View style={styles.recentCardHeader}>
                      <Text style={styles.recentCardName} numberOfLines={1}>{item.name}</Text>
                      <View
                        style={[
                          styles.recentValidityDot,
                          { backgroundColor: item.isValid ? Colors.success : Colors.error },
                        ]}
                      />
                    </View>
                    <MiniTopologyThumbnail config={item} />
                    <Text style={styles.recentCardMeta}>{formatRelativeTime(item.updatedAt)}</Text>
                  </Pressable>
                )}
              />
            </>
          )}

          {/* ── Network Scenarios ──────────────────── */}
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Atom size={13} color={Colors.textMuted} />
              <Text style={styles.sectionLabel}>SCENARIO TEMPLATES</Text>
            </View>
          </View>
          <View style={styles.templateList}>
            {NETWORK_TEMPLATES.map((template) => {
              const Icon = TEMPLATE_ICONS[template.iconName] || Atom
              return (
                <Pressable
                  key={template.id}
                  style={({ pressed }) => [styles.templateRow, pressed && { opacity: 0.82 }]}
                  onPress={() => {
                    if (!user?.id) return
                    haptics.light()
                    const config = getTemplateConfig(template.id, user.id)
                    if (!config) return
                    // Inject the template config into the store in-memory if not already present
                    const store = useConfigStore.getState()
                    const existing = store.configs.find((c) => c.id === config.id)
                    if (!existing) {
                      useConfigStore.setState({ configs: [config, ...store.configs] })
                    }
                    store.setActiveConfig(config.id)
                    haptics.medium()
                    router.push(`/config/${config.id}`)
                  }}
                >
                  <View style={styles.templateIcon}>
                    <Icon size={18} color={Colors.primary} weight="duotone" />
                  </View>
                  <View style={styles.templateBody}>
                    <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
                    <Text style={styles.templateDesc} numberOfLines={1}>{template.description}</Text>
                  </View>
                  <ArrowRight size={14} color={Colors.pale} />
                </Pressable>
              )
            })}
          </View>
        </ScrollView>

        {/* ── FAB ─────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
          onPress={handleCreate}
        >
          <Plus size={24} color={Colors.white} weight="bold" />
        </Pressable>

        {/* ── Project Switcher Sheet ───────────────── */}
        <ProjectSwitcherSheet
          visible={switcherOpen}
          onClose={() => setSwitcherOpen(false)}
        />

        {/* ── New Network Name Prompt ──────────────── */}
        <Modal
          visible={namePromptOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setNamePromptOpen(false)}
          statusBarTranslucent
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={namePrompt.overlay}
          >
            <Pressable style={namePrompt.backdrop} onPress={() => setNamePromptOpen(false)} />
            <View style={namePrompt.card}>
              {/* Handle */}
              <View style={namePrompt.handle} />

              <Text style={namePrompt.heading}>Name your network</Text>
              <Text style={namePrompt.sub}>You can always rename it later.</Text>

              <TextInput
                ref={nameInputRef}
                style={namePrompt.input}
                placeholder="e.g. Enterprise Campus LAN"
                placeholderTextColor={Colors.textMuted}
                value={nameInput}
                onChangeText={setNameInput}
                onSubmitEditing={handleConfirmCreate}
                returnKeyType="done"
                autoCapitalize="words"
                maxLength={80}
              />

              <View style={namePrompt.actions}>
                <Pressable
                  style={({ pressed }) => [
                    namePrompt.confirmBtn,
                    (!nameInput.trim() || nameCreating) && namePrompt.confirmBtnDisabled,
                    pressed && { opacity: 0.88 },
                  ]}
                  onPress={handleConfirmCreate}
                  disabled={!nameInput.trim() || nameCreating}
                >
                  <Text style={[
                    namePrompt.confirmText,
                    (!nameInput.trim() || nameCreating) && namePrompt.confirmTextDisabled,
                  ]}>
                    {nameCreating ? 'Creating…' : 'Create Network'}
                  </Text>
                </Pressable>
                <Pressable
                  style={namePrompt.cancelBtn}
                  onPress={() => setNamePromptOpen(false)}
                >
                  <Text style={namePrompt.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: 110 },

  // Switcher trigger in header
  switcherTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  switcherLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.primary,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
    color: Colors.textPrimary,
  },
  sectionLabel: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  seeAll: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
  },

  // Hero card
  heroCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  heroStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  validityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroStatusText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  heroTimestamp: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  heroName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 20,
    color: Colors.textPrimary,
    lineHeight: 26,
  },
  heroMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  heroMetric: {
    flex: 1,
    alignItems: 'center',
  },
  heroMetricValue: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 20,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  heroMetricLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  heroMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  heroCtaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
    flex: 1,
  },

  // Empty state
  emptyCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginTop: 6,
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.white,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.ice,
  },
  quickActionPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIconPrimary: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  quickActionIconLight: {
    backgroundColor: `${Colors.primary}14`,
  },
  quickActionLabel: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  quickActionLabelPrimary: {
    color: 'rgba(255,255,255,0.9)',
  },

  // Recent projects scroll
  recentScroll: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 4,
  },
  recentCard: {
    width: 160,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  recentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentCardName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textPrimary,
    flex: 1,
  },
  recentValidityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  recentCardMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
  },

  // Templates
  templateList: {
    marginHorizontal: 20,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  templateIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.ice,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateBody: {
    flex: 1,
  },
  templateName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  templateDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
})

// ── Name-prompt modal styles ──────────────────────────────────────────────────

const namePrompt = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,26,65,0.45)',
  },
  card: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.10,
        shadowRadius: 18,
      },
      android: { elevation: 20 },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 22,
  },
  heading: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 22,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
    marginBottom: 20,
  },
  actions: {
    gap: 10,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  confirmBtnDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.white,
  },
  confirmTextDisabled: {
    color: Colors.textMuted,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.textMuted,
  },
})
