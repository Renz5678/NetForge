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
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import { useRouter } from 'expo-router'
import { DownloadSimple, UploadSimple, Trash, Key, SignOut } from 'phosphor-react-native'
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
  
  const {
    notifications,
    defaultBaseIp,
    defaultVlanStart,
    setNotifications,
    setDefaultBaseIp,
    setDefaultVlanStart,
  } = usePreferencesStore()

  const [showDefaultsSheet, setShowDefaultsSheet] = useState(false)
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
            Animated.timing(translateX, {
              toValue: SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onClose()
          })
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 12,
          }).start()
        }
      },
    })
  ).current

  const fullName = user?.user_metadata?.full_name ?? 'User'
  const email = user?.email ?? ''
  const initials = getInitials(fullName)

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    onClose()
    router.replace('/(onboarding)')
  }

  const handleExportJson = async () => {
    if (!activeConfig) return
    const json = JSON.stringify(activeConfig, null, 2)
    const available = await Sharing.isAvailableAsync()
    if (available) {
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

      if (!parsed.name || !parsed.departments) return
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
    onClose()
  }

  const handlePasswordReset = async () => {
    if (!email) return
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      alert('Error sending password reset: ' + error.message)
    } else {
      alert('Password reset email sent to ' + email)
    }
  }

  const handleSaveDefaults = () => {
    if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(tempBaseIp)) {
      setDefaultBaseIp(tempBaseIp)
    }
    const num = parseInt(tempVlanStart, 10)
    if (!isNaN(num) && num > 0 && num < 4095) {
      setDefaultVlanStart(tempVlanStart)
    }
    setShowDefaultsSheet(false)
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
    <Modal
      visible={visible || opacity !== null} // To allow animation to finish
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Animated.View style={[styles.backdrop, { opacity }]} accessibilityViewIsModal={true}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
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
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={styles.handleBar} />
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* Profile Info */}
            <View style={styles.profileSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Text style={styles.name}>{fullName}</Text>
              <Text style={styles.email}>{email}</Text>
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
                onPress={handlePasswordReset}
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
        </Animated.View>
      </KeyboardAvoidingView>

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

      {/* Defaults Sheet */}
      <BottomSheet
        visible={showDefaultsSheet}
        onClose={() => setShowDefaultsSheet(false)}
        snapHeight={340}
      >
        <Text style={styles.sheetTitle}>Default Configurations</Text>
        <Text style={[styles.sheetSubtitle, { marginBottom: 16 }]}>
          These will be used when creating a new config.
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
          <Button
            label="Save Defaults"
            variant="primary"
            fullWidth
            onPress={handleSaveDefaults}
          />
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
    backgroundColor: 'rgba(0, 26, 65, 0.4)',
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
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
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
    fontFamily: 'Inter_600SemiBold',
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
  profileSection: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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
  inputLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
})
