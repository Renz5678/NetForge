import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ShieldCheck, CheckCircle, Warning } from 'phosphor-react-native'
import { useConfigStore } from '@/stores/useConfigStore'
import { useVisualizationStore } from '@/stores/useVisualizationStore'
import { useValidation } from '@/hooks/useValidation'
import { findArticulationPoints } from '@/lib/algorithms/articulationPoints'
import { ValidationCard } from '@/components/ui/ValidationCard'
import { ValidationScoreRing } from '@/components/ui/ValidationScoreRing'
import { Button } from '@/components/ui/Button'
import { Colors } from '@/constants/colors'
import { useHaptics } from '@/hooks/useHaptics'
import { TopHeader } from '@/components/ui/TopHeader'

export default function ValidateScreen() {
  const router = useRouter()
  const haptics = useHaptics()
  const { activeConfig } = useConfigStore()
  const { setCriticalNodeIds } = useVisualizationStore()
  const [key, setKey] = useState(0)
  const [hasRun, setHasRun] = useState(false)

  const departments = activeConfig?.departments ?? []
  const validation = useValidation(departments)

  // Run articulation point detection whenever departments change and after validation run
  const runSpfCheck = useCallback(() => {
    const result = findArticulationPoints(departments)
    setCriticalNodeIds(result.articulationPoints)
    return result
  }, [departments, setCriticalNodeIds])

  const allCorePass =
    validation.cycleCheck.passed &&
    validation.allocationCheck.passed &&
    validation.connectivityCheck.passed &&
    validation.vlanCheck.passed

  const handleRerun = () => {
    setKey((k) => k + 1)
  }

  // Reset hasRun and clear critical node highlights when config changes
  useEffect(() => {
    setHasRun(false)
    setCriticalNodeIds([])
  }, [activeConfig?.id, setCriticalNodeIds])

  // ── Haptic feedback based on result (once per run) ─────────────────────────
  // NOTE: This must be declared before any conditional returns (Rules of Hooks).
  useEffect(() => {
    if (!hasRun || !activeConfig) return
    const ap = findArticulationPoints(activeConfig.departments)
    const corePass =
      validation.cycleCheck.passed &&
      validation.allocationCheck.passed &&
      validation.connectivityCheck.passed &&
      validation.vlanCheck.passed
    if (corePass && !ap.articulationPoints.length) {
      haptics.success()
    } else if (!corePass) {
      haptics.error()
    } else {
      haptics.warning()
    }
  // key changes on re-run; include it so the effect re-fires each run
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRun, key])

  // ── Empty state (no config loaded) ─────────────────────────────────────────
  if (!activeConfig) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopHeader title="Validation" leftIcon={<ShieldCheck size={22} color={Colors.primary} />} />
        <View style={styles.emptyState}>
          <ShieldCheck size={56} color={Colors.pale} />
          <Text style={styles.emptyTitle}>No configuration selected</Text>
          <Text style={styles.emptySubtitle}>Select a configuration to run validation checks.</Text>
          <Button
            label="Go to Configs"
            variant="primary"
            onPress={() => router.push('/(tabs)/configs')}
          />
        </View>
      </SafeAreaView>
    )
  }

  // ── Pre-run state ───────────────────────────────────────────────────────────
  if (!hasRun) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopHeader
          title="Validation"
          leftIcon={<ShieldCheck size={22} color={Colors.primary} />}
        />
        <View style={styles.emptyState}>
          <CheckCircle size={48} color={Colors.pale} />
          <Text style={styles.emptyTitle}>Validate Network Topology</Text>
          <Text style={styles.emptySubtitle}>Run validation to check your topology for issues.</Text>
          <Button
            label="Run Validation"
            variant="primary"
            onPress={() => {
              haptics.light()
              setHasRun(true)
              runSpfCheck()
            }}
          />
        </View>
      </SafeAreaView>
    )
  }

  // ── Post-run state: compute AP results for display ──────────────────────────
  const apResult = findArticulationPoints(departments)
  const hasArticulationPoints = apResult.articulationPoints.length > 0

  // Resolve AP names for display in the affected chips
  const idToName = new Map(departments.map((d) => [d.id, d.name]))
  const apNames = apResult.articulationPoints.map((id) => idToName.get(id) ?? id)
  const bridgeCount = apResult.bridges.length

  const spfCheck = {
    passed: !hasArticulationPoints,
    message: hasArticulationPoints
      ? `${apResult.articulationPoints.length} critical node${apResult.articulationPoints.length !== 1 ? 's' : ''} detected — removing ${apResult.articulationPoints.length !== 1 ? 'any of these' : 'this node'} would partition the network.`
      : 'No single points of failure. All nodes are part of redundant paths.',
    affected: hasArticulationPoints ? apNames : undefined,
  }

  const allPass = allCorePass && !hasArticulationPoints

  // ── Score calculation ───────────────────────────────────────────────────────
  const checksPassedCount = [
    validation.cycleCheck,
    validation.allocationCheck,
    validation.connectivityCheck,
    validation.vlanCheck,
    spfCheck,
  ].filter((c) => c.passed).length
  const score = Math.round((checksPassedCount / 5) * 100)
  const scoreLabel = `${checksPassedCount} of 5 checks passed`
  const scoreSublabel =
    score >= 100
      ? 'Network ready to deploy'
      : score >= 80
      ? 'Minor issues detected'
      : 'Critical issues found'

  const checks = [
    {
      id: 'cycle',
      title: 'Cycle detection',
      description: 'Checking for routing loops in graph topology.',
      result: validation.cycleCheck,
      variant: undefined as undefined,
      explanationTitle: 'Why Routing Loops are Bad',
      explanation: 'Routing loops cause broadcast storms and severe network instability. Packets get trapped endlessly cycling between nodes, eventually bringing the entire network down. Fix the cyclic path before deploying.',
    },
    {
      id: 'subnet',
      title: 'Subnet allocation',
      description: 'Checking for overlapping IP ranges in VLAN clusters.',
      result: validation.allocationCheck,
      variant: undefined as undefined,
      explanationTitle: 'Why IP Overlap is Bad',
      explanation: 'IP overlapping happens when multiple devices are assigned the same IP address or subnet range. This causes intermittent connectivity drops, as the network cannot reliably determine where to route traffic.',
    },
    {
      id: 'connectivity',
      title: 'Connectivity check',
      description: 'Verifying all departments are reachable via BFS.',
      result: validation.connectivityCheck,
      variant: undefined as undefined,
      explanationTitle: 'Why Connectivity Fails',
      explanation: 'If a node is unreachable, it means there is no physical or logical path from the core to that department. Traffic will be blackholed and the segment will be completely isolated from the network.',
    },
    {
      id: 'vlan',
      title: 'VLAN assignment',
      description: 'Verifying all access ports mapped to valid broadcast domains.',
      result: validation.vlanCheck,
      variant: undefined as undefined,
      explanationTitle: 'Why Invalid VLANs are Bad',
      explanation: 'VLAN inconsistencies (like trunk links missing allowed VLANs or access ports assigned to non-existent VLANs) lead to dropped traffic. Devices may be physically connected but logically isolated.',
    },
    {
      id: 'spf',
      title: 'Single point of failure',
      description: hasArticulationPoints
        ? `DFS (Decrease & Conquer) identified ${apResult.articulationPoints.length} articulation point${apResult.articulationPoints.length !== 1 ? 's' : ''}${bridgeCount > 0 ? ` and ${bridgeCount} bridge link${bridgeCount !== 1 ? 's' : ''}` : ''}. Consider adding redundant paths.`
        : 'DFS (Decrease & Conquer) found no articulation points. Your topology has full link redundancy.',
      result: spfCheck,
      // Warning for APs (not strictly broken, but needs attention), pass if none
      variant: (hasArticulationPoints ? 'warning' : 'pass') as 'warning' | 'pass' | undefined,
      explanationTitle: 'Why Single Points of Failure are Bad',
      explanation: 'A Single Point of Failure (SPF) or articulation point is a node or link that, if brought down, will completely sever parts of your network. Adding redundant paths protects against massive hardware outages.',
    },
  ]

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <TopHeader
        title="Validation"
        leftIcon={<ShieldCheck size={22} color={Colors.primary} />}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Score Ring */}
        <View style={styles.ringContainer}>
          <ValidationScoreRing
            score={score}
            label={scoreLabel}
            sublabel={scoreSublabel}
          />
        </View>

        {/* All-pass banner */}
        {allPass && (
          <View style={styles.passBanner}>
            <ShieldCheck size={24} color={Colors.success} weight="fill" />
            <Text style={styles.passBannerText}>
              Validation complete. No critical topology conflicts found.
            </Text>
          </View>
        )}

        {/* Articulation point info banner when APs exist but other checks pass */}
        {allCorePass && hasArticulationPoints && (
          <View style={styles.warnBanner}>
            <Warning size={22} color={Colors.warning} weight="fill" />
            <Text style={styles.warnBannerText}>
              Core topology is valid but {apResult.articulationPoints.length} critical node{apResult.articulationPoints.length !== 1 ? 's were' : ' was'} found.
              Highlighted in amber on the topology map.
            </Text>
          </View>
        )}

        {/* Check cards */}
        <View style={styles.cards} key={key}>
          {checks.map((check, index) => (
            <ValidationCard
              key={`${check.id}-${key}`}
              title={check.title}
              description={check.description}
              result={check.result}
              index={index}
              variant={check.variant}
              explanationTitle={check.explanationTitle}
              explanation={check.explanation}
            />
          ))}
        </View>
      </ScrollView>

      {/* Re-run button */}
      <View style={styles.footer}>
        <Button
          label="Re-run validation"
          variant="primary"
          fullWidth
          onPress={() => {
            haptics.light()
            handleRerun()
            runSpfCheck()
          }}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surfaceAlt },
  configName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  configNameLink: {
    color: Colors.primary,
    fontFamily: 'Inter_500Medium',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 100,
  },
  ringContainer: {
    paddingTop: 16,
    alignItems: 'center',
  },
  passBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.successContainer,
    borderRadius: 14,
    padding: 16,
  },
  passBannerText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.success,
    lineHeight: 20,
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.warningContainer,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: `${Colors.warning}40`,
  },
  warnBannerText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.warning,
    lineHeight: 20,
  },
  cards: { gap: 12 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
})
