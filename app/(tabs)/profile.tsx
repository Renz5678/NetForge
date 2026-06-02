import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  Switch,
  TextInput,
  Share,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import { useRouter } from 'expo-router'
import { DownloadSimple, UploadSimple, Trash, Key, SignOut } from 'phosphor-react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { useConfigStore } from '@/stores/useConfigStore'
import { supabase } from '@/lib/supabase'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { Colors } from '@/constants/colors'
import { getInitials } from '@/lib/formatters'
import type { NetworkConfig } from '@/types'

export default function ProfileScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const { activeConfig, configs, loadConfigs, createConfig, updateConfig } = useConfigStore()

  const [notifications, setNotifications] = useState(true)
  const [showClearSheet, setShowClearSheet] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const fullName = user?.user_metadata?.full_name ?? 'User'
  const email = user?.email ?? ''
  const initials = getInitials(fullName)

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    router.replace('/(onboarding)')
  }

  const handleExportJson = async () => {
    if (!activeConfig) return
    const json = JSON.stringify(activeConfig, null, 2)
    const available = await Sharing.isAvailableAsync()
    if (available) {
      // Write to a temp file and share
      const { Share: RNShare } = require('react-native')
      await RNShare.share({
        title: `${activeConfig.name}.json`,
        message: json,
      })
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
        // Invalid shape
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
    } catch (err) {
      console.error('Import error:', err)
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
    }
    setClearing(false)
    setShowClearSheet(false)
  }

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
    <Pressable style={styles.settingRow} onPress={onPress}>
      <Text style={[styles.settingLabel, labelColor ? { color: labelColor } : null]}>
        {label}
      </Text>
      {rightElement ?? null}
    </Pressable>
  )

  return (
    <SafeAreaView style={styles.safe}>
      {/* Consistent Fixed Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header with avatar */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.email}>{email}</Text>
          <Pressable>
            <Text style={styles.editLink}>Edit profile</Text>
          </Pressable>
        </View>

        {/* GENERAL section */}
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
            rightElement={<Text style={styles.settingValue}>10.0.0.0/8 ›</Text>}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Default VLAN ID"
            rightElement={<Text style={styles.settingValue}>10 ›</Text>}
          />
        </View>

        {/* DATA section */}
        <Text style={styles.sectionLabel}>DATA</Text>
        <View style={styles.settingGroup}>
          <SettingRow
            label="Export JSON"
            onPress={handleExportJson}
            rightElement={<DownloadSimple size={20} color={Colors.textSecondary} />}
          />
          <View style={styles.divider} />
          <SettingRow
            label="Import config"
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

        {/* ACCOUNT section */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.settingGroup}>
          <SettingRow
            label="Change password"
            rightElement={<Key size={20} color={Colors.textSecondary} />}
          />
          <View style={styles.divider} />
          <SettingRow
            label={signingOut ? 'Signing out…' : 'Log out'}
            onPress={handleSignOut}
            labelColor={Colors.error}
            rightElement={<SignOut size={20} color={Colors.error} />}
          />
        </View>
      </ScrollView>

      {/* Clear all sheet */}
      <BottomSheet
        visible={showClearSheet}
        onClose={() => setShowClearSheet(false)}
        snapHeight={220}
      >
        <Text style={styles.sheetTitle}>Clear all configurations?</Text>
        <Text style={styles.sheetSubtitle}>
          This will permanently delete all your saved configurations. This action cannot be undone.
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surfaceAlt },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.primary,
  },
  content: { padding: 16, paddingBottom: 40, gap: 8 },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.ice,
    borderWidth: 3,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 28,
    color: Colors.primary,
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
  },
  editLink: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.primary,
    marginTop: 4,
  },
  sectionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
  },
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
  sheetTitle: {
    fontFamily: 'Inter_600SemiBold',
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
})
