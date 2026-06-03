import React, { useEffect, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Plus,
  ArrowRight,
  TreeStructure,
  Atom,
  Storefront,
  Buildings,
  Globe,
  HardDrives,
  Broadcast,
  DotsThreeVertical,
  ShieldCheck,
  ArrowsLeftRight,
  Folders,
  ChartPieSlice,
  Info,
  ShareNetwork,
} from 'phosphor-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'
import { useAuthStore } from '@/stores/useAuthStore'
import { useConfigStore } from '@/stores/useConfigStore'
import { MetricTile } from '@/components/ui/MetricTile'
import { ActivityItem } from '@/components/ui/ActivityItem'
import { Colors } from '@/constants/colors'
import { getGreeting, formatRelativeTime, pluralize } from '@/lib/formatters'
import { useHaptics } from '@/hooks/useHaptics'
import { NETWORK_TEMPLATES } from '@/lib/templates'
import { generateFullTopologyConfig } from '@/lib/configGenerator'
import type { NetworkConfig } from '@/types'
import { TopHeader } from '@/components/ui/TopHeader'

// ─── Mini graph thumbnail ────────────────────────────────────────────────────

function MiniGraphThumbnail({ config }: { config: NetworkConfig }) {
  const depts = config.departments
  const visibleDepts = depts.slice(0, 6)
  const remaining = depts.length - 6

  const getDotColor = (type?: string) => {
    switch (type) {
      case 'router':
      case 'firewall':
      case 'wan':
        return Colors.primary
      case 'switch':
        return Colors.medium
      case 'department':
      default:
        return Colors.pale
    }
  }

  return (
    <View style={thumb.container}>
      {visibleDepts.map((d) => (
        <View
          key={d.id}
          style={[thumb.dot, { backgroundColor: getDotColor(d.type) }]}
        />
      ))}
      {remaining > 0 && (
        <Text style={thumb.moreText}>+{remaining}</Text>
      )}
      {depts.length === 0 && (
        <Text style={thumb.emptyText}>Empty</Text>
      )}
    </View>
  )
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function HomeSkeleton() {
  const pulseAnim = React.useRef(new Animated.Value(0.4)).current

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start()
  }, [pulseAnim])

  return (
    <Animated.View style={{ opacity: pulseAnim }}>
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 20 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={{ flex: 1, height: 90, backgroundColor: Colors.border, borderRadius: 16 }} />
        ))}
      </View>
      <View style={{ height: 20, width: 140, backgroundColor: Colors.border, marginHorizontal: 20, marginBottom: 12, borderRadius: 4 }} />
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 24 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={{ width: 160, height: 155, backgroundColor: Colors.border, borderRadius: 16 }} />
        ))}
      </View>
    </Animated.View>
  )
}

// ─── Template icons map ──────────────────────────────────────────────────────

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  Storefront,
  Buildings,
  Globe,
  HardDrives,
  Broadcast,
}

// ─── Template card ───────────────────────────────────────────────────────────

function TemplateCard({ template, onPress }: { template: typeof NETWORK_TEMPLATES[0], onPress: () => void }) {
  const Icon = TEMPLATE_ICONS[template.iconName] || Atom
  return (
    <Pressable
      style={({ pressed }) => [styles.templateCard, pressed && { opacity: 0.82 }]}
      onPress={onPress}
    >
      <View style={styles.templateIconWrapper}>
        <Icon size={22} color={Colors.primary} weight="duotone" />
      </View>
      <View style={styles.templateBody}>
        <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
        <Text style={styles.templateDesc} numberOfLines={1}>{template.description}</Text>
      </View>
      <ArrowRight size={14} color={Colors.pale} />
    </Pressable>
  )
}

// ─── Quick Action Button ─────────────────────────────────────────────────────

function QuickAction({ icon, label, onPress, isPrimary }: { icon: React.ReactNode; label: string; onPress: () => void; isPrimary?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.quickAction, isPrimary && styles.quickActionPrimary, pressed && { opacity: 0.8 }]}
      onPress={onPress}
    >
      <View style={[styles.quickActionIcon, isPrimary ? styles.quickActionIconPrimary : styles.quickActionIconLight]}>{icon}</View>
      <Text style={[styles.quickActionLabel, isPrimary && styles.quickActionLabelPrimary]}>{label}</Text>
    </Pressable>
  )
}

// ─── Template Preview Modal ───────────────────────────────────────────────────
function TemplatePreviewModal({
  template,
  userId,
  visible,
  onClose,
}: {
  template: typeof NETWORK_TEMPLATES[0] | null
  userId: string
  visible: boolean
  onClose: () => void
}) {
  const [sharing, setSharing] = React.useState(false)
  const router = useRouter()

  if (!template) return null

  const handleShare = async () => {
    const { getTemplateConfig } = await import('@/lib/templates')
    const config = getTemplateConfig(template.id, userId)
    if (!config) return
    const isSharingAvailable = await Sharing.isAvailableAsync()
    if (!isSharingAvailable) {
      Alert.alert('Sharing Unavailable', 'File sharing is not supported on this device.')
      return
    }
    setSharing(true)
    let file: InstanceType<typeof File> | null = null
    try {
      const configText = generateFullTopologyConfig(config)
      const filename = `${config.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_cisco_ios.txt`
      file = new File(Paths.cache, filename)
      file.write(configText)
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/plain',
        dialogTitle: `Export ${config.name} — Cisco IOS Config`,
        UTI: 'public.plain-text',
      })
    } catch (err) {
      Alert.alert('Export Failed', 'Could not generate or share the configuration file.')
    } finally {
      if (file && file.exists) {
        try { file.delete() } catch {}
      }
      setSharing(false)
    }
  }

  const handleViewTopology = async () => {
    const { getTemplateConfig } = await import('@/lib/templates')
    const config = getTemplateConfig(template.id, userId)
    if (!config) return
    // Temporarily inject into in-memory store only — no AsyncStorage write
    useConfigStore.setState((state) => ({
      configs: [config, ...state.configs.filter((c) => c.id !== config.id)],
    }))
    useConfigStore.getState().setActiveConfig(config.id)
    onClose()
    router.push(`/config/${config.id}`)
  }

  const Icon = TEMPLATE_ICONS[template.iconName] || Atom

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={previewStyles.safe}>
        {/* Header */}
        <View style={previewStyles.header}>
          <View style={previewStyles.iconWrap}>
            <Icon size={22} color={Colors.primary} weight="duotone" />
          </View>
          <Text style={previewStyles.title} numberOfLines={1}>{template.name}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={previewStyles.closeBtn}>
            <Text style={previewStyles.closeX}>{String.fromCharCode(215)}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={previewStyles.body} showsVerticalScrollIndicator={false}>
          {/* Read-only badge */}
          <View style={previewStyles.readOnlyBadge}>
            <Info size={12} color={Colors.textMuted} />
            <Text style={previewStyles.readOnlyText}>Sample scenario — not saved to your configs</Text>
          </View>

          <Text style={previewStyles.desc}>{template.description}</Text>

          <View style={previewStyles.section}>
            <Text style={previewStyles.sectionLabel}>SCENARIO</Text>
            <Text style={previewStyles.sectionText}>{template.scenario}</Text>
          </View>

          <View style={previewStyles.section}>
            <Text style={previewStyles.sectionLabel}>HIGHLIGHTS</Text>
            {template.highlights.map((h, i) => (
              <View key={i} style={previewStyles.highlightRow}>
                <View style={previewStyles.bullet} />
                <Text style={previewStyles.highlightText}>{h}</Text>
              </View>
            ))}
          </View>

          <View style={previewStyles.section}>
            <Text style={previewStyles.sectionLabel}>TRY THIS</Text>
            <Text style={previewStyles.algorithmTeaser}>{template.algorithmTeaser}</Text>
          </View>
        </ScrollView>

        {/* Footer action */}
        <View style={previewStyles.footer}>
          <Pressable
            style={previewStyles.viewBtn}
            onPress={handleViewTopology}
          >
            <TreeStructure size={18} color={Colors.primary} />
            <Text style={previewStyles.viewBtnText}>View Topology</Text>
          </Pressable>
          <Pressable
            style={[previewStyles.shareBtn, sharing && { opacity: 0.6 }]}
            onPress={handleShare}
            disabled={sharing}
          >
            {sharing
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <>
                  <ShareNetwork size={18} color={Colors.white} />
                  <Text style={previewStyles.shareBtnText}>Share Cisco Config</Text>
                </>
            }
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const previewStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
    backgroundColor: Colors.white,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.ice,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  closeBtn: { padding: 4 },
  closeX: { fontSize: 22, color: Colors.textMuted, lineHeight: 24 },
  body: { padding: 20, gap: 16, paddingBottom: 40 },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.ice,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  readOnlyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  desc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  sectionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary },
  highlightText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  algorithmTeaser: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  footer: {
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: Colors.white,
  },
  viewBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.primary,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  shareBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.white,
  },
})

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter()
  const haptics = useHaptics()
  const user = useAuthStore((s) => s.user)
  const { configs, loadConfigs, loading, createConfig, setActiveConfig } = useConfigStore()
  const [previewTemplate, setPreviewTemplate] = React.useState<typeof NETWORK_TEMPLATES[0] | null>(null)

  useEffect(() => {
    if (user?.id) loadConfigs(user.id)
  }, [user?.id])

  const userConfigs = useMemo(() => configs.filter(c => !c.id.startsWith('local_tpl_')), [configs])

  const totalDepts = useMemo(
    () => userConfigs.reduce((sum, c) => sum + c.departments.length, 0),
    [userConfigs]
  )
  const totalVlans = useMemo(
    () => userConfigs.reduce(
      (sum, c) => sum + c.departments.filter((d) => d.vlanId !== undefined).length,
      0
    ),
    [userConfigs]
  )
  const validConfigs = useMemo(
    () => userConfigs.filter((c) => c.isValid === true).length,
    [userConfigs]
  )

  const recentConfigs = userConfigs.slice(0, 5)
  const activityItems = [...userConfigs]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'
  const greeting = getGreeting()

  return (
    <LinearGradient colors={['#EEF4FF', '#F5F8FF', '#FFFFFF']} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <TopHeader />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Greeting ─────────────────────────────── */}
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>{greeting}, {firstName}</Text>
            <Text style={styles.greetingSub}>
              {userConfigs.length === 0
                ? 'Ready to design your first network?'
                : `You have ${pluralize(userConfigs.length, 'configuration')}.`}
            </Text>
          </View>

          {loading ? (
            <HomeSkeleton />
          ) : (
            <>
              {/* ── Metric Tiles ──────────────────────── */}
              {userConfigs.length > 0 && (
                <View style={styles.metricsRow}>
                  <MetricTile
                    label="Configs"
                    value={userConfigs.length}
                    icon={<Folders size={16} color={Colors.primary} weight="duotone" />}
                  />
                  <MetricTile
                    label="Depts"
                    value={totalDepts}
                    icon={<Buildings size={16} color={Colors.medium} weight="duotone" />}
                  />
                  <MetricTile
                    label="VLANs"
                    value={totalVlans}
                    icon={<ChartPieSlice size={16} color={Colors.soft} weight="duotone" />}
                  />
                </View>
              )}

              {/* ── Quick Actions ─────────────────────── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
              </View>
              <View style={styles.quickActionsRow}>
                <QuickAction
                  isPrimary
                  icon={<Plus size={20} color={Colors.white} weight="bold" />}
                  label="New Config"
                  onPress={async () => {
                    if (!user?.id) return
                    haptics.light()
                    const newConfig = await createConfig('New Network', user.id)
                    if (newConfig) {
                      haptics.medium()
                      setActiveConfig(newConfig.id)
                      router.push(`/config/${newConfig.id}`)
                    } else {
                      haptics.error()
                    }
                  }}
                />
                <QuickAction
                  icon={<Folders size={20} color={Colors.primary} weight="duotone" />}
                  label="My Configs"
                  onPress={() => router.push('/(tabs)/configs')}
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

              {/* ── Recent Configs ────────────────────── */}
              {userConfigs.length === 0 ? (
                <View style={styles.emptyStateCard}>
                  <TreeStructure size={44} color={Colors.primary} weight="duotone" />
                  <Text style={styles.emptyStateTitle}>No configurations yet</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Create your first config or pick a template below to get started.
                  </Text>
                  <Pressable
                    style={styles.emptyStateButton}
                    onPress={() => router.push('/(tabs)/configs')}
                  >
                    <Text style={styles.emptyStateButtonText}>Create your first config</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Configs</Text>
                    <Pressable onPress={() => router.push('/(tabs)/configs')}>
                      <Text style={styles.viewAll}>View All</Text>
                    </Pressable>
                  </View>

                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={recentConfigs}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.configScroll}
                    renderItem={({ item }) => (
                      <Pressable
                        style={({ pressed }) => [styles.configCard, pressed && { opacity: 0.85 }]}
                        onPress={() => router.push(`/config/${item.id}`)}
                      >
                        <View style={styles.cardHeader}>
                          <View style={styles.cardBadge}>
                            <Text style={styles.cardBadgeText} numberOfLines={1}>{item.name}</Text>
                          </View>
                          <DotsThreeVertical size={15} color={Colors.pale} weight="bold" />
                        </View>

                        <View style={styles.cardGraphic}>
                          <MiniGraphThumbnail config={item} />
                        </View>

                        <View style={styles.cardFooter}>
                          <View style={[styles.validityDot, { backgroundColor: item.isValid ? Colors.success : Colors.error }]} />
                          <Text style={styles.configMeta}>
                            {formatRelativeTime(item.updatedAt)}
                          </Text>
                        </View>
                      </Pressable>
                    )}
                  />
                </>
              )}

              {/* ── Activity Feed ─────────────────────── */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
              </View>
              <View style={styles.activityCard}>
                {activityItems.length === 0 ? (
                  <Text style={styles.emptyActivity}>
                    No recent activity. Create a config to get started.
                  </Text>
                ) : (
                  activityItems.map((config, index) => {
                    const icons = [
                      <ShieldCheck size={18} color={Colors.white} weight="fill" />,
                      <ArrowsLeftRight size={18} color={Colors.white} weight="fill" />,
                      <TreeStructure size={18} color={Colors.white} weight="fill" />,
                    ]
                    const desc = [
                      `Validation successful\nConfig ${config.name} passed all safety checks.`,
                      `Updated VLAN mapping\nProduction VLAN range extended.`,
                      `Config updated\n${config.name} was modified.`,
                    ]
                    return (
                      <ActivityItem
                        key={config.id}
                        icon={icons[index % icons.length]}
                        description={desc[index % desc.length]}
                        timestamp={config.updatedAt}
                        showDivider={index < activityItems.length - 1}
                      />
                    )
                  })
                )}
              </View>

              {/* ── Network Scenarios / Templates ──────── */}
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Atom size={14} color={Colors.textMuted} />
                  <Text style={styles.sectionLabel}>NETWORK SCENARIOS</Text>
                </View>
              </View>
              <View style={styles.templateList}>
                {NETWORK_TEMPLATES.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onPress={() => {
                      haptics.light()
                      setPreviewTemplate(template)
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {/* ── FAB ─────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
          onPress={async () => {
            if (!user?.id) return
            haptics.light()
            const newConfig = await createConfig('New Network', user.id)
            if (newConfig) {
              haptics.medium()
              setActiveConfig(newConfig.id)
              router.push(`/config/${newConfig.id}`)
            } else {
              haptics.error()
            }
          }}
        >
          <Plus size={24} color={Colors.white} weight="bold" />
        </Pressable>
        <TemplatePreviewModal
          template={previewTemplate}
          userId={user?.id ?? ''}
          visible={!!previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      </SafeAreaView>
    </LinearGradient>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingBottom: 110 },

  // Greeting
  greetingContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    marginBottom: 24,
  },
  greeting: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 26,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  greetingSub: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
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
  viewAll: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
  },

  // Quick actions
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 28,
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

  // Config cards (horizontal scroll)
  configScroll: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 8,
  },
  configCard: {
    width: 158,
    height: 155,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.ice,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBadge: {
    backgroundColor: `${Colors.primary}14`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    maxWidth: 112,
  },
  cardBadgeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
  },
  cardGraphic: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  validityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  configMeta: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Activity
  activityCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ice,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 8,
  },
  emptyActivity: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    paddingVertical: 16,
    textAlign: 'center',
  },

  // Empty state
  emptyStateCard: {
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.ice,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
    gap: 8,
  },
  emptyStateTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginTop: 12,
  },
  emptyStateSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  emptyStateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyStateButtonText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: Colors.white,
  },

  // Templates
  templateList: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 40,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.ice,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  templateIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: `${Colors.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  templateBody: {
    flex: 1,
    gap: 3,
  },
  templateName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  templateDesc: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // FAB
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
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
})

const thumb = StyleSheet.create({
  container: { flexDirection: 'row', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6 },
  moreText: { fontFamily: 'Outfit_500Medium', fontSize: 11, color: Colors.textMuted },
  emptyText: { fontFamily: 'Outfit_400Regular', fontSize: 11, color: Colors.textMuted },
})
