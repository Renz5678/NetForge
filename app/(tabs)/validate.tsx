/**
 * app/(tabs)/validate.tsx  — Validate tab
 *
 * Workflow states:
 *   1. No active config       → functional prompt + "Go to Canvas" link
 *   2. Config loaded, not run → live network summary + dominant "Validate Network" button
 *   3. Running                → ValidatePhaseIndicator with 5 pulsing phase dots
 *   4. Results (findings)     → ValidationScoreRing + grouped findings list
 *
 * "Re-validate" is a text link — not a primary button.
 * "Go to Export" is a secondary button shown after a clean/passing result.
 */

import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  ShieldCheck,
  TreeStructure,
  Warning,
  CheckCircle,
  ArrowRight,
  Info,
  CaretRight,
  ArrowLeft,
} from 'phosphor-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useConfigStore } from '@/stores/useConfigStore'
import { usePreferencesStore } from '@/stores/usePreferencesStore'
import { Colors } from '@/constants/colors'
import { TopHeader } from '@/components/ui/TopHeader'
import { ValidationScoreRing } from '@/components/ui/ValidationScoreRing'
import { ValidatePhaseIndicator } from '@/components/ui/ValidatePhaseIndicator'
import { FindingRow } from '@/components/ui/FindingRow'
import { AlgorithmDrillDown } from '@/components/ui/AlgorithmDrillDown'
import { validateNetwork } from '@/lib/validatePass'
import { topologyReadiness } from '@/lib/validatePass'
import type { ValidatePassResult, Finding, FindingSeverity } from '@/lib/validatePass'
import { useHaptics } from '@/hooks/useHaptics'

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_PHASES: string[] = [
  'connectivity',
  'addressing',
  'resilience',
  'correctness',
  'optimization',
]

const PHASE_LABELS: Record<string, string> = {
  connectivity: 'Connectivity',
  addressing:   'Addressing',
  resilience:   'Resilience',
  correctness:  'Correctness',
  optimization: 'Optimization',
}

const SEVERITY_ORDER: FindingSeverity[] = ['red', 'yellow', 'blue']

function severityColor(s: FindingSeverity): string {
  switch (s) {
    case 'red':    return Colors.error
    case 'yellow': return Colors.warning
    case 'blue':   return Colors.primary
    default:       return Colors.pale
  }
}

function severityBgColor(s: FindingSeverity): string {
  switch (s) {
    case 'red':    return Colors.errorContainer
    case 'yellow': return Colors.warningContainer
    case 'blue':   return `${Colors.primary}10`
    default:       return Colors.surfaceAlt
  }
}

function severityLabel(s: FindingSeverity): string {
  switch (s) {
    case 'red':    return 'Critical'
    case 'yellow': return 'Warning'
    case 'blue':   return 'Info'
    default:       return ''
  }
}

import type { NetworkConfig } from '@/types'

// ─── Network Summary Card ─────────────────────────────────────────────────────

function NetworkSummaryCard({ config }: { config: NetworkConfig }) {
  const nodeCount  = config.departments.length
  const linkCount  = Math.floor(config.departments.reduce((s, d) => s + d.peers.length, 0) / 2)
  const vlanCount  = config.departments.filter((d) => d.vlanId !== undefined).length
  const hasRouters = config.departments.some((d) => d.type === 'router' || d.type === 'firewall')

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryCardTitle} numberOfLines={1}>{config.name}</Text>
      <View style={styles.summaryMetrics}>
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryValue}>{nodeCount}</Text>
          <Text style={styles.summaryMetricLabel}>Nodes</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryValue}>{linkCount}</Text>
          <Text style={styles.summaryMetricLabel}>Links</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryMetric}>
          <Text style={styles.summaryValue}>{vlanCount}</Text>
          <Text style={styles.summaryMetricLabel}>VLANs</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryMetric}>
          <Text style={[styles.summaryValue, { color: hasRouters ? Colors.success : Colors.warning }]}>
            {hasRouters ? 'Yes' : 'No'}
          </Text>
          <Text style={styles.summaryMetricLabel}>Routing</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Findings Group ───────────────────────────────────────────────────────────

function FindingGroup({
  severity,
  findings,
  onDrillDown,
}: {
  severity: FindingSeverity
  findings: Finding[]
  onDrillDown: (f: Finding) => void
}) {
  if (findings.length === 0) return null
  const color = severityColor(severity)
  const bg    = severityBgColor(severity)
  const label = severityLabel(severity)

  return (
    <View style={styles.findingGroup}>
      {/* Group header */}
      <View style={[styles.findingGroupHeader, { backgroundColor: bg }]}>
        <View style={[styles.findingGroupDot, { backgroundColor: color }]} />
        <Text style={[styles.findingGroupLabel, { color }]}>{label}</Text>
        <View style={[styles.findingGroupCount, { backgroundColor: color + '20' }]}>
          <Text style={[styles.findingGroupCountText, { color }]}>{findings.length}</Text>
        </View>
      </View>

      {/* Rows */}
      <View style={styles.findingGroupBody}>
        {findings.map((f, i) => (
          <FindingRow
            key={f.id}
            finding={f}
            onDrillDown={onDrillDown}
            showDivider={i < findings.length - 1}
          />
        ))}
      </View>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

/** Returns true if the config is a built-in demo / sample template. */
function isSampleConfig(id: string): boolean {
  return id.startsWith('demo_enterprise_config') || id.startsWith('local_tpl_')
}

export default function ValidateScreen() {
  const router = useRouter()
  const configs = useConfigStore((s) => s.configs)
  const setActiveConfig = useConfigStore((s) => s.setActiveConfig)
  const activeConfig = useConfigStore((s) => s.activeConfig)
  const appMode = usePreferencesStore((s) => s.appMode)
  const isStudent = appMode === 'student'

  // Local config selection — NOT auto-populated from activeConfig
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const selectedConfig = selectedConfigId
    ? configs.find((c) => c.id === selectedConfigId) ?? null
    : null

  // Only user-created configs, no demos or templates
  const userConfigs = configs.filter((c) => !isSampleConfig(c.id))

  const [result, setResult] = useState<ValidatePassResult | null>(null)
  const [running, setRunning] = useState(false)
  const [currentPhase, setCurrentPhase] = useState(-1)
  const [drillDown, setDrillDown] = useState<Finding | null>(null)
  const [drillDownVisible, setDrillDownVisible] = useState(false)

  const haptics = useHaptics()

  const handleRun = useCallback(() => {
    if (!selectedConfig) return
    haptics.light()
    setRunning(true)
    setResult(null)
    setCurrentPhase(0)
  }, [selectedConfig, haptics])

  // Effect drives the animation timers and the actual validation run.
  // Cleanup cancels any in-flight timers if the component unmounts mid-run.
  useEffect(() => {
    if (!running || !selectedConfig) return

    let isActive = true
    const phaseTimers: ReturnType<typeof setTimeout>[] = []

    ALL_PHASES.forEach((_, i) => {
      if (i === 0) return
      phaseTimers.push(
        setTimeout(() => { if (isActive) setCurrentPhase(i) }, i * 280)
      )
    })

    validateNetwork(selectedConfig).then((runResult) => {
      const finalTimer = setTimeout(() => {
        if (isActive) {
          setRunning(false)
          setCurrentPhase(ALL_PHASES.length)
          setResult(runResult)
          if (runResult.score >= 70) haptics.success()
          else haptics.error()
        }
      }, ALL_PHASES.length * 280 + 200)
      phaseTimers.push(finalTimer)
    })

    return () => {
      isActive = false
      phaseTimers.forEach(clearTimeout)
    }
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrillDown = (finding: Finding) => {
    setDrillDown(finding)
    setDrillDownVisible(true)
  }

  const groupedFindings = React.useMemo(() => {
    if (!result) return {} as Record<FindingSeverity, Finding[]>
    return SEVERITY_ORDER.reduce<Record<FindingSeverity, Finding[]>>(
      (acc, sev) => {
        acc[sev] = result.findings.filter((f) => f.severity === sev)
        return acc
      },
      { red: [], yellow: [], blue: [] }
    )
  }, [result])

  const scoreLabel = result
    ? result.score >= 90
      ? 'Deploy Ready'
      : result.score >= 70
      ? 'Deploy with Caution'
      : 'Not Ready'
    : ''

  const headerIcon = (
    <View style={styles.headerIcon}>
      <ShieldCheck size={18} color={Colors.white} weight="fill" />
    </View>
  )

  // ── Config picker ─────────────────────────────────────────────────────────

  if (!selectedConfigId) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopHeader title="Validate" leftIcon={headerIcon} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pickerHeading}>Choose a project to validate</Text>
          <Text style={styles.pickerSubheading}>
            Select one of your saved networks below. Sample templates are not shown.
          </Text>

          {userConfigs.length === 0 ? (
            <View style={styles.noConfigContainer}>
              <ShieldCheck size={48} color={Colors.pale} weight="duotone" />
              <Text style={styles.noConfigTitle}>No projects yet</Text>
              <Text style={styles.noConfigSubtitle}>
                Create a network in the Canvas tab first.
              </Text>
              <Pressable style={styles.noConfigLink} onPress={() => router.push('/(tabs)')}>
                <TreeStructure size={14} color={Colors.primary} weight="duotone" />
                <Text style={styles.noConfigLinkText}>Go to Canvas</Text>
                <ArrowRight size={13} color={Colors.primary} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.pickerList}>
              {userConfigs.map((cfg) => (
                <Pressable
                  key={cfg.id}
                  style={({ pressed }) => [styles.pickerCard, pressed && { opacity: 0.8 }]}
                  onPress={() => setSelectedConfigId(cfg.id)}
                >
                  <View style={styles.pickerCardBody}>
                    <Text style={styles.pickerCardName} numberOfLines={1}>{cfg.name}</Text>
                    <Text style={styles.pickerCardMeta}>
                      {cfg.departments.length} node{cfg.departments.length !== 1 ? 's' : ''}
                      {cfg.isValid === true ? '  ·  ✓ Valid' : cfg.isValid === false ? '  ·  ⚠ Issues' : ''}
                    </Text>
                  </View>
                  <CaretRight size={18} color={Colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Running ───────────────────────────────────────────────────────────────

  if (running) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopHeader title="Validate" leftIcon={headerIcon} />
        <View style={styles.runningContainer}>
          <View style={styles.runningCard}>
            <ShieldCheck size={32} color={Colors.primary} weight="duotone" />
            <Text style={styles.runningTitle}>Analysing network…</Text>
            <Text style={styles.runningSubtitle}>{selectedConfig?.name}</Text>
            <View style={{ marginTop: 20, width: '100%' }}>
              <ValidatePhaseIndicator
                phases={ALL_PHASES}
                currentPhase={currentPhase}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────

  if (result) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopHeader
          title="Validate"
          leftIcon={headerIcon}
          rightActions={
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => { setResult(null); setSelectedConfigId(null) }} style={styles.rerunBtn}>
                <Text style={styles.rerunText}>Change</Text>
              </Pressable>
              <Pressable onPress={handleRun} style={styles.rerunBtn}>
                <Text style={styles.rerunText}>Re-run</Text>
              </Pressable>
            </View>
          }
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Score ring */}
          <View style={styles.scoreSection}>
            <ValidationScoreRing
              score={result.score}
              label={scoreLabel}
              sublabel={`${result.findings.length} finding${result.findings.length !== 1 ? 's' : ''} · ${result.phasesRan.length} phases`}
            />
          </View>

          {/* Zero findings — clean */}
          {result.findings.length === 0 && (
            <View style={styles.cleanCard}>
              <CheckCircle size={28} color={Colors.success} weight="fill" />
              <Text style={styles.cleanTitle}>All checks passed</Text>
              <Text style={styles.cleanSubtitle}>
                This topology is ready for configuration export.
              </Text>
            </View>
          )}

          {/* Student mode: algorithm summary */}
          {isStudent && result.phasesRan.length > 0 && (
            <View style={styles.algorithmSummary}>
              <View style={styles.algorithmSummaryHeader}>
                <Info size={14} color={Colors.primary} />
                <Text style={styles.algorithmSummaryTitle}>Algorithms run in this pass</Text>
              </View>
              <Text style={styles.algorithmSummaryText}>
                BFS Reachability · VLSM Allocation · Tarjan DFS · Cycle Detection · ACL Engine · Prim's MST
              </Text>
            </View>
          )}

          {/* Findings grouped by severity */}
          {SEVERITY_ORDER.map((sev) => (
            <FindingGroup
              key={sev}
              severity={sev}
              findings={groupedFindings[sev] ?? []}
              onDrillDown={handleDrillDown}
            />
          ))}

          {/* Export CTA if score is passing */}
          {result.score >= 70 && (
            <Pressable
              style={({ pressed }) => [styles.exportCta, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/(tabs)/export')}
            >
              <Text style={styles.exportCtaText}>Continue to Export</Text>
              <ArrowRight size={16} color={Colors.primary} />
            </Pressable>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        <AlgorithmDrillDown
          finding={drillDown}
          visible={drillDownVisible}
          onClose={() => setDrillDownVisible(false)}
        />
      </SafeAreaView>
    )
  }

  // ── Entry state (config selected, not run) ────────────────────────────────

  return (
    <LinearGradient colors={['#EEF4FF', '#F5F8FF', '#FFFFFF']} style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <TopHeader
          title="Validate"
          leftIcon={headerIcon}
          rightActions={
            <Pressable onPress={() => setSelectedConfigId(null)} style={styles.rerunBtn}>
              <Text style={styles.rerunText}>Change</Text>
            </Pressable>
          }
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Network summary — shows selected config */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>SELECTED PROJECT</Text>
          </View>
          {selectedConfig && (
            <NetworkSummaryCard config={selectedConfig} />
          )}

          {/* Readiness requirements card */}
          {selectedConfig && (() => {
            const readiness = topologyReadiness(selectedConfig)
            const hasIssues = !readiness.ready || readiness.warnings.length > 0
            if (!hasIssues) return null
            return (
              <View style={styles.readinessCard}>
                <Text style={styles.readinessTitle}>Requirements</Text>
                {readiness.blocking.map((msg, i) => (
                  <View key={`block-${i}`} style={styles.readinessRow}>
                    <Text style={styles.readinessIconBlocking}>✕</Text>
                    <Text style={styles.readinessTextBlocking}>{msg}</Text>
                  </View>
                ))}
                {readiness.warnings.map((msg, i) => (
                  <View key={`warn-${i}`} style={styles.readinessRow}>
                    <Text style={styles.readinessIconWarning}>⚠</Text>
                    <Text style={styles.readinessTextWarning}>{msg}</Text>
                  </View>
                ))}
              </View>
            )
          })()}

          {/* Five phases preview */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>VALIDATION PHASES</Text>
          </View>
          <View style={styles.phasesPreviewCard}>
            {ALL_PHASES.map((phase, i) => (
              <View key={phase} style={styles.phaseRow}>
                <View style={styles.phaseNumber}>
                  <Text style={styles.phaseNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.phaseRowLabel}>{PHASE_LABELS[phase]}</Text>
              </View>
            ))}
          </View>

          {/* Primary CTA — disabled when topology doesn't meet minimum requirements */}
          {selectedConfig && (() => {
            const readiness = topologyReadiness(selectedConfig)
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.runBtn,
                  !readiness.ready && styles.runBtnDisabled,
                  pressed && readiness.ready && { opacity: 0.88 },
                ]}
                onPress={readiness.ready ? handleRun : undefined}
                disabled={!readiness.ready}
              >
                <ShieldCheck size={20} color={Colors.white} weight="fill" />
                <Text style={styles.runBtnText}>Validate Network</Text>
              </Pressable>
            )
          })()}

          {/* Student mode hint */}
          {isStudent && (
            <View style={styles.studentHint}>
              <Info size={13} color={Colors.textMuted} />
              <Text style={styles.studentHintText}>
                Tap any finding to see the algorithm that detected it.
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  // ── Picker ───────────────────────────────────────────────────────────────
  pickerHeading: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  pickerSubheading: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  pickerList: { gap: 10 },
  pickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  pickerCardBody: { flex: 1, gap: 3 },
  pickerCardName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.textPrimary,
  },
  pickerCardMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },

  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── No config ────────────────────────────────────────────────────────────
  noConfigContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  noConfigTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 20,
    color: Colors.textPrimary,
    marginTop: 8,
  },
  noConfigSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  noConfigLink: {
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
  noConfigLinkText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
  },

  // ── Running ──────────────────────────────────────────────────────────────
  runningContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  runningCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 6,
  },
  runningTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginTop: 6,
  },
  runningSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },

  // ── Entry state ──────────────────────────────────────────────────────────
  sectionHeader: {
    marginBottom: 10,
    marginTop: 8,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryCardTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  summaryMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  summaryMetric: { flex: 1, alignItems: 'center' },
  summaryValue: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
  },
  summaryMetricLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  phasesPreviewCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phaseNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseNumberText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.white,
  },
  phaseRowLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  runBtn: {
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
  },
  runBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.white,
  },
  runBtnDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },

  // ── Readiness card ───────────────────────────────────────────────────────
  readinessCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 14,
    gap: 8,
  },
  readinessTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  readinessIconBlocking: {
    fontSize: 13,
    color: Colors.error,
    lineHeight: 20,
    width: 16,
    textAlign: 'center',
  },
  readinessTextBlocking: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.error,
    flex: 1,
    lineHeight: 20,
  },
  readinessIconWarning: {
    fontSize: 13,
    color: Colors.warning,
    lineHeight: 20,
    width: 16,
    textAlign: 'center',
  },
  readinessTextWarning: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.warning,
    flex: 1,
    lineHeight: 20,
  },
  studentHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
  },
  studentHintText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },

  // ── Results ──────────────────────────────────────────────────────────────
  rerunBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rerunText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
  },
  scoreSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  cleanCard: {
    backgroundColor: Colors.successContainer,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${Colors.success}30`,
  },
  cleanTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
    color: Colors.success,
  },
  cleanSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.success,
    textAlign: 'center',
    opacity: 0.8,
  },
  algorithmSummary: {
    backgroundColor: `${Colors.primary}08`,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${Colors.primary}20`,
  },
  algorithmSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  algorithmSummaryTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },
  algorithmSummaryText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  findingGroup: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  findingGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  findingGroupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  findingGroupLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.4,
    flex: 1,
  },
  findingGroupCount: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  findingGroupCountText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  findingGroupBody: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  exportCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    marginTop: 8,
  },
  exportCtaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
  },
})
