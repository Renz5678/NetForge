/**
 * components/ui/AlgorithmDrillDown.tsx
 *
 * Bottom sheet that explains a validation finding in depth.
 *
 * Engineer Mode: shows plain-English title + detail only.
 * Student Mode:  shows algorithm name subtitle + plain-English text.
 *
 * Uses the existing BottomSheet component — swipe-down to dismiss.
 */

import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import {
  ShieldCheck,
  WifiHigh,
  Link,
  ArrowsClockwise,
  Funnel,
  TreeStructure,
} from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Colors } from '@/constants/colors'
import { usePreferencesStore } from '@/stores/usePreferencesStore'
import type { Finding, FindingSeverity, AlgorithmKey } from '@/lib/validatePass'

// ─── Algorithm metadata ───────────────────────────────────────────────────────

const ALGORITHM_META: Record<AlgorithmKey, { name: string; concept: string; complexity: string }> = {
  bfsValidator: {
    name: 'BFS Reachability',
    concept: 'Breadth-First Search traverses the graph level by level to find all reachable nodes.',
    complexity: 'O(V + E)',
  },
  vlsmCalculator: {
    name: 'VLSM Allocation',
    concept: 'Variable Length Subnet Masking uses Greedy allocation to assign the smallest block that fits each segment.',
    complexity: 'O(n log n)',
  },
  articulationPoints: {
    name: 'Tarjan DFS',
    concept: 'Depth-First Search with discovery times and low-link values detects articulation points in one pass.',
    complexity: 'O(V + E)',
  },
  cycleDetection: {
    name: 'DFS Cycle Detection',
    concept: 'Node colouring during DFS (white/gray/black) detects back edges which signal routing loops.',
    complexity: 'O(V + E)',
  },
  aclEngine: {
    name: 'ACL Sequential Scan',
    concept: 'Rules sorted by sequence number; first match wins. Implicit deny-all at the end mirrors Cisco IOS behaviour.',
    complexity: 'O(r) per packet',
  },
  prims: {
    name: "Prim's MST",
    concept: 'Minimum Spanning Tree built with a min-heap priority queue identifies the cheapest connected subgraph.',
    complexity: 'O(E log V)',
  },
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

function severityColor(s: FindingSeverity): string {
  switch (s) {
    case 'red':    return Colors.error
    case 'yellow': return Colors.warning
    case 'blue':   return Colors.primary
    default:       return Colors.pale
  }
}

function severityText(s: FindingSeverity): string {
  switch (s) {
    case 'red':    return 'Critical'
    case 'yellow': return 'Warning'
    case 'blue':   return 'Information'
    default:       return ''
  }
}

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    connectivity: 'Phase 1 — Connectivity',
    addressing: 'Phase 2 — Addressing',
    resilience: 'Phase 3 — Resilience',
    correctness: 'Phase 4 — Correctness',
    optimization: 'Phase 5 — Optimization',
  }
  return map[phase] ?? phase
}

function PhaseIcon({ phase }: { phase: string }) {
  const size = 20
  const color = Colors.textMuted
  switch (phase) {
    case 'connectivity':  return <WifiHigh size={size} color={color} weight="duotone" />
    case 'addressing':    return <TreeStructure size={size} color={color} weight="duotone" />
    case 'resilience':    return <Link size={size} color={color} weight="duotone" />
    case 'correctness':   return <ArrowsClockwise size={size} color={color} weight="duotone" />
    case 'optimization':  return <Funnel size={size} color={color} weight="duotone" />
    default:              return <ShieldCheck size={size} color={color} weight="duotone" />
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  finding: Finding | null
  visible: boolean
  onClose: () => void
}

export function AlgorithmDrillDown({ finding, visible, onClose }: Props) {
  const appMode = usePreferencesStore((s) => s.appMode)
  const isStudent = appMode === 'student'

  if (!finding) return null

  const meta = ALGORITHM_META[finding.algorithm]
  const color = severityColor(finding.severity)
  const severityStr = severityText(finding.severity)

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={480}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Phase + severity header */}
        <View style={styles.metaRow}>
          <PhaseIcon phase={finding.phase} />
          <Text style={styles.phaseText}>{phaseLabel(finding.phase)}</Text>
          <View style={[styles.severityPill, { backgroundColor: color + '18', borderColor: color + '40' }]}>
            <View style={[styles.severityDot, { backgroundColor: color }]} />
            <Text style={[styles.severityText, { color }]}>{severityStr}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{finding.title}</Text>

        {/* Detail sentence */}
        <Text style={styles.detail}>{finding.detail}</Text>

        {/* Affected list */}
        {finding.affected.length > 0 && (
          <View style={styles.affectedSection}>
            <Text style={styles.sectionLabel}>AFFECTED DEVICES</Text>
            <View style={styles.chipRow}>
              {finding.affected.map((name) => (
                <View key={name} style={styles.chip}>
                  <Text style={styles.chipText}>{name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Student Mode: algorithm explanation */}
        {isStudent && meta && (
          <View style={styles.algorithmSection}>
            <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
            <View style={styles.algorithmCard}>
              <Text style={styles.algorithmName}>{meta.name}</Text>
              <Text style={styles.algorithmConcept}>{meta.concept}</Text>
              <View style={styles.complexityRow}>
                <Text style={styles.complexityLabel}>Complexity</Text>
                <Text style={styles.complexityValue}>{meta.complexity}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  phaseText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  severityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  severityText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    lineHeight: 25,
  },
  detail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  affectedSection: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textPrimary,
  },
  algorithmSection: {
    gap: 8,
    marginTop: 4,
  },
  algorithmCard: {
    backgroundColor: Colors.ice,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  algorithmName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: Colors.primary,
  },
  algorithmConcept: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  complexityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  complexityLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
  },
  complexityValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
})
