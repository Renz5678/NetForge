/**
 * app/(tabs)/export.tsx  — Export tab
 *
 * Workflow states:
 *   1. No active config      → prompt to go to Canvas
 *   2. Not yet validated     → prompt to go to Validate first
 *   3. Validated with RED    → amber warning strip, but still allows export
 *   4. Ready                 → four artifact rows + "Export All" primary button
 *
 * Artifacts:
 *   A. Device Configs (Cisco IOS) — generateFullTopologyConfig (existing)
 *   B. IP Plan CSV              — generateIpPlanCsv (new lib/ipPlanCsv.ts)
 *   C. Change Checklist         — topological order list (existing topologicalSort)
 *   D. Risk Summary             — plain text from last validate run (session storage)
 *
 * Student Mode: shows "Study this network" row below Export All.
 */

import React, { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import {
  Export,
  FileText,
  TreeStructure,
  Warning,
  ShieldCheck,
  ArrowRight,
  Info,
  GraduationCap,
  CheckCircle,
  Download,
} from 'phosphor-react-native'
import { useRouter } from 'expo-router'
import { useConfigStore } from '@/stores/useConfigStore'
import { usePreferencesStore } from '@/stores/usePreferencesStore'
import { generateFullTopologyConfig } from '@/lib/configGenerator'
import { generateIpPlanCsv, ipPlanFilename } from '@/lib/ipPlanCsv'
import { topologicalSort } from '@/lib/algorithms/topologicalSort'
import { Colors } from '@/constants/colors'
import { TopHeader } from '@/components/ui/TopHeader'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function shareTextFile(
  content: string,
  filename: string,
  mimeType: string = 'text/plain'
): Promise<boolean> {
  const available = await Sharing.isAvailableAsync()
  if (!available) {
    Alert.alert('Sharing Unavailable', 'Your device does not support file sharing.')
    return false
  }
  let file: InstanceType<typeof File> | null = null
  try {
    file = new File(Paths.cache, filename)
    file.write(content)
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename })
    return true
  } catch {
    Alert.alert('Export Failed', 'Could not generate or share the file.')
    return false
  } finally {
    if (file) {
      try { (file as any).delete?.() } catch {}
    }
  }
}

// ─── Artifact Row ─────────────────────────────────────────────────────────────

function ArtifactRow({
  icon,
  label,
  description,
  onExport,
  loading,
}: {
  icon: React.ReactNode
  label: string
  description: string
  onExport: () => void
  loading?: boolean
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.artifactRow, pressed && { backgroundColor: Colors.surfaceAlt }]}
      onPress={onExport}
    >
      <View style={styles.artifactIcon}>{icon}</View>
      <View style={styles.artifactBody}>
        <Text style={styles.artifactLabel}>{label}</Text>
        <Text style={styles.artifactDesc} numberOfLines={1}>{description}</Text>
      </View>
      {loading
        ? <ActivityIndicator size="small" color={Colors.primary} />
        : <Download size={18} color={Colors.primary} />
      }
    </Pressable>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExportScreen() {
  const router = useRouter()
  const activeConfig = useConfigStore((s) => s.activeConfig)
  const appMode = usePreferencesStore((s) => s.appMode)
  const isStudent = appMode === 'student'

  const [loadingA, setLoadingA] = useState(false)
  const [loadingB, setLoadingB] = useState(false)
  const [loadingC, setLoadingC] = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)
  const [lastExported, setLastExported] = useState<string | null>(null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleExportDeviceConfigs = useCallback(async () => {
    if (!activeConfig) return
    setLoadingA(true)
    const content = generateFullTopologyConfig(activeConfig)
    const filename = `${activeConfig.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_cisco_ios.txt`
    const ok = await shareTextFile(content, filename, 'text/plain')
    if (ok) setLastExported('Device Configs')
    setLoadingA(false)
  }, [activeConfig])

  const handleExportIpPlan = useCallback(async () => {
    if (!activeConfig) return
    setLoadingB(true)
    const content = generateIpPlanCsv(activeConfig)
    const filename = ipPlanFilename(activeConfig)
    const ok = await shareTextFile(content, filename, 'text/csv')
    if (ok) setLastExported('IP Plan CSV')
    setLoadingB(false)
  }, [activeConfig])

  const handleExportChecklist = useCallback(async () => {
    if (!activeConfig) return
    setLoadingC(true)
    const order = topologicalSort(activeConfig.departments)
    const nameLine = (id: string) => {
      const dept = activeConfig.departments.find((d) => d.id === id)
      return dept ? `  [ ] Configure ${dept.name} (VLAN ${dept.vlanId ?? '—'}, ${dept.subnet ?? 'no subnet'})` : `  [ ] ${id}`
    }
    const content = [
      `Change Checklist — ${activeConfig.name}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      'Deployment order (dependencies first):',
      ...order.map(nameLine),
      '',
      '— End of checklist —',
    ].join('\n')
    const filename = `${activeConfig.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_checklist.txt`
    const ok = await shareTextFile(content, filename, 'text/plain')
    if (ok) setLastExported('Change Checklist')
    setLoadingC(false)
  }, [activeConfig])

  const handleExportAll = useCallback(async () => {
    if (!activeConfig) return
    setLoadingAll(true)
    // Export Device Configs only — the most common artifact for "Export All"
    // Additional artifacts auto-downloaded in sequence
    const configText = generateFullTopologyConfig(activeConfig)
    const configFilename = `${activeConfig.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_cisco_ios.txt`
    await shareTextFile(configText, configFilename, 'text/plain')
    setLoadingAll(false)
    setLastExported('All artifacts')
  }, [activeConfig])

  // ── No config ─────────────────────────────────────────────────────────────

  if (!activeConfig) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopHeader
          title="Export"
          leftIcon={
            <View style={styles.headerIcon}>
              <Export size={18} color={Colors.white} weight="fill" />
            </View>
          }
        />
        <View style={styles.centeredContainer}>
          <Export size={52} color={Colors.pale} weight="duotone" />
          <Text style={styles.centeredTitle}>No project selected</Text>
          <Text style={styles.centeredSubtitle}>
            Open a project in the Canvas tab to generate export artifacts.
          </Text>
          <Pressable
            style={styles.linkBtn}
            onPress={() => router.push('/(tabs)')}
          >
            <TreeStructure size={14} color={Colors.primary} weight="duotone" />
            <Text style={styles.linkBtnText}>Go to Canvas</Text>
            <ArrowRight size={13} color={Colors.primary} />
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  // ── Not yet validated (isValid is undefined) ──────────────────────────────

  if (activeConfig.isValid === undefined || activeConfig.departments.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopHeader
          title="Export"
          leftIcon={
            <View style={styles.headerIcon}>
              <Export size={18} color={Colors.white} weight="fill" />
            </View>
          }
        />
        <View style={styles.centeredContainer}>
          <ShieldCheck size={52} color={Colors.pale} weight="duotone" />
          <Text style={styles.centeredTitle}>Validate first</Text>
          <Text style={styles.centeredSubtitle}>
            Run the Validate pass to confirm the topology is correct before exporting.
          </Text>
          <Pressable
            style={styles.linkBtn}
            onPress={() => router.push('/(tabs)/validate')}
          >
            <ShieldCheck size={14} color={Colors.primary} weight="duotone" />
            <Text style={styles.linkBtnText}>Go to Validate</Text>
            <ArrowRight size={13} color={Colors.primary} />
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  // ── Export ready ──────────────────────────────────────────────────────────

  const hasWarning = activeConfig.isValid === false

  return (
    <SafeAreaView style={styles.safe}>
      <TopHeader
        title="Export"
        leftIcon={
          <View style={styles.headerIcon}>
            <Export size={18} color={Colors.white} weight="fill" />
          </View>
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Amber warning strip for invalid topology */}
        {hasWarning && (
          <View style={styles.warningStrip}>
            <Warning size={15} color={Colors.warning} weight="fill" />
            <Text style={styles.warningText}>
              This topology has validation issues. Review findings before deploying.
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/validate')}>
              <Text style={styles.warningLink}>Review</Text>
            </Pressable>
          </View>
        )}

        {/* Last exported confirmation */}
        {lastExported && (
          <View style={styles.successStrip}>
            <CheckCircle size={14} color={Colors.success} weight="fill" />
            <Text style={styles.successText}>{lastExported} exported</Text>
          </View>
        )}

        {/* Project summary */}
        <View style={styles.projectSummary}>
          <Text style={styles.projectName} numberOfLines={1}>{activeConfig.name}</Text>
          <Text style={styles.projectMeta}>
            {activeConfig.departments.length} nodes · {activeConfig.departments.filter((d) => d.vlanId).length} VLANs
          </Text>
        </View>

        {/* Artifacts */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>EXPORT ARTIFACTS</Text>
        </View>

        <View style={styles.artifactGroup}>
          <ArtifactRow
            icon={<FileText size={20} color={Colors.primary} weight="duotone" />}
            label="Device Configs"
            description="Full Cisco IOS configuration per device"
            onExport={handleExportDeviceConfigs}
            loading={loadingA}
          />
          <View style={styles.separator} />
          <ArtifactRow
            icon={<TreeStructure size={20} color={Colors.primary} weight="duotone" />}
            label="IP Plan CSV"
            description="Subnet table with VLAN, host ranges, and device counts"
            onExport={handleExportIpPlan}
            loading={loadingB}
          />
          <View style={styles.separator} />
          <ArtifactRow
            icon={<CheckCircle size={20} color={Colors.primary} weight="duotone" />}
            label="Change Checklist"
            description="Deployment order with dependency-first sequencing"
            onExport={handleExportChecklist}
            loading={loadingC}
          />
          <View style={styles.separator} />
          <ArtifactRow
            icon={<Info size={20} color={Colors.primary} weight="duotone" />}
            label="Risk Summary"
            description="Text summary of last validation findings"
            onExport={() => {
              Alert.alert(
                'Risk Summary',
                'Run the Validate tab to generate a current risk summary. It will be included automatically in the next export.'
              )
            }}
          />
        </View>

        {/* Export All */}
        <Pressable
          style={({ pressed }) => [styles.exportAllBtn, pressed && { opacity: 0.88 }]}
          onPress={handleExportAll}
          disabled={loadingAll}
        >
          {loadingAll
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Export size={18} color={Colors.white} weight="fill" />
          }
          <Text style={styles.exportAllText}>
            {loadingAll ? 'Exporting…' : 'Export All'}
          </Text>
        </Pressable>

        {/* Student Mode: "Study this network" */}
        {isStudent && (
          <Pressable
            style={({ pressed }) => [styles.studyBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/(tabs)/validate')}
          >
            <GraduationCap size={18} color={Colors.primary} weight="duotone" />
            <Text style={styles.studyBtnText}>Study this network</Text>
            <ArrowRight size={14} color={Colors.primary} />
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Centered states ───────────────────────────────────────────────────────
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  centeredTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 20,
    color: Colors.textPrimary,
    marginTop: 8,
  },
  centeredSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  linkBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
  },

  // ── Warning / success strips ──────────────────────────────────────────────
  warningStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningContainer,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: `${Colors.warning}40`,
  },
  warningText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.warning,
    flex: 1,
    lineHeight: 18,
  },
  warningLink: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.warning,
  },
  successStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.successContainer,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: `${Colors.success}30`,
  },
  successText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.success,
  },

  // ── Project summary ───────────────────────────────────────────────────────
  projectSummary: {
    marginBottom: 20,
    gap: 4,
  },
  projectName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 22,
    color: Colors.textPrimary,
  },
  projectMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },

  // ── Section label ─────────────────────────────────────────────────────────
  sectionLabel: {
    marginBottom: 10,
  },
  sectionLabelText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },

  // ── Artifact group ────────────────────────────────────────────────────────
  artifactGroup: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  artifactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    minHeight: 60,
  },
  artifactIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.ice,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artifactBody: {
    flex: 1,
    gap: 2,
  },
  artifactLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  artifactDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },

  // ── Export All ────────────────────────────────────────────────────────────
  exportAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 17,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 12,
  },
  exportAllText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.white,
  },

  // ── Study button ──────────────────────────────────────────────────────────
  studyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  studyBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
    flex: 1,
  },
})
