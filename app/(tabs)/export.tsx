import React from 'react'
import { useState, useCallback } from 'react'
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

export default function ExportScreen() {
  const activeConfig = useConfigStore((s) => s.activeConfig)
  const configs = useConfigStore((s) => s.configs)
  const setActiveConfig = useConfigStore((s) => s.setActiveConfig)
  const user = useAuthStore((s) => s.user)

  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [sharing, setSharing] = useState(false)

  const configText = activeConfig ? generateFullTopologyConfig(activeConfig) : ''

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
    try {
      const filename = `${activeConfig.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_cisco_ios.txt`
      const file = new File(Paths.cache, filename)
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Export size={28} color={Colors.primary} weight="duotone" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Config Export</Text>
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
            <Text style={styles.emptyBody}>Go to the Configs tab and open a topology to enable export.</Text>
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
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {activeConfig?.name ?? 'Config'} — Cisco IOS
            </Text>
            <Pressable onPress={() => setPreviewVisible(false)} hitSlop={12}>
              <X size={22} color={Colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.codeScroll}
            horizontal={false}
            showsVerticalScrollIndicator
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <Text selectable style={styles.codeText}>
              {highlightCiscoIOS(previewText)}
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
    alignSelf: 'flex-start', marginTop: 10, marginBottom: 16,
  },
  vendorLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.primary },

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.textPrimary, flex: 1, marginRight: 12 },
  codeScroll: { flex: 1, backgroundColor: '#0F1117', padding: 16 },
  codeText: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 18, color: '#cdd6f4' },
  modalFooter: {
    flexDirection: 'row', padding: 16,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
})
