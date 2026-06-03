import React from 'react'
import { Tabs } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { House, Folders, ShieldCheck, Export, ChartPieSlice } from 'phosphor-react-native'
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
  const configsCount = useConfigStore((s) => s.configs.length)
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.indicator} />}
              <House size={22} color={color as string} weight={focused ? 'fill' : 'regular'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="configs"
        options={{
          title: 'Configs',
          tabBarBadge: configsCount > 0 ? configsCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.primary,
            color: Colors.white,
            fontSize: 10,
            lineHeight: 14,
          },
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.indicator} />}
              <Folders size={22} color={color as string} weight={focused ? 'fill' : 'regular'} />
            </View>
          ),
        }}
      />
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
       * The "profile" route is hidden from the tab bar.
       * Profile settings are accessed via the avatar icon in TopHeader → ProfileSidebar.
       * We keep href: null so Expo Router doesn't render it as a tab.
       */}
      <Tabs.Screen
        name="profile"
        options={{ href: null }}
      />
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
  // Wrapper around each tab icon so the active indicator is positioned relative to it
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
  // Wrapper used by TabIconWithBadge to anchor the dot
  badgeWrap: {
    position: 'relative',
  },
  // Amber dot shown on Validate / Export when no config is active
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
