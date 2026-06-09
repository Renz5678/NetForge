/**
 * components/viz/AlgorithmInsightSheet.tsx
 *
 * Slides up automatically when an algorithm visualization completes.
 * Shows a structured result: what happened, what it means, key metrics,
 * and the path or sequence involved.
 *
 * Design rules:
 *  - No emojis, no gradients
 *  - Inter / Outfit type system
 *  - Colors constants only
 *  - Section labels: 10px, Inter_600SemiBold, all-caps, textMuted
 *  - Body: 14px Inter_400Regular, textSecondary, lineHeight 21
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  LayoutAnimation,
} from 'react-native'
import { ArrowRight, CaretDown, X } from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Colors } from '@/constants/colors'
import type { Department, VisualizationStep } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Algorithm =
  | 'dijkstra'
  | 'aStar'
  | 'prims'
  | 'cycleDetection'
  | 'topologicalSort'
  | 'pathfindingComparison'

type Props = {
  visible: boolean
  onClose: () => void
  onReplay: () => void
  algorithm: Algorithm | null
  currentStep: VisualizationStep | null
  departments: Department[]
  sourceId: string | null
  targetId: string | null
  totalSteps: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function algorithmLabel(alg: Algorithm): string {
  switch (alg) {
    case 'dijkstra':   return "Dijkstra's Shortest Path"
    case 'aStar':      return 'A* Heuristic Search'
    case 'prims':      return "Prim's Minimum Spanning Tree"
    case 'cycleDetection':   return 'DFS Cycle Detection'
    case 'topologicalSort':  return 'Topological Sort'
    default: return alg
  }
}

function phaseTag(alg: Algorithm): string {
  switch (alg) {
    case 'dijkstra':
    case 'aStar':             return 'ROUTING'
    case 'prims':             return 'CABLING'
    case 'cycleDetection':    return 'CORRECTNESS'
    case 'topologicalSort':   return 'SEQUENCING'
    default: return 'ANALYSIS'
  }
}

function tracePath(
  sourceId: string | null,
  targetId: string | null,
  nodeStates: Record<string, string>,
  departments: Department[]
): string[] {
  if (!sourceId || !targetId) return []
  const pathSet = new Set<string>()
  Object.keys(nodeStates).forEach((id) => {
    if (nodeStates[id] === 'path') pathSet.add(id)
  })
  if (pathSet.size === 0) return []

  const path: string[] = [sourceId]
  let current = sourceId
  const visited = new Set<string>([sourceId])

  while (current !== targetId) {
    const dept = departments.find((d) => d.id === current)
    if (!dept) break
    const next = dept.peers.find((p) => pathSet.has(p) && !visited.has(p))
    if (!next) {
      const rev = departments.find(
        (d) => d.peers.includes(current) && pathSet.has(d.id) && !visited.has(d.id)
      )
      if (!rev) break
      current = rev.id
    } else {
      current = next
    }
    path.push(current)
    visited.add(current)
    if (path.length > 50) break
  }
  return path
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricBlock({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={metric.block}>
      <Text style={metric.value}>{value}</Text>
      <Text style={metric.label}>{label}</Text>
    </View>
  )
}

const metric = StyleSheet.create({
  block: { alignItems: 'center', minWidth: 72 },
  value: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 28,
    color: Colors.textPrimary,
    lineHeight: 34,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
})

function Divider() {
  return <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 4 }} />
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>
}

function NodeChip({ name, color }: { name: string; color?: string }) {
  return (
    <View style={[styles.chip, color ? { borderColor: color + '40', backgroundColor: color + '0C' } : null]}>
      <Text style={[styles.chipText, color ? { color } : null]}>{name}</Text>
    </View>
  )
}

// ─── Main content builders ────────────────────────────────────────────────────

function DijkstraContent({
  step,
  departments,
  sourceId,
  targetId,
  totalSteps,
}: {
  step: VisualizationStep
  departments: Department[]
  sourceId: string | null
  targetId: string | null
  totalSteps: number
}) {
  const [showTech, setShowTech] = useState(false)
  const path = tracePath(sourceId, targetId, step.nodeStates, departments)
  const hops = path.length > 1 ? path.length - 1 : 0
  const cost = step.distances && targetId ? step.distances[targetId] : null
  const costDisplay = cost !== null && cost !== Infinity ? cost : '—'
  const settled = Object.values(step.nodeStates).filter((s) => s === 'settled' || s === 'path').length

  const srcName = departments.find((d) => d.id === sourceId)?.name ?? 'Source'
  const tgtName = departments.find((d) => d.id === targetId)?.name ?? 'Target'
  const found   = path.length > 1

  return (
    <>
      {/* Headline */}
      <Text style={styles.headline}>
        {found ? `${hops} hop${hops !== 1 ? 's' : ''} to ${tgtName}` : `No route to ${tgtName}`}
      </Text>

      {/* Metrics */}
      <View style={styles.metricsRow}>
        <MetricBlock value={hops}        label="Hops" />
        <View style={styles.metricDivider} />
        <MetricBlock value={costDisplay} label="Path cost" />
        <View style={styles.metricDivider} />
        <MetricBlock value={settled}     label="Nodes checked" />
      </View>

      <Divider />

      {/* Path */}
      {found && (
        <View style={styles.section}>
          <SectionLabel text="ROUTE" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.pathRow}>
              {path.map((id, i) => {
                const name = departments.find((d) => d.id === id)?.name ?? id
                return (
                  <React.Fragment key={id}>
                    <NodeChip name={name} color={Colors.primary} />
                    {i < path.length - 1 && (
                      <ArrowRight size={12} color={Colors.pale} style={{ marginHorizontal: 2 }} />
                    )}
                  </React.Fragment>
                )
              })}
            </View>
          </ScrollView>
        </View>
      )}

      <Divider />

      {/* Networking insight */}
      <View style={styles.section}>
        <SectionLabel text="WHAT THIS MEANS" />
        <Text style={styles.insight}>
          {found
            ? `Traffic from ${srcName} to ${tgtName} traverses ${hops} device${hops !== 1 ? 's' : ''}. Every hop adds processing latency — typically 0.1–5ms per switch or router in a real deployment. This path has the lowest total cost in the current topology.`
            : `There is no route between ${srcName} and ${tgtName} in this topology. The two segments are either not peered, or an intermediate link is missing. Check the Departments tab and verify peer connections.`}
        </Text>
      </View>

      {/* Technical toggle */}
      <Pressable
        style={styles.techToggle}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setShowTech((v) => !v)
        }}
      >
        <Text style={styles.techToggleText}>Technical details</Text>
        <CaretDown
          size={13}
          color={Colors.textMuted}
          style={{ transform: [{ rotate: showTech ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {showTech && (
        <View style={styles.techCard}>
          <Text style={styles.techText}>
            Algorithm: Dijkstra's SPF (Shortest Path First){'\n'}
            Total steps: {totalSteps}{'\n'}
            Nodes evaluated: {settled}{'\n'}
            Complexity: O(E log V) with a binary min-heap priority queue{'\n'}
            Each edge relaxation updates a tentative distance if a shorter route is found.
          </Text>
        </View>
      )}
    </>
  )
}

function PrimsContent({
  step,
  departments,
  totalSteps,
}: {
  step: VisualizationStep
  departments: Department[]
  totalSteps: number
}) {
  const [showTech, setShowTech] = useState(false)
  const edgeCount = step.mstEdges?.length ?? 0
  const cost      = step.mstCost ?? 0
  const totalLinks = Math.floor(
    departments.reduce((s, d) => s + d.peers.length, 0) / 2
  )
  const redundant = Math.max(0, totalLinks - edgeCount)

  return (
    <>
      <Text style={styles.headline}>
        {edgeCount} cable{edgeCount !== 1 ? 's' : ''} — minimum backbone
      </Text>

      <View style={styles.metricsRow}>
        <MetricBlock value={edgeCount}  label="MST cables" />
        <View style={styles.metricDivider} />
        <MetricBlock value={cost}       label="Total cost" />
        <View style={styles.metricDivider} />
        <MetricBlock value={redundant}  label="Redundant links" />
      </View>

      <Divider />

      <View style={styles.section}>
        <SectionLabel text="WHAT THIS MEANS" />
        <Text style={styles.insight}>
          {`These ${edgeCount} cable${edgeCount !== 1 ? 's' : ''} are the minimum needed to keep every device in your topology connected. `}
          {redundant > 0
            ? `The remaining ${redundant} link${redundant !== 1 ? 's' : ''} do not contribute to basic connectivity — they provide redundancy or load sharing, but could be removed without isolating any device.`
            : `Every link in your topology is load-bearing — removing any one of them would disconnect at least one device.`}
        </Text>
      </View>

      <Divider />

      <View style={styles.section}>
        <SectionLabel text="MST EDGES" />
        <View style={styles.chipWrap}>
          {(step.mstEdges ?? []).map((e) => {
            const a = departments.find((d) => d.id === e.source)?.name ?? e.source
            const b = departments.find((d) => d.id === e.target)?.name ?? e.target
            return (
              <View key={`${e.source}→${e.target}`} style={styles.edgePill}>
                <Text style={styles.edgePillText}>{a}</Text>
                <ArrowRight size={10} color={Colors.textMuted} />
                <Text style={styles.edgePillText}>{b}</Text>
                <Text style={styles.edgePillCost}>w={e.weight}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <Pressable
        style={styles.techToggle}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setShowTech((v) => !v)
        }}
      >
        <Text style={styles.techToggleText}>Technical details</Text>
        <CaretDown
          size={13}
          color={Colors.textMuted}
          style={{ transform: [{ rotate: showTech ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {showTech && (
        <View style={styles.techCard}>
          <Text style={styles.techText}>
            Algorithm: Prim's Minimum Spanning Tree{'\n'}
            Total steps: {totalSteps}{'\n'}
            MST cost: {cost} | MST edges: {edgeCount}{'\n'}
            Complexity: O(E log V) with a binary min-heap{'\n'}
            At each step, the cheapest edge crossing from the visited set to an unvisited node is added.
          </Text>
        </View>
      )}
    </>
  )
}

function CycleContent({
  step,
  departments,
  totalSteps,
}: {
  step: VisualizationStep
  departments: Department[]
  totalSteps: number
}) {
  const [showTech, setShowTech] = useState(false)
  const cycleNodes = Object.keys(step.nodeStates).filter(
    (id) => step.nodeStates[id] === 'cycle'
  )
  const hasCycle = cycleNodes.length > 0

  return (
    <>
      <Text style={[styles.headline, { color: hasCycle ? Colors.error : Colors.success }]}>
        {hasCycle ? 'Routing loop found' : 'No loops detected'}
      </Text>

      <View style={styles.metricsRow}>
        <MetricBlock value={cycleNodes.length} label="Nodes in loop" />
        <View style={styles.metricDivider} />
        <MetricBlock value={totalSteps}        label="Paths traced" />
        <View style={styles.metricDivider} />
        <MetricBlock value={hasCycle ? 'Fail' : 'Pass'} label="Status" />
      </View>

      <Divider />

      {hasCycle && (
        <View style={styles.section}>
          <SectionLabel text="DEVICES IN LOOP" />
          <View style={styles.chipWrap}>
            {cycleNodes.map((id) => {
              const name = departments.find((d) => d.id === id)?.name ?? id
              return <NodeChip key={id} name={name} color={Colors.error} />
            })}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <SectionLabel text="WHAT THIS MEANS" />
        <Text style={styles.insight}>
          {hasCycle
            ? `A routing loop exists between the devices above. When a broadcast or unknown-destination frame enters this loop, it circulates indefinitely — each device forwards it to the next, and no TTL mechanism at Layer 2 stops it. This causes broadcast storms that saturate all links in the loop and can bring down the entire segment. Remove the back-edge link or enable Spanning Tree Protocol to break the loop.`
            : `No routing loops were found. The topology is directed-acyclic in its logical forwarding path, which means packets will always make forward progress toward their destination without circling back. This topology is safe to deploy without STP at the routing layer.`}
        </Text>
      </View>

      <Pressable
        style={styles.techToggle}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setShowTech((v) => !v)
        }}
      >
        <Text style={styles.techToggleText}>Technical details</Text>
        <CaretDown
          size={13}
          color={Colors.textMuted}
          style={{ transform: [{ rotate: showTech ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {showTech && (
        <View style={styles.techCard}>
          <Text style={styles.techText}>
            Algorithm: DFS with node colouring (white / gray / black){'\n'}
            Total steps: {totalSteps}{'\n'}
            A back-edge — an edge from a gray node to another gray ancestor — indicates a cycle.{'\n'}
            Complexity: O(V + E)
          </Text>
        </View>
      )}
    </>
  )
}

function TopoContent({
  step,
  departments,
  totalSteps,
}: {
  step: VisualizationStep
  departments: Department[]
  totalSteps: number
}) {
  const [showTech, setShowTech] = useState(false)
  const sorted = step.sortedResult ?? []

  return (
    <>
      <Text style={styles.headline}>
        {sorted.length} device{sorted.length !== 1 ? 's' : ''} — startup sequence ready
      </Text>

      <View style={styles.metricsRow}>
        <MetricBlock value={sorted.length} label="Devices ordered" />
        <View style={styles.metricDivider} />
        <MetricBlock value={totalSteps}    label="Steps" />
      </View>

      <Divider />

      <View style={styles.section}>
        <SectionLabel text="STARTUP ORDER" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.pathRow}>
            {sorted.map((id, i) => {
              const name = departments.find((d) => d.id === id)?.name ?? id
              return (
                <React.Fragment key={id}>
                  <View style={styles.topoChip}>
                    <Text style={styles.topoChipNum}>{i + 1}</Text>
                    <Text style={styles.topoChipName}>{name}</Text>
                  </View>
                  {i < sorted.length - 1 && (
                    <ArrowRight size={12} color={Colors.pale} style={{ marginHorizontal: 2 }} />
                  )}
                </React.Fragment>
              )
            })}
          </View>
        </ScrollView>
      </View>

      <Divider />

      <View style={styles.section}>
        <SectionLabel text="WHAT THIS MEANS" />
        <Text style={styles.insight}>
          {`Bring devices online in the numbered order above. Each device's upstream dependencies — routers, switches, or DHCP servers it relies on — will already be running before it initialises. Powering up out of order risks configuration failures, interface errors, and dropped adjacencies that are difficult to diagnose in production.`}
        </Text>
      </View>

      <Pressable
        style={styles.techToggle}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
          setShowTech((v) => !v)
        }}
      >
        <Text style={styles.techToggleText}>Technical details</Text>
        <CaretDown
          size={13}
          color={Colors.textMuted}
          style={{ transform: [{ rotate: showTech ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {showTech && (
        <View style={styles.techCard}>
          <Text style={styles.techText}>
            Algorithm: Kahn's Topological Sort{'\n'}
            Total steps: {totalSteps}{'\n'}
            Nodes with in-degree 0 are enqueued first, then their outgoing edges are removed and the process repeats.{'\n'}
            Complexity: O(V + E)
          </Text>
        </View>
      )}
    </>
  )
}

// ─── Main Sheet ───────────────────────────────────────────────────────────────

export function AlgorithmInsightSheet({
  visible,
  onClose,
  onReplay,
  algorithm,
  currentStep,
  departments,
  sourceId,
  targetId,
  totalSteps,
}: Props) {
  if (!algorithm || !currentStep) return null

  const tag = phaseTag(algorithm as Algorithm)

  function renderContent() {
    if (!currentStep || !algorithm) return null
    switch (algorithm) {
      case 'dijkstra':
      case 'aStar':
        return (
          <DijkstraContent
            step={currentStep}
            departments={departments}
            sourceId={sourceId}
            targetId={targetId}
            totalSteps={totalSteps}
          />
        )
      case 'prims':
        return (
          <PrimsContent
            step={currentStep}
            departments={departments}
            totalSteps={totalSteps}
          />
        )
      case 'cycleDetection':
        return (
          <CycleContent
            step={currentStep}
            departments={departments}
            totalSteps={totalSteps}
          />
        )
      case 'topologicalSort':
        return (
          <TopoContent
            step={currentStep}
            departments={departments}
            totalSteps={totalSteps}
          />
        )
      default:
        return null
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={600}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
            <Text style={styles.algorithmName}>{algorithmLabel(algorithm as Algorithm)}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <X size={16} color={Colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.dividerTop} />

        {/* Dynamic content per algorithm */}
        {renderContent()}

        {/* CTA: replay */}
        <Pressable
          style={({ pressed }) => [styles.replayBtn, pressed && { opacity: 0.82 }]}
          onPress={() => { onReplay(); onClose() }}
        >
          <Text style={styles.replayBtnText}>Step through replay</Text>
          <ArrowRight size={15} color={Colors.primary} />
        </Pressable>
      </ScrollView>
    </BottomSheet>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  tagPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.ice,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  algorithmName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  closeBtn: {
    padding: 4,
  },
  dividerTop: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 2,
    marginBottom: 2,
  },

  // Headline
  headline: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 22,
    color: Colors.textPrimary,
    lineHeight: 29,
  },

  // Metrics row
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  metricDivider: {
    flex: 1,
    height: 28,
    width: 1,
    backgroundColor: Colors.border,
    maxWidth: 1,
  },

  // Section
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },

  // Insight text
  insight: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Path chips
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
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

  // Chip wrap (for multi-row)
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  // Edge pill (Prim's)
  edgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  edgePillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textPrimary,
  },
  edgePillCost: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 2,
  },

  // Topo chips
  topoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  topoChipNum: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: Colors.primary,
  },
  topoChipName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textPrimary,
  },

  // Technical toggle
  techToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  techToggleText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
  },
  techCard: {
    backgroundColor: Colors.ice,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  techText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },

  // Replay CTA
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginTop: 4,
  },
  replayBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.primary,
  },
})
