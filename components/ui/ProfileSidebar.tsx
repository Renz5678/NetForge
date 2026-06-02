/**
 * ProfileSidebar.tsx
 *
 * Slide-in panel from the right, triggered by the avatar in TopHeader.
 *
 * Guest users (email ends in .local or .guest) see a reduced view:
 *  - "Guest Mode" badge displayed
 *  - "Change password" and "Edit profile" are hidden
 *  - A "Sign in" CTA replaces account-destructive actions
 *
 * Authenticated users have full access to all settings and actions.
 */

import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  PanResponder,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import { useRouter } from 'expo-router'
import {
  DownloadSimple,
  UploadSimple,
  Trash,
  Key,
  SignOut,
  UserCircle,
  Warning,
  CaretRight,
} from 'phosphor-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { useConfigStore } from '@/stores/useConfigStore'
import { usePreferencesStore } from '@/stores/usePreferencesStore'
import { supabase } from '@/lib/supabase'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Colors } from '@/constants/colors'
import { getInitials } from '@/lib/formatters'
import type { NetworkConfig } from '@/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

/** Returns true when the current session is a local/offline guest account. */
function isGuestUser(email: string | undefined): boolean {
  if (!email) return false
  return email.endsWith('.local') || email.endsWith('.guest') || email === 'guest@netforge.com'
}

type ProfileSidebarProps = {
  visible: boolean
  onClose: () => void
}

export function ProfileSidebar({ visible, onClose }: ProfileSidebarProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const { activeConfig, loadConfigs, createConfig, updateConfig } = useConfigStore()

  const [showClearSheet, setShowClearSheet] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [showDefaultsSheet, setShowDefaultsSheet] = useState(false)

  const {
    notifications,
    defaultBaseIp,
    defaultVlanStart,
    setNotifications,
    setDefaultBaseIp,
    setDefaultVlanStart,
  } = usePreferencesStore()

  const [tempBaseIp, setTempBaseIp] = useState(defaultBaseIp)
  const [tempVlanStart, setTempVlanStart] = useState(defaultVlanStart)

  const translateX = React.useRef(new Animated.Value(SCREEN_WIDTH)).current
  const opacity = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: SCREEN_WIDTH,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible, translateX, opacity])

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          translateX.setValue(gestureState.dx)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 80 || gestureState.vx > 0.5) {
          Animated.parallel([
            Animated.timing(translateX, { toValue: SCREEN_WIDTH, duration: 200, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => onClose())
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }).start()
        }
      },
    })
  ).current

  const fullName = user?.user_metadata?.full_name ?? 'User'
  const email = user?.email ?? ''
  const initials = getInitials(fullName)
  const isGuest = isGuestUser(email)

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    onClose()
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
        // Fallback: share as plain text message
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
    onClose()
  }

  const handlePasswordReset = async () => {
    if (!email) return
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      Alert.alert('Error', 'Could not send password reset email: ' + error.message)
    } else {
      Alert.alert(
        'Email Sent',
        `A password reset link has been sent to ${email}. Check your inbox.`
      )
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

  // ─── Reusable row component ──────────────────────────────────────────────────

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
      {rightElement ?? <CaretRight size={16} color={Colors.pale} />}
    </Pressable>
  )

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        {/* Dimmed backdrop — tap to close */}
        <Animated.View style={[styles.backdrop, { opacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Slide-in panel */}
        <Animated.View
          style={[
            styles.sidebar,
            { transform: [{ translateX }] },
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Account</Text>
            {/* Drag handle */}
            <View style={styles.handleBar} />
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

            {/* ── Profile card ─────────────────────────────────────── */}
            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Text style={styles.name}>{fullName}</Text>
              <Text style={styles.email}>{email}</Text>

              {/* Guest badge */}
              {isGuest && (
                <View style={styles.guestBadge}>
                  <Warning size={13} color={Colors.warning} weight="fill" />
                  <Text style={styles.guestBadgeText}>Guest Mode — data is local only</Text>
                </View>
              )}

              {/* Edit profile — only for authenticated users */}
              {!isGuest && (
                <Pressable
                  style={styles.editProfileBtn}
                  onPress={() =>
                    Alert.alert(
                      'Edit Profile',
                      'Profile editing is coming in a future update. You can change your password from the Account section below.'
                    )
                  }
                >
                  <Text style={styles.editProfileText}>Edit profile</Text>
                </Pressable>
              )}

              {/* Sign-in CTA for guests */}
              {isGuest && (
                <Pressable
                  style={styles.signInCta}
                  onPress={() => {
                    onClose()
                    router.replace('/(auth)/signup')
                  }}
                >
                  <UserCircle size={16} color={Colors.white} weight="fill" />
                  <Text style={styles.signInCtaText}>Create account to sync data</Text>
                </Pressable>
              )}
            </View>

            {/* ── GENERAL ──────────────────────────────────────────── */}
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

            {/* ── DATA ─────────────────────────────────────────────── */}
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

            {/* ── ACCOUNT ──────────────────────────────────────────── */}
            <Text style={styles.sectionLabel}>ACCOUNT</Text>
            <View style={styles.settingGroup}>
              {/* Change password — hidden for guests (they have no password) */}
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
        </Animated.View>
      </KeyboardAvoidingView>

      {/* ── Clear all confirmation sheet ─────────────────────────────── */}
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
          <Button
            label="Delete all"
            variant="destructive"
            fullWidth
            loading={clearing}
            onPress={handleClearAll}
          />
          <Button
            label="Cancel"
            variant="ghost"
            fullWidth
            onPress={() => setShowClearSheet(false)}
          />
        </View>
      </BottomSheet>

      {/* ── Default network settings sheet ───────────────────────────── */}
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
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 26, 65, 0.45)',
  },
  sidebar: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 400,
    backgroundColor: Colors.surfaceAlt,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 20 },
    }),
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.textPrimary,
  },
  handleBar: {
    width: 4,
    height: 32,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 8,
  },

  // ── Profile section ──────────────────────────────────────────────────────
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
    marginBottom: 4,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 3,
    borderColor: Colors.ice,
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: Colors.white,
  },
  name: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
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
  editProfileBtn: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editProfileText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.primary,
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

  // ── Section labels ───────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 6,
  },

  // ── Setting groups ───────────────────────────────────────────────────────
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
    fontSize: 15,
    color: Colors.textPrimary,
  },
  settingValue: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },

  // ── Bottom sheet content ─────────────────────────────────────────────────
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
