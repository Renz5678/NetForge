import React, { useEffect, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  Pressable,
  SafeAreaView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Plus, ArrowRight, Folder } from 'phosphor-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { useConfigStore } from '@/stores/useConfigStore'
import { MetricTile } from '@/components/ui/MetricTile'
import { ActivityItem } from '@/components/ui/ActivityItem'
import { Colors } from '@/constants/colors'
import { getGreeting, formatRelativeTime, pluralize } from '@/lib/formatters'
import type { NetworkConfig } from '@/types'

function MiniGraphThumbnail({ config }: { config: NetworkConfig }) {
  const count = config.departments.length
  const bars = Array.from({ length: Math.max(count, 1) }).slice(0, 4)
  const heights = [20, 28, 16, 24]

  return (
    <View style={thumb.container}>
      {bars.map((_, i) => (
        <View
          key={i}
          style={[
            thumb.bar,
            {
              height: heights[i % heights.length],
              backgroundColor: i === 0 ? Colors.primary : (i === 1 ? Colors.medium : Colors.ice),
            },
          ]}
        />
      ))}
    </View>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { configs, loadConfigs } = useConfigStore()

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
            <Text style={styles.logo}>✳ NetForge</Text>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {firstName[0]?.toUpperCase() ?? 'U'}
            </Text>
          </View>
        </View>

        {/* Greeting */}
        <Text style={styles.greeting}>
          {greeting}, {firstName}
        </Text>
        <Text style={styles.greetingSub}>
          {pluralize(configs.length, 'saved configuration')}.
        </Text>

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

        {/* Metric Tiles */}
        <View style={styles.metricsRow}>
          <MetricTile label="Configs" value={configs.length} />
          <MetricTile label="Depts" value={totalDepts} />
          <MetricTile label="VLANs" value={totalVlans} />
        </View>

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
  greeting: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 24,
    color: Colors.textPrimary,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  greetingSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    marginBottom: 20,
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
})

const thumb = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 32,
  },
  bar: {
    width: 16,
    borderRadius: 3,
  },
})
