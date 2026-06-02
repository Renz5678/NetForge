import React, { useEffect, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  Pressable,
  PixelRatio,
  Animated
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Plus, ArrowRight, Folder, TreeStructure, Atom } from 'phosphor-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { useConfigStore } from '@/stores/useConfigStore'
import { MetricTile } from '@/components/ui/MetricTile'
import { ActivityItem } from '@/components/ui/ActivityItem'
import { Colors } from '@/constants/colors'
import { getGreeting, formatRelativeTime, pluralize } from '@/lib/formatters'
import { NETWORK_TEMPLATES } from '@/lib/templates'
import type { NetworkConfig } from '@/types'
import { NetForgeLogo } from '@/components/ui/NetForgeLogo'

function MiniGraphThumbnail({ config }: { config: NetworkConfig }) {
  const depts = config.departments
  const visibleDepts = depts.slice(0, 5)
  const remaining = depts.length - 5

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
          style={[
            thumb.dot,
            { backgroundColor: getDotColor(d.type) }
          ]}
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

function HomeSkeleton() {
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
    <Animated.View style={[styles.container, cardStyle]}>
      {/* Skeleton Recent Configs Label */}
      <View style={{ height: 20, width: 120, backgroundColor: Colors.border, marginHorizontal: 16, marginVertical: 12, borderRadius: 4 }} />
      {/* Skeleton Config Scroll */}
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 20 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={{ width: 160, height: 120, backgroundColor: Colors.border, borderRadius: 14 }} />
        ))}
      </View>
      {/* Skeleton Metrics Row */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 20 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} style={{ flex: 1, height: 80, backgroundColor: Colors.border, borderRadius: 12 }} />
        ))}
      </View>
    </Animated.View>
  )
}

// Template scenario card
function TemplateCard({ template, onPress }: { template: typeof NETWORK_TEMPLATES[0], onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.templateCard, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <Text style={styles.templateEmoji}>{template.emoji}</Text>
      <View style={styles.templateBody}>
        <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
        <Text style={styles.templateDesc} numberOfLines={2}>{template.description}</Text>
        <Text style={styles.templateTeaser} numberOfLines={2}>{template.algorithmTeaser}</Text>
      </View>
      <ArrowRight size={14} color={Colors.primary} />
    </Pressable>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { configs, loadConfigs, loading, createConfig, setActiveConfig } = useConfigStore()

  useEffect(() => {
    if (user?.id) loadConfigs(user.id)
  }, [user?.id])

  const totalDepts = useMemo(
    () => configs.reduce((sum, c) => sum + c.departments.length, 0),
    [configs]
  )
  const totalVlans = useMemo(
    () =>
      configs.reduce(
        (sum, c) => sum + c.departments.filter((d) => d.vlanId !== undefined).length,
        0
      ),
    [configs]
  )

  const recentConfigs = configs.slice(0, 5)
  const activityItems = [...recentConfigs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 5)

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'
  const greeting = getGreeting()

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <NetForgeLogo size={20} />
            <Text style={styles.logo}>NetForge</Text>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {firstName[0]?.toUpperCase() ?? 'U'}
            </Text>
          </View>
        </View>

        {/* Greeting with Border Divider */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greeting}>
            {greeting}, {firstName}
          </Text>
          <Text style={styles.greetingSub}>
            {pluralize(configs.length, 'saved configuration')}.
          </Text>
        </View>

        {loading ? (
          <HomeSkeleton />
        ) : (
          <>
            {/* Recent Configs */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>RECENT CONFIGS</Text>
              <Pressable onPress={() => router.push('/(tabs)/configs')}>
                <Text style={styles.viewAll}>View All</Text>
              </Pressable>
            </View>

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[...recentConfigs, { id: '__add__', name: '' } as NetworkConfig]}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.configScroll}
              renderItem={({ item }) => {
                if (item.id === '__add__') {
                  return (
                    <Pressable
                      style={[styles.configCard, styles.addCard]}
                      onPress={() => router.push('/(tabs)/configs')}
                    >
                      <Text style={styles.addIcon}>+</Text>
                    </Pressable>
                  )
                }
                return (
                  <Pressable
                    style={styles.configCard}
                    onPress={() => router.push(`/config/${item.id}`)}
                  >
                    <Text style={styles.configName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.configMeta}>Last edited {formatRelativeTime(item.updatedAt)}</Text>
                    <MiniGraphThumbnail config={item} />
                  </Pressable>
                )
              }}
            />

            {/* Network Scenarios */}
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
                  onPress={async () => {
                    if (!user?.id) return
                    const { getTemplateConfig } = await import('@/lib/templates')
                    const config = getTemplateConfig(template.id, user.id)
                    if (!config) return

                    // Upsert directly into the store: updateConfig only updates existing entries,
                    // so we must inject templates manually into the configs array if not present.
                    const store = useConfigStore.getState()
                    const existing = store.configs.find((c) => c.id === config.id)
                    if (!existing) {
                      // Directly insert into store + persist locally (templates never sync to Supabase)
                      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
                      const LOCAL_KEY = `@netforge_configs_${user.id}`
                      useConfigStore.setState((state) => {
                        const updated = [config, ...state.configs]
                        AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(updated)).catch(console.error)
                        return { configs: updated }
                      })
                    }
                    // Now setActiveConfig will find it in the array
                    useConfigStore.getState().setActiveConfig(config.id)
                    router.push(`/config/${config.id}`)
                  }}
                />
              ))}
            </View>

            {/* Metric Tiles or illustrated Empty State */}
            {configs.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <TreeStructure size={48} color={Colors.primary} weight="duotone" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyStateTitle}>No configurations yet</Text>
                <Text style={styles.emptyStateSubtitle}>Create your first config to get started.</Text>
                <Pressable
                  style={styles.emptyStateButton}
                  onPress={() => router.push('/(tabs)/configs')}
                >
                  <Text style={styles.emptyStateButtonText}>Create your first config</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.metricsRow}>
                <MetricTile label="Configs" value={configs.length} />
                <MetricTile label="Depts" value={totalDepts} />
                <MetricTile label="VLANs" value={totalVlans} />
              </View>
            )}

            {/* Activity Feed */}
            <View style={styles.activityCard}>
              <Text style={styles.activityTitle}>Recent Activity</Text>
              {activityItems.length === 0 ? (
                <Text style={styles.emptyActivity}>No recent activity. Create a config to get started.</Text>
              ) : (
                activityItems.map((config, index) => (
                  <ActivityItem
                    key={config.id}
                    icon={<Folder size={18} color={Colors.primary} weight="duotone" />}
                    description={`Updated config "${config.name}"`}
                    timestamp={config.updatedAt}
                    showDivider={index > 0}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surfaceAlt },
  container: { flex: 1 },
  content: { paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.primary,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.white,
  },
  greetingContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 24,
    borderBottomWidth: 1 / PixelRatio.get(),
    borderBottomColor: Colors.border,
    paddingBottom: 16,
  },
  greeting: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    color: Colors.textPrimary,
  },
  greetingSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  viewAll: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.primary,
  },
  configScroll: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
  configCard: {
    width: 160,
    height: 120,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    justifyContent: 'space-between',
  },
  addCard: {
    backgroundColor: Colors.ice,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 28,
    color: Colors.primary,
  },
  configName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  configMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
  },
  activityCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.ice,
    borderRadius: 14,
    padding: 16,
  },
  activityTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  emptyActivity: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    paddingVertical: 16,
    textAlign: 'center',
  },
  emptyStateCard: {
    marginHorizontal: 16,
    marginVertical: 20,
    padding: 24,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  templateList: {
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  templateEmoji: {
    fontSize: 26,
    width: 38,
    textAlign: 'center',
  },
  templateBody: {
    flex: 1,
    gap: 2,
  },
  templateName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  templateDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  templateTeaser: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.primary,
    marginTop: 4,
    lineHeight: 15,
  },
  emptyStateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.white,
  },
})

const thumb = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 24,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  moreText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: Colors.textMuted,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
})
