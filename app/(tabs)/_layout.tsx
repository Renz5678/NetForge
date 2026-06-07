import React from 'react'
import { Tabs } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { TreeStructure, ShieldCheck, Export, ChartPieSlice } from 'phosphor-react-native'
import { Colors } from '@/constants/colors'
import { useConfigStore } from '@/stores/useConfigStore'

function TabIconWithBadge({
  icon,
  showBadge,
}: {
  icon: React.ReactNode
  showBadge: boolean
}) {
  return (
    <View style={styles.badgeWrap}>
      {icon}
      {showBadge && <View style={styles.dot} />}
    </View>
  )
}

export default function TabsLayout() {
  const hasActiveConfig = useConfigStore((s) => !!s.activeConfig)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarShowLabel: true,
      }}
    >
      {/* ── Tab 1: Canvas ─────────────────────────────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Canvas',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.indicator} />}
              <TreeStructure size={22} color={color as string} weight={focused ? 'fill' : 'regular'} />
            </View>
          ),
        }}
      />

      {/* ── Tab 2: Validate ───────────────────────────────────────────────── */}
      <Tabs.Screen
        name="validate"
        options={{
          title: 'Validate',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.indicator} />}
              <TabIconWithBadge
                showBadge={!hasActiveConfig}
                icon={<ShieldCheck size={22} color={color as string} weight={focused ? 'fill' : 'regular'} />}
              />
            </View>
          ),
        }}
      />

      {/* ── Tab 3: Subnet ─────────────────────────────────────────────────── */}
      <Tabs.Screen
        name="subnet"
        options={{
          title: 'Subnet',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.indicator} />}
              <ChartPieSlice size={22} color={color as string} weight={focused ? 'fill' : 'regular'} />
            </View>
          ),
        }}
      />

      {/* ── Tab 4: Export ─────────────────────────────────────────────────── */}
      <Tabs.Screen
        name="export"
        options={{
          title: 'Export',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.indicator} />}
              <TabIconWithBadge
                showBadge={!hasActiveConfig}
                icon={<Export size={22} color={color as string} weight={focused ? 'fill' : 'regular'} />}
              />
            </View>
          ),
        }}
      />

      {/*
       * The "configs" and "profile" routes are hidden from the tab bar.
       * Configs management is accessed via the ProjectSwitcherSheet in the Canvas header.
       * Profile settings are accessed via the avatar icon in TopHeader → ProfileSidebar.
       */}
      <Tabs.Screen name="configs" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 4,
    height: 62,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginBottom: 2,
  },
  iconWrap: {
    alignItems: 'center',
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: -8,
    left: -6,
    right: -6,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
  badgeWrap: {
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
})
