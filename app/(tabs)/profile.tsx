/**
 * app/(tabs)/profile.tsx
 *
 * This screen is no longer shown as a bottom tab — the profile route is hidden
 * via href: null in _layout.tsx.  It is kept as a valid Expo Router route so
 * that any deep-link or legacy navigation that lands on "/(tabs)/profile" does
 * not 404, and instead shows the same settings content as the sidebar.
 *
 * All settings here mirror ProfileSidebar exactly so users who reach this
 * screen through any route still get a fully functional experience.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import { useRouter } from 'expo-router'
import { DownloadSimple, UploadSimple, Trash, Key, SignOut, Warning, UserCircle } from 'phosphor-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { useConfigStore } from '@/stores/useConfigStore'
import { usePreferencesStore } from '@/stores/usePreferencesStore'
import { supabase } from '@/lib/supabase'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Colors } from '@/constants/colors'
import { getInitials } from '@/lib/formatters'
import { TopHeader } from '@/components/ui/TopHeader'
import type { NetworkConfig } from '@/types'

/** Returns true when the current session is a local/offline guest account. */
function isGuestUser(email: string | undefined): boolean {
  if (!email) return false
  return email.endsWith('.local') || email.endsWith('.guest') || email === 'guest@netforge.com'
}

export default function ProfileScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  // useConfigStore: always use granular selectors — never destructure the whole store.
  // See AGENTS.md §6 for rationale.
  const activeConfig = useConfigStore((s) => s.activeConfig)
  const loadConfigs  = useConfigStore((s) => s.loadConfigs)
  const createConfig = useConfigStore((s) => s.createConfig)
  const updateConfig = useConfigStore((s) => s.updateConfig)

  const {
    notifications,
    defaultBaseIp,
    defaultVlanStart,
    setNotifications,
    setDefaultBaseIp,
    setDefaultVlanStart,
  } = usePreferencesStore()

  const [showClearSheet, setShowClearSheet] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [showDefaultsSheet, setShowDefaultsSheet] = useState(false)
  const [tempBaseIp, setTempBaseIp] = useState(defaultBaseIp)
  const [tempVlanStart, setTempVlanStart] = useState(defaultVlanStart)

  const fullName = user?.user_metadata?.full_name ?? 'User'
  const email = user?.email ?? ''
  const initials = getInitials(fullName)
  const isGuest = isGuestUser(email)

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    router.replace('/(onboarding)')
  }

  const handleExportJson = async () => {
    if (!activeConfig) {
      Alert.alert(
        'No Active Config',
        'Open a configuration from the Configs tab first, then return here to export it.'
      )
      return
    }
    const json = JSON.stringify(activeConfig, null, 2)
    const available = await Sharing.isAvailableAsync()
    if (available) {
      try {
        await Sharing.shareAsync(
          `data:application/json;base64,${btoa(unescape(encodeURIComponent(json)))}`,
          { mimeType: 'application/json', dialogTitle: `${activeConfig.name}.json` }
        )
      } catch {
        const { Share } = require('react-native')
        await Share.share({ title: `${activeConfig.name}.json`, message: json })
      }
    } else {
      Alert.alert('Sharing Not Available', 'Your device does not support file sharing.')
    }
  }

  const handleImportJson = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      })
      if (result.canceled) return

      const file = result.assets[0]
      const response = await fetch(file.uri)
      const text = await response.text()
      const parsed = JSON.parse(text) as Partial<NetworkConfig>

      if (!parsed.name || !parsed.departments) {
        Alert.alert('Invalid File', 'The selected file does not appear to be a valid NetForge configuration.')
        return
      }
      if (!user?.id) return

      const newConfig = await createConfig(parsed.name, user.id, parsed.baseIp, parsed.vlanStart)
      if (newConfig && parsed.departments) {
        await updateConfig({
          ...newConfig,
          departments: parsed.departments,
          baseIp: parsed.baseIp ?? newConfig.baseIp,
          vlanStart: parsed.vlanStart ?? newConfig.vlanStart,
        })
      }
      Alert.alert('Import Successful', `"${parsed.name}" has been added to your configurations.`)
    } catch (err) {
      console.error('Import error:', err)
      Alert.alert('Import Failed', 'Could not read the selected file. Make sure it is a valid NetForge JSON export.')
    }
  }

  const handleClearAll = async () => {
    if (!user?.id) return
    setClearing(true)
    try {
      await supabase.from('network_configs').delete().eq('user_id', user.id)
      await loadConfigs(user.id)
    } catch (err) {
      console.error('Clear error:', err)
      Alert.alert('Error', 'Could not clear configurations. Please try again.')
    }
    setClearing(false)
    setShowClearSheet(false)
  }

  const handlePasswordReset = async () => {
    if (!email) return
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      Alert.alert('Error', 'Could not send password reset email: ' + error.message)
    } else {
      Alert.alert('Email Sent', `A password reset link has been sent to ${email}. Check your inbox.`)
    }
  }

  const handleSaveDefaults = () => {
    const ipValid = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(tempBaseIp)
    if (!ipValid) {
      Alert.alert('Invalid IP', 'Please enter a valid IPv4 address (e.g. 10.0.0.0).')
      return
    }
    const vlanNum = parseInt(tempVlanStart, 10)
    if (isNaN(vlanNum) || vlanNum < 1 || vlanNum > 4094) {
      Alert.alert('Invalid VLAN', 'VLAN ID must be a number between 1 and 4094.')
      return
    }
    setDefaultBaseIp(tempBaseIp)
    setDefaultVlanStart(tempVlanStart)
    setShowDefaultsSheet(false)
    Alert.alert('Saved', 'Default network settings have been updated.')
  }

  // ─── Reusable row component ─────────────────────────────────────────────────

  const SettingRow = ({
    label,
    onPress,
    rightElement,
    labelColor,
  }: {
    label: string
    onPress?: () => void
    rightElement?: React.ReactNode
    labelColor?: string
  }) => (
    <Pressable
      style={({ pressed }) => [styles.settingRow, pressed && { backgroundColor: Colors.surfaceAlt }]}
      onPress={onPress}
    >
      <Text style={[styles.settingLabel, labelColor ? { color: labelColor } : null]}>
        {label}
      </Text>
      {rightElement ?? null}
    </Pressable>
  )

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <TopHeader title="Account" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Profile header ─────────────────────────────────────── */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.email}>{email}</Text>

          {isGuest && (
            <View style={styles.guestBadge}>
              <Warning size={13} color={Colors.warning} weight="fill" />
              <Text style={styles.guestBadgeText}>Guest Mode — data is local only</Text>
            </View>
          )}

          {!isGuest && (
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Edit Profile',
                  'Profile editing is coming in a future update. You can change your password from the Account section below.'
                )
              }
            >
              <Text style={styles.editLink}>Edit profile</Text>
            </Pressable>
          )}

          {isGuest && (
            <Pressable
              style={styles.signInCta}
              onPress={() => router.replace('/(auth)/signup')}
            >
              <UserCircle size={16} color={Colors.white} weight="fill" />
              <Text style={styles.signInCtaText}>Create account to sync data</Text>
            </Pressable>
          )}
        </View>

        {/* ── GENERAL ───────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>GENERAL</Text>
        <View style={styles.settingGroup}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Notifications</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: Colors.pale, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
          <View style={styles.divider} />
          <SettingRow
            label="Default IP range"
            onPress={() => {
              setTempBaseIp(defaultBaseIp)
              setTempVlanStart(defaultVlanStart)
              setShowDefaultsSheet(true)
            }}
            rightElement={<Text style={styles.settingValue}>{defaultBaseIp} ›</Text>}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Default VLAN ID"
            onPress={() => {
              setTempBaseIp(defaultBaseIp)
              setTempVlanStart(defaultVlanStart)
              setShowDefaultsSheet(true)
            }}
            rightElement={<Text style={styles.settingValue}>{defaultVlanStart} ›</Text>}
          />
        </View>

        {/* ── DATA ──────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>DATA</Text>
        <View style={styles.settingGroup}>
          <SettingRow
            label="Export active config"
            onPress={handleExportJson}
            rightElement={<DownloadSimple size={20} color={Colors.textSecondary} />}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Import config from file"
            onPress={handleImportJson}
            rightElement={<UploadSimple size={20} color={Colors.textSecondary} />}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Clear all configs"
            onPress={() => setShowClearSheet(true)}
            labelColor={Colors.error}
            rightElement={<Trash size={20} color={Colors.error} />}
          />
        </View>

        {/* ── ACCOUNT ───────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.settingGroup}>
          {!isGuest && (
            <>
              <SettingRow
                label="Change password"
                onPress={handlePasswordReset}
                rightElement={<Key size={20} color={Colors.textSecondary} />}
              />
              <View style={styles.divider} />
            </>
          )}
          <SettingRow
            label={signingOut ? 'Signing out…' : isGuest ? 'Exit guest mode' : 'Log out'}
            onPress={handleSignOut}
            labelColor={Colors.error}
            rightElement={<SignOut size={20} color={Colors.error} />}
          />
        </View>

      </ScrollView>

      {/* ── Clear all sheet ──────────────────────────────────────── */}
      <BottomSheet
        visible={showClearSheet}
        onClose={() => setShowClearSheet(false)}
        snapHeight={240}
      >
        <Text style={styles.sheetTitle}>Clear all configurations?</Text>
        <Text style={styles.sheetSubtitle}>
          This will permanently delete all your saved configurations. This cannot be undone.
        </Text>
        <View style={styles.sheetButtons}>
          <Button label="Delete all" variant="destructive" fullWidth loading={clearing} onPress={handleClearAll} />
          <Button label="Cancel" variant="ghost" fullWidth onPress={() => setShowClearSheet(false)} />
        </View>
      </BottomSheet>

      {/* ── Default network settings sheet ───────────────────────── */}
      <BottomSheet
        visible={showDefaultsSheet}
        onClose={() => setShowDefaultsSheet(false)}
        snapHeight={340}
      >
        <Text style={styles.sheetTitle}>Default Network Settings</Text>
        <Text style={[styles.sheetSubtitle, { marginBottom: 16 }]}>
          Applied automatically when creating a new configuration.
        </Text>
        <Text style={styles.inputLabel}>Base IP Address</Text>
        <Input
          placeholder="e.g. 10.0.0.0"
          value={tempBaseIp}
          onChangeText={setTempBaseIp}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />
        <View style={{ height: 16 }} />
        <Text style={styles.inputLabel}>Starting VLAN ID</Text>
        <Input
          placeholder="e.g. 10"
          value={tempVlanStart}
          onChangeText={setTempVlanStart}
          keyboardType="numeric"
        />
        <View style={{ height: 24 }} />
        <View style={styles.sheetButtons}>
          <Button label="Save Defaults" variant="primary" fullWidth onPress={handleSaveDefaults} />
          <Button label="Cancel" variant="ghost" fullWidth onPress={() => setShowDefaultsSheet(false)} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surfaceAlt },

  content: { padding: 16, paddingBottom: 48, gap: 0 },

  // ── Profile section ────────────────────────────────────────────────────────
  profileSection: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: Colors.ice,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    color: Colors.white,
  },
  name: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: Colors.textPrimary,
  },
  email: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: Colors.warningContainer,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  guestBadgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.warning,
  },
  editLink: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.primary,
    marginTop: 6,
  },
  signInCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  signInCtaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.white,
  },

  // ── Section labels ─────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },

  // ── Setting groups ─────────────────────────────────────────────────────────
  settingGroup: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  settingLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  settingValue: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
  },
  divider: {
    height: 0.5,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },

  // ── Bottom sheet ───────────────────────────────────────────────────────────
  sheetTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  sheetSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  sheetButtons: { gap: 8 },
  inputLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
})
