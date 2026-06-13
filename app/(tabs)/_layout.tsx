import React, { useState, useRef } from 'react'
import { Tabs } from 'expo-router'
import { StyleSheet, View, Modal, KeyboardAvoidingView, Platform, Text, TextInput, Pressable } from 'react-native'
import { TreeStructure, ShieldCheck, Export, ChartPieSlice, Plus } from 'phosphor-react-native'
import { Colors } from '@/constants/colors'
import { useConfigStore } from '@/stores/useConfigStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useHaptics } from '@/hooks/useHaptics'
import { useRouter } from 'expo-router'

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
  const isCreateModalOpen = useConfigStore((s) => s.isCreateModalOpen)
  const setCreateModalOpen = useConfigStore((s) => s.setCreateModalOpen)
  const createConfig = useConfigStore((s) => s.createConfig)
  const setActiveConfig = useConfigStore((s) => s.setActiveConfig)
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const haptics = useHaptics()

  const [nameInput, setNameInput] = useState('')
  const [nameCreating, setNameCreating] = useState(false)
  const nameInputRef = useRef<TextInput>(null)

  const handleOpenCreateModal = () => {
    setNameInput('')
    setCreateModalOpen(true)
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
    setCreateModalOpen(false)
    if (newConfig) {
      haptics.medium()
      setActiveConfig(newConfig.id)
      router.push(`/config/${newConfig.id}`)
    } else {
      haptics.error()
    }
  }

  return (
    <View style={{ flex: 1 }}>
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

        {/* ── Tab 3: Create (FAB) ───────────────────────────────────────────── */}
        <Tabs.Screen
          name="create_action"
          options={{
            title: '',
            tabBarButton: (props) => {
              const { ref, children, style, ...rest } = props as any
              return (
                <Pressable
                  {...rest}
                  style={[style, { justifyContent: 'center', alignItems: 'center', paddingTop: 0 }]}
                  onPress={handleOpenCreateModal}
                >
                  <View style={styles.fabWrap}>
                    <Plus size={24} color={Colors.white} weight="bold" />
                  </View>
                </Pressable>
              )
            },
          }}
        />

        {/* ── Tab 4: Subnet ─────────────────────────────────────────────────── */}
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

        {/* ── Tab 5: Export ─────────────────────────────────────────────────── */}
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

      {/* ── New Network Name Prompt ──────────────── */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalOpen(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={namePrompt.overlay}
        >
          <Pressable style={namePrompt.backdrop} onPress={() => setCreateModalOpen(false)} />
          <View style={namePrompt.card}>
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
                style={({ pressed }) => [namePrompt.cancelBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setCreateModalOpen(false)}
                disabled={nameCreating}
              >
                <Text style={namePrompt.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
  fabWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

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
