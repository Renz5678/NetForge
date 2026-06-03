import React from 'react'
import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { Export, FileText, X, DeviceMobile } from 'phosphor-react-native'
import { useConfigStore } from '@/stores/useConfigStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { generateFullTopologyConfig } from '@/lib/configGenerator'
import { Colors } from '@/constants/colors'
import { useRouter } from 'expo-router'
import { TopHeader } from '@/components/ui/TopHeader'
import { ClipboardButton } from '@/components/ui/ClipboardButton'

// ─── Syntax highlighter ────────────────────────────────────────────────────────
function highlightCiscoIOS(text: string): React.ReactNode {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    // Comments (lines starting with !)
    if (line.trimStart().startsWith('!')) {
      return <Text key={i} style={[styles.codeText, { color: '#6A9955' }]}>{line + '\n'}</Text>
    }
    // Keywords
    const keywordMatch = line.match(/^(\s*)(interface|router ospf|router bgp|ip route|ip access-list|switchport|vlan|hostname|spanning-tree|no shutdown|ip address|ip nat|access-group)(\s.*)?$/)
    if (keywordMatch) {
      const keyword = keywordMatch[2]
      const rest = line.slice(line.indexOf(keyword) + keyword.length)
      const prefix = line.slice(0, line.indexOf(keyword))
      return (
        <Text key={i} style={styles.codeText}>
          <Text style={{ color: '#999' }}>{prefix}</Text>
          <Text style={{ color: '#569CD6', fontFamily: 'Inter_600SemiBold' }}>{keyword}</Text>
          <Text style={{ color: '#9CDCFE' }}>{rest}</Text>
          {'\n'}
        </Text>
      )
    }
    // IP addresses (simple pattern)
    const ipLine = line.replace(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?)/g, '|||$1|||')
    if (ipLine.includes('|||')) {
      const parts = ipLine.split('|||')
      return (
        <Text key={i} style={styles.codeText}>
          {parts.map((p, j) =>
            /^\d{1,3}\.\d{1,3}/.test(p)
              ? <Text key={j} style={{ color: '#B5CEA8' }}>{p}</Text>
              : <Text key={j}>{p}</Text>
          )}
          {'\n'}
        </Text>
      )
    }
    return <Text key={i} style={styles.codeText}>{line + '\n'}</Text>
  })
}

// ─── Split config by device sections ──────────────────────────────────────────
function splitByDevice(text: string): Array<{ deviceName: string; config: string }> {
  const lines = text.split('\n')
  const sections: Array<{ deviceName: string; config: string }> = []
  let currentName: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('!--- ')) {
      // Save previous section
      if (currentName !== null) {
        sections.push({ deviceName: currentName, config: currentLines.join('\n').trim() })
      }
      currentName = line.slice(5).replace(/\s*---+$/, '').trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }
  // Push last section
  if (currentName !== null) {
    sections.push({ deviceName: currentName, config: currentLines.join('\n').trim() })
  }

  if (sections.length === 0) {
    return [{ deviceName: 'Full Config', config: text }]
  }
  return sections
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function ExportScreen() {
  const router = useRouter()
  const activeConfig = useConfigStore((s) => s.activeConfig)
  const configs = useConfigStore((s) => s.configs)
  const setActiveConfig = useConfigStore((s) => s.setActiveConfig)
  const user = useAuthStore((s) => s.user)

  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [sharing, setSharing] = useState(false)
  const [activeDeviceTab, setActiveDeviceTab] = useState(0)

  const configText = activeConfig ? generateFullTopologyConfig(activeConfig) : ''

  // Reset device tab whenever the modal opens
  useEffect(() => {
    if (previewVisible) {
      setActiveDeviceTab(0)
    }
  }, [previewVisible])

  const deviceSections = splitByDevice(previewText)

  // Clamp the active tab index if sections change (e.g. different config opened)
  useEffect(() => {
    if (activeDeviceTab >= deviceSections.length) {
      setActiveDeviceTab(0)
    }
  }, [deviceSections.length, activeDeviceTab])

  const activeSection = deviceSections[activeDeviceTab] ?? deviceSections[0]

  const handlePreview = useCallback(() => {
    if (!activeConfig) return
    setPreviewText(generateFullTopologyConfig(activeConfig))
    setPreviewVisible(true)
  }, [activeConfig])

  const handleShareFile = useCallback(async () => {
    if (!activeConfig) return
    const isSharingAvailable = await Sharing.isAvailableAsync()
    if (!isSharingAvailable) {
      Alert.alert('Sharing Unavailable', 'File sharing is not supported on this device.')
      return
    }
    setSharing(true)
    let file: File | null = null
    try {
      const filename = `${activeConfig.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_cisco_ios.txt`
      file = new File(Paths.cache, filename)
      file.write(configText)
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/plain',
        dialogTitle: `Export ${activeConfig.name} — Cisco IOS Config`,
        UTI: 'public.plain-text',
      })
    } catch (err) {
      Alert.alert('Export Failed', 'Could not write or share the configuration file.')
      console.error('Export error:', err)
    } finally {
      if (file && file.exists) {
        try {
          file.delete()
        } catch (delErr) {
          console.warn('Failed to delete temp export file:', delErr)
        }
      }
      setSharing(false)
    }
  }, [activeConfig, configText])

  const deviceSummary = (config: typeof activeConfig) => {
    if (!config) return ''
    const counts: Record<string, number> = {}
    for (const d of config.departments) {
      const type = d.type ?? 'department'
      counts[type] = (counts[type] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([type, count]) => `${count} ${type}${count !== 1 ? 's' : ''}`)
      .join(', ')
  }

  // ─── Summary row values ────────────────────────────────────────────────────
  const totalDevices = activeConfig?.departments?.length ?? 0
  const totalVlans = activeConfig
    ? new Set(activeConfig.departments.map((d: any) => d.vlanId).filter(Boolean)).size
    : 0
  const baseIp = activeConfig?.baseIp ?? '—'
  const isValid = activeConfig?.isValid === true

  return (
    <SafeAreaView style={styles.safe}>
      {/* Consistent Fixed Header */}
      <TopHeader title="Config Export" />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Intro Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Export size={28} color={Colors.primary} weight="duotone" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Cisco Export</Text>
            <Text style={styles.headerSub}>Generate Cisco IOS CLI scripts from your topology</Text>
          </View>
        </View>

        {/* Active Config Card */}
        {activeConfig ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FileText size={20} color={Colors.primary} weight="duotone" />
              <Text style={styles.cardTitle} numberOfLines={1}>{activeConfig.name}</Text>
            </View>
            <Text style={styles.cardMeta}>{deviceSummary(activeConfig)}</Text>
            <Text style={styles.cardMeta}>Base IP: {activeConfig.baseIp}  ·  VLAN Start: {activeConfig.vlanStart}</Text>

            {/* Vendor badge */}
            <View style={styles.vendorBadge}>
              <DeviceMobile size={14} color={Colors.primary} />
              <Text style={styles.vendorLabel}>Cisco IOS</Text>
            </View>

            {/* Export summary row */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                <Text style={styles.summaryLabel}>Devices: </Text>
                <Text>{totalDevices}</Text>
                {'  •  '}
                <Text style={styles.summaryLabel}>VLANs: </Text>
                <Text>{totalVlans}</Text>
                {'  •  '}
                <Text style={styles.summaryLabel}>Base: </Text>
                <Text>{baseIp}</Text>
                {'  •  '}
                <Text style={styles.summaryLabel}>Validated: </Text>
                <Text style={isValid ? styles.summaryValid : styles.summaryInvalid}>
                  {isValid ? '✓' : '✗'}
                </Text>
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                style={[styles.actionBtn, styles.actionBtnOutline]}
                onPress={handlePreview}
              >
                <Text style={styles.actionBtnOutlineText}>Preview Config</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.actionBtnPrimary, sharing && { opacity: 0.6 }]}
                onPress={handleShareFile}
                disabled={sharing}
              >
                {sharing
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={styles.actionBtnPrimaryText}>Share as File</Text>
                }
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Export size={48} color={Colors.pale} weight="duotone" />
            <Text style={styles.emptyTitle}>No Active Config Selected</Text>
            <Text style={styles.emptyBody}>Open a configuration to export its Cisco CLI script.</Text>
            <View style={{ marginTop: 12, width: 180 }}>
              <Pressable
                style={[styles.actionBtn, styles.actionBtnOutline, { paddingVertical: 10 }]}
                onPress={() => router.push('/(tabs)/configs')}
              >
                <Text style={styles.actionBtnOutlineText}>Go to Configs</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Config list quick-select */}
        {configs.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionTitle}>Your Topologies</Text>
            {configs.map((cfg) => (
              <Pressable
                key={cfg.id}
                style={[styles.configRow, activeConfig?.id === cfg.id && styles.configRowActive]}
                onPress={() => setActiveConfig(cfg.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.configRowName, activeConfig?.id === cfg.id && { color: Colors.primary }]} numberOfLines={1}>
                    {cfg.name}
                  </Text>
                  <Text style={styles.configRowMeta}>{cfg.departments.length} nodes</Text>
                </View>
                {activeConfig?.id === cfg.id && (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>Active</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Preview Modal */}
      <Modal
        visible={previewVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {activeConfig?.name ?? 'Config'} — Cisco IOS
            </Text>
            <ClipboardButton
              text={previewText}
              label="Copy All"
              style={styles.copyAllBtn}
            />
            <Pressable onPress={() => setPreviewVisible(false)} hitSlop={12} style={styles.modalCloseBtn}>
              <X size={22} color={Colors.textPrimary} />
            </Pressable>
          </View>

          {/* Device tab bar (horizontal scroll) */}
          {deviceSections.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabBar}
              contentContainerStyle={styles.tabBarContent}
            >
              {deviceSections.map((section, index) => (
                <Pressable
                  key={index}
                  style={[styles.tabChip, activeDeviceTab === index && styles.tabChipActive]}
                  onPress={() => setActiveDeviceTab(index)}
                >
                  <Text style={[styles.tabChipText, activeDeviceTab === index && styles.tabChipTextActive]}>
                    {section.deviceName}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Code scroll */}
          <ScrollView
            style={styles.codeScroll}
            horizontal={false}
            showsVerticalScrollIndicator
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Per-device copy button */}
            <View style={styles.deviceCopyRow}>
              <ClipboardButton
                text={activeSection?.config ?? previewText}
                label={deviceSections.length > 1 ? `Copy ${activeSection?.deviceName}` : 'Copy'}
                style={styles.deviceCopyBtn}
              />
            </View>
            <Text selectable style={styles.codeText}>
              {highlightCiscoIOS(activeSection?.config ?? previewText)}
            </Text>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Pressable
              style={[styles.actionBtn, styles.actionBtnPrimary, { flex: 1 }, sharing && { opacity: 0.6 }]}
              onPress={() => { setPreviewVisible(false); handleShareFile() }}
              disabled={sharing}
            >
              <Text style={styles.actionBtnPrimaryText}>Share as File</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  fixedHeader: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  fixedHeaderTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.primary,
  },
  container: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  headerIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: Colors.ice,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 20, color: Colors.textPrimary },
  headerSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textMuted, marginTop: 2 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: Colors.textPrimary, flex: 1 },
  cardMeta: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textMuted, marginBottom: 2 },

  vendorBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.ice, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start', marginTop: 10, marginBottom: 12,
  },
  vendorLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.primary },

  // Summary row
  summaryRow: {
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.ice,
    borderRadius: 10,
  },
  summaryText: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  summaryLabel: { fontFamily: 'Outfit_600SemiBold', color: Colors.textPrimary },
  summaryValid: { fontFamily: 'Outfit_600SemiBold', color: Colors.success },
  summaryInvalid: { fontFamily: 'Outfit_600SemiBold', color: Colors.error },

  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  actionBtnOutline: { borderWidth: 1.5, borderColor: Colors.primary },
  actionBtnOutlineText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.primary },
  actionBtnPrimary: { backgroundColor: Colors.primary },
  actionBtnPrimaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.white },

  emptyCard: {
    backgroundColor: Colors.white, borderRadius: 18,
    padding: 40, alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
  },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: Colors.textSecondary },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  configRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  configRowActive: { borderColor: Colors.primary, backgroundColor: Colors.ice },
  configRowName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary },
  configRowMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  activePill: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  activePillText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: Colors.white },

  // Modal
  modalSafe: { flex: 1, backgroundColor: Colors.white },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.textPrimary, flex: 1 },
  copyAllBtn: { flexShrink: 0 },
  modalCloseBtn: { marginLeft: 4 },

  // Device tab bar
  tabBar: {
    maxHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  tabBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  tabChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.ice,
  },
  tabChipText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tabChipTextActive: {
    color: Colors.primary,
    fontFamily: 'Outfit_600SemiBold',
  },

  // Code area
  codeScroll: { flex: 1, backgroundColor: '#0F1117', padding: 16 },
  codeText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 18, color: '#cdd6f4' },

  deviceCopyRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  deviceCopyBtn: {
    backgroundColor: '#1e2030',
    borderColor: '#3e4460',
  },

  modalFooter: {
    flexDirection: 'row', padding: 16,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
})
