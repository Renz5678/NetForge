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

import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Plus,
  TreeStructure,
  CaretDown,
  ShieldCheck,
  ArrowRight,
  Buildings,
  ChartPieSlice,
  Atom,
  Storefront,
  Globe,
  HardDrives,
  Broadcast,
  FolderOpen,
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

// ─── Stagger helper ─────────────────────────────────────────────────────

function AnimatedItem({ children, index, style }: { children: React.ReactNode; index: number; style?: object }) {
  const fadeAnim  = React.useRef(new Animated.Value(0)).current
  const slideAnim = React.useRef(new Animated.Value(18)).current

  React.useEffect(() => {
    const delay = index * 60
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 320, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 320, delay, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Animated.View style={[style, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {children}
    </Animated.View>
  )
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

  // Build simple positions in a row+wrap grid for the mini preview
  const COLS = 4
  const CELL = 20
  const positions = visible.map((_, i) => ({
    x: (i % COLS) * CELL + 4,
    y: Math.floor(i / COLS) * CELL + 4,
  }))

  // Draw lines between connected peers (only those visible in the first 8)
  const visibleIds = new Set(visible.map(d => d.id))
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
  visible.forEach((d, i) => {
    d.peers.forEach(peerId => {
      const peerIdx = visible.findIndex(v => v.id === peerId)
      if (peerIdx > i) { // avoid duplicates
        lines.push({
          x1: positions[i].x + 4,
          y1: positions[i].y + 4,
          x2: positions[peerIdx].x + 4,
          y2: positions[peerIdx].y + 4,
        })
      }
    })
  })

  const thumbW = COLS * CELL + 8
  const thumbH = (Math.ceil(visible.length / COLS)) * CELL + 8

  return (
    <View style={[thumb.container, { width: thumbW, height: Math.max(thumbH, 36) }]}>
      {/* Connection lines */}
      {lines.map((l, i) => {
        const dx = l.x2 - l.x1
        const dy = l.y2 - l.y1
        const length = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx) * (180 / Math.PI)
        return (
          <View
            key={`line-${i}`}
            style={[
              thumb.line,
              {
                width: length,
                left: l.x1,
                top: l.y1 - 0.5,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        )
      })}
      {/* Dots */}
      {visible.map((d, i) => (
        <View
          key={d.id}
          style={[
            thumb.dot,
            {
              backgroundColor: getDotColor(d.type),
              left: positions[i].x,
              top: positions[i].y,
            },
          ]}
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
    position: 'relative',
    marginVertical: 4,
  },
  line: {
    position: 'absolute',
    height: 1,
    backgroundColor: Colors.ice,
    transformOrigin: '0 0',
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  more: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    color: Colors.textMuted,
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

  // Pulsing dot for invalid state
  const pulseAnim = React.useRef(new Animated.Value(1)).current
  React.useEffect(() => {
    if (!config.isValid) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.8, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ])
      ).start()
    }
    return () => pulseAnim.stopAnimation()
  }, [config.isValid])

  return (
    <Pressable
      style={({ pressed }) => [styles.heroCard, pressed && { opacity: 0.93, transform: [{ scale: 0.985 }] }]}
      onPress={onPress}
    >
      {/* Status strip */}
      <View style={styles.heroStatus}>
        <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
          {!config.isValid && (
            <Animated.View
              style={[
                styles.validityDot,
                {
                  backgroundColor: Colors.error,
                  position: 'absolute',
                  opacity: 0.35,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
          )}
          <View
            style={[
              styles.validityDot,
              { backgroundColor: config.isValid ? Colors.success : Colors.error },
            ]}
          />
        </View>
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

function EmptyProjectState() {
  return (
    <View style={styles.emptyCard}>
      <TreeStructure size={44} color={Colors.primary} weight="duotone" />
      <Text style={styles.emptyTitle}>No active project</Text>
      <Text style={styles.emptySubtitle}>
        Tap the{' '}
        <Text style={{ fontFamily: 'Inter_700Bold', color: Colors.primary }}>+</Text>
        {' '}in the tab bar to create a topology, or pick a template below.
      </Text>
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

// ─── Loading Skeleton ───────────────────────────────────────────────────

function SkeletonBlock({ style }: { style?: object }) {
  return <View style={[{ backgroundColor: Colors.border, borderRadius: 6 }, style]} />
}

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
    <Animated.View style={{ opacity: pulse, gap: 12 }}>
      {/* Hero card skeleton */}
      <View style={[styles.heroCard, { minHeight: 220, gap: 12 }]}>
        <SkeletonBlock style={{ height: 16, width: '40%' }} />
        <SkeletonBlock style={{ height: 24, width: '70%' }} />
        <SkeletonBlock style={{ height: 48, borderRadius: 10 }} />
        <SkeletonBlock style={{ height: 52, borderRadius: 12 }} />
      </View>
      {/* Quick actions skeleton */}
      <View style={[styles.quickActionsRow, { gap: 10 }]}>
        {[1, 2, 3].map(i => (
          <SkeletonBlock key={i} style={{ flex: 1, height: 80, borderRadius: 14 }} />
        ))}
      </View>
      {/* Templates skeleton */}
      <View style={[styles.templateList, { gap: 0 }]}>
        {[1, 2, 3].map(i => (
          <SkeletonBlock key={i} style={{ height: 52, borderRadius: 0, marginBottom: 1 }} />
        ))}
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
  const setCreateModalOpen = useConfigStore((s) => s.setCreateModalOpen)
  const loading        = useConfigStore((s) => s.loading)
  const loadConfigs    = useConfigStore((s) => s.loadConfigs)
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

  // Open the name prompt globally
  const handleCreate = () => {
    setCreateModalOpen(true)
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
            <EmptyProjectState />
          )}

          {/* ── Quick Actions ──────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.quickActionsRow}>
            <QuickAction
              icon={<ShieldCheck size={20} color={Colors.primary} weight="duotone" />}
              label="Validate"
              onPress={() => router.push('/(tabs)/validate')}
            />
            <QuickAction
              isPrimary
              icon={<FolderOpen size={20} color={Colors.white} weight="bold" />}
              label="Projects"
              onPress={() => setSwitcherOpen(true)}
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
                renderItem={({ item, index }) => (
                  <AnimatedItem index={index}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.recentCard,
                        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                      ]}
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
                  </AnimatedItem>
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
            {NETWORK_TEMPLATES.map((template, tplIndex) => {
              const Icon = TEMPLATE_ICONS[template.iconName] || Atom
              return (
                <AnimatedItem key={template.id} index={tplIndex}>
                  <Pressable
                    style={({ pressed }) => [styles.templateRow, pressed && { opacity: 0.82, transform: [{ scale: 0.988 }] }]}
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
                </AnimatedItem>
              )
            })}
          </View>
        </ScrollView>


        {/* ── Project Switcher Sheet ───────────────── */}
        <ProjectSwitcherSheet
          visible={switcherOpen}
          onClose={() => setSwitcherOpen(false)}
        />

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


