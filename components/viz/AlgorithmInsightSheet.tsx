/**
 * components/viz/AlgorithmInsightSheet.tsx
 *
 * Auto-slides up when an algorithm visualization completes.
 * Theme: Inter/Outfit, Colors constants, no emojis, no gradients.
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
import type { NetworkNode, VisualizationStep } from '@/types'

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
  departments: NetworkNode[]
  sourceId: string | null
  targetId: string | null
  totalSteps: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function analysisLabel(alg: Algorithm): string {
  switch (alg) {
    case 'dijkstra':
    case 'aStar':           return 'Shortest Route'
    case 'prims':           return 'Minimum Cabling'
    case 'cycleDetection':  return 'Loop Check'
    case 'topologicalSort': return 'Startup Order'
    default:                return 'Network Analysis'
  }
}

function phaseTag(alg: Algorithm): string {
  switch (alg) {
    case 'dijkstra':
    case 'aStar':           return 'ROUTING'
    case 'prims':           return 'CABLING'
    case 'cycleDetection':  return 'HEALTH'
    case 'topologicalSort': return 'STARTUP'
    default:                return 'ANALYSIS'
  }
}

function tracePath(
  sourceId: string | null,
  targetId: string | null,
  nodeStates: Record<string, string>,
  departments: NetworkNode[]
): string[] {
  if (!sourceId || !targetId) return []
  const pathSet = new Set<string>()
  Object.keys(nodeStates).forEach((id) => {
    if (nodeStates[id] === 'path') pathSet.add(id)
  })
  if (pathSet.size === 0) return []

  const path: string[] = [sourceId]
  let current = sourceId
  const seen = new Set<string>([sourceId])

  while (current !== targetId) {
    const dept = departments.find((d) => d.id === current)
    if (!dept) break
    const next = dept.peers.find((p) => pathSet.has(p) && !seen.has(p))
    if (!next) {
      const rev = departments.find(
        (d) => d.peers.includes(current) && pathSet.has(d.id) && !seen.has(d.id)
      )
      if (!rev) break
      current = rev.id
    } else {
      current = next
    }
    path.push(current)
    seen.add(current)
    if (path.length > 50) break
  }
  return path
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function MetricBlock({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={s.metricBlock}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  )
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={s.sectionLabel}>{text}</Text>
}

function Rule() {
  return <View style={s.rule} />
}

function TechToggle({
  open,
  onPress,
}: {
  open: boolean
  onPress: () => void
}) {
  return (
    <Pressable style={s.techToggle} onPress={onPress}>
      <Text style={s.techToggleText}>Technical details</Text>
      <CaretDown
        size={12}
        color={Colors.textMuted}
        style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
      />
    </Pressable>
  )
}

function TechCard({ lines }: { lines: string[] }) {
  return (
    <View style={s.techCard}>
      {lines.map((l, i) => (
        <Text key={i} style={s.techLine}>{l}</Text>
      ))}
    </View>
  )
}

// ─── Algorithm content panels ─────────────────────────────────────────────────

function DijkstraContent({
  step, departments, sourceId, targetId, totalSteps,
}: {
  step: VisualizationStep
  departments: NetworkNode[]
  sourceId: string | null
  targetId: string | null
  totalSteps: number
}) {
  const [open, setOpen] = useState(false)
  const path     = tracePath(sourceId, targetId, step.nodeStates, departments)
  const hops     = path.length > 1 ? path.length - 1 : 0
  const rawCost  = step.distances && targetId ? step.distances[targetId] : null
  const cost     = rawCost !== null && rawCost !== Infinity ? rawCost : '—'
  const checked  = Object.values(step.nodeStates).filter(
    (v) => v === 'settled' || v === 'path'
  ).length
  const srcName  = departments.find((d) => d.id === sourceId)?.name ?? 'Source'
  const tgtName  = departments.find((d) => d.id === targetId)?.name ?? 'Target'
  const found    = path.length > 1

  return (
    <>
      <Text style={s.headline}>
        {found
          ? `${hops} hop${hops !== 1 ? 's' : ''} to ${tgtName}`
          : `No route to ${tgtName}`}
      </Text>

      <View style={s.metricsRow}>
        <MetricBlock value={hops}    label="Hops" />
        <View style={s.metricSep} />
        <MetricBlock value={cost}    label="Path cost" />
        <View style={s.metricSep} />
        <MetricBlock value={checked} label="Checked" />
      </View>

      {found && (
        <>
          <Rule />
          <View style={s.section}>
            <SectionLabel text="ROUTE" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.pathRow}>
                {path.map((id, i) => {
                  const name = departments.find((d) => d.id === id)?.name ?? id
                  return (
                    <React.Fragment key={id}>
                      <View style={[s.chip, s.chipPrimary]}>
                        <Text style={[s.chipText, { color: Colors.primary }]}>{name}</Text>
                      </View>
                      {i < path.length - 1 && (
                        <ArrowRight size={11} color={Colors.pale} style={s.pathArrow} />
                      )}
                    </React.Fragment>
                  )
                })}
              </View>
            </ScrollView>
          </View>
        </>
      )}

      <Rule />

      <View style={s.section}>
        <SectionLabel text="WHAT THIS MEANS" />
        <Text style={s.body}>
          {found
            ? `Traffic from ${srcName} to ${tgtName} crosses ${hops} device${hops !== 1 ? 's' : ''}. Every hop adds forwarding latency. This is the lowest-cost path through the current topology.`
            : `No route exists between ${srcName} and ${tgtName}. The segments are not peered, or an intermediate link is missing. Open the Departments tab and verify peer connections.`}
        </Text>
      </View>

      <TechToggle open={open} onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        setOpen(v => !v)
      }} />
      {open && (
        <TechCard lines={[
          'Method: lowest-cost graph traversal',
          `Total steps: ${totalSteps}   ·   Nodes checked: ${checked}`,
          'Each link is evaluated once. The cheapest path to each device is locked in before the search continues.',
        ]} />
      )}
    </>
  )
}

function PrimsContent({
  step, departments,
}: {
  step: VisualizationStep
  departments: NetworkNode[]
}) {
  const [open, setOpen] = useState(false)
  const edgeCount  = step.mstEdges?.length ?? 0
  const cost       = step.mstCost ?? 0
  const totalLinks = Math.floor(
    departments.reduce((sum, d) => sum + d.peers.length, 0) / 2
  )
  const redundant  = Math.max(0, totalLinks - edgeCount)

  return (
    <>
      <Text style={s.headline}>
        {edgeCount} cable{edgeCount !== 1 ? 's' : ''} — minimum backbone
      </Text>

      <View style={s.metricsRow}>
        <MetricBlock value={edgeCount} label="Cables" />
        <View style={s.metricSep} />
        <MetricBlock value={cost}      label="Total cost" />
        <View style={s.metricSep} />
        <MetricBlock value={redundant} label="Redundant" />
      </View>

      <Rule />

      <View style={s.section}>
        <SectionLabel text="WHAT THIS MEANS" />
        <Text style={s.body}>
          {`These ${edgeCount} cable${edgeCount !== 1 ? 's' : ''} are the minimum needed to keep every device connected. `}
          {redundant > 0
            ? `The other ${redundant} link${redundant !== 1 ? 's' : ''} are redundant for basic connectivity — useful for failover, but not required.`
            : `Every link is load-bearing. Removing any one of them would disconnect at least one device.`}
        </Text>
      </View>

      <Rule />

      <View style={s.section}>
        <SectionLabel text="BACKBONE LINKS" />
        <View style={s.chipWrap}>
          {(step.mstEdges ?? []).map((e) => {
            const a = departments.find((d) => d.id === e.source)?.name ?? e.source
            const b = departments.find((d) => d.id === e.target)?.name ?? e.target
            return (
              <View key={`${e.source}→${e.target}`} style={s.edgePill}>
                <Text style={s.edgePillText}>{a}</Text>
                <ArrowRight size={9} color={Colors.textMuted} />
                <Text style={s.edgePillText}>{b}</Text>
                <Text style={s.edgeCost}>w{e.weight}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <TechToggle open={open} onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        setOpen(v => !v)
      }} />
      {open && (
        <TechCard lines={[
          'Method: minimum spanning tree from a root node',
          `Cost: ${cost}   ·   Backbone cables: ${edgeCount}`,
          'At each step, the cheapest link to an unconnected device is chosen and added to the tree.',
        ]} />
      )}
    </>
  )
}

function CycleContent({
  step, departments, totalSteps,
}: {
  step: VisualizationStep
  departments: NetworkNode[]
  totalSteps: number
}) {
  const [open, setOpen] = useState(false)
  const cycleIds  = Object.keys(step.nodeStates).filter((id) => step.nodeStates[id] === 'cycle')
  const hasCycle  = cycleIds.length > 0
  const accentCol = hasCycle ? Colors.error : Colors.success

  return (
    <>
      <Text style={[s.headline, { color: accentCol }]}>
        {hasCycle ? 'Routing loop found' : 'No loops detected'}
      </Text>

      <View style={s.metricsRow}>
        <MetricBlock value={cycleIds.length} label="Devices in loop" />
        <View style={s.metricSep} />
        <MetricBlock value={totalSteps}      label="Paths traced" />
        <View style={s.metricSep} />
        <MetricBlock value={hasCycle ? 'Fail' : 'Pass'} label="Status" />
      </View>

      {hasCycle && (
        <>
          <Rule />
          <View style={s.section}>
            <SectionLabel text="LOOP INVOLVES" />
            <View style={s.chipWrap}>
              {cycleIds.map((id) => {
                const name = departments.find((d) => d.id === id)?.name ?? id
                return (
                  <View key={id} style={[s.chip, { borderColor: Colors.error + '40', backgroundColor: Colors.error + '0C' }]}>
                    <Text style={[s.chipText, { color: Colors.error }]}>{name}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        </>
      )}

      <Rule />

      <View style={s.section}>
        <SectionLabel text="WHAT THIS MEANS" />
        <Text style={s.body}>
          {hasCycle
            ? `A loop exists between the devices above. Any broadcast frame entering this loop circulates without stopping — no Layer 2 TTL mechanism prevents it. This causes broadcast storms that can saturate all links. Remove the link that closes the loop, or enable Spanning Tree Protocol.`
            : `No loops found. Packets will always make forward progress toward their destination. This topology is safe to deploy without loop-prevention protocols at the routing layer.`}
        </Text>
      </View>

      <TechToggle open={open} onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        setOpen(v => !v)
      }} />
      {open && (
        <TechCard lines={[
          'Method: depth-first path tracing with state marking',
          `Total steps: ${totalSteps}`,
          'A loop is confirmed when a trace reaches a device that is already part of the current active trace path.',
        ]} />
      )}
    </>
  )
}

function TopoContent({
  step, departments, totalSteps,
}: {
  step: VisualizationStep
  departments: NetworkNode[]
  totalSteps: number
}) {
  const [open, setOpen] = useState(false)
  const sorted = step.sortedResult ?? []

  return (
    <>
      <Text style={s.headline}>
        {sorted.length} device{sorted.length !== 1 ? 's' : ''} — startup order ready
      </Text>

      <View style={s.metricsRow}>
        <MetricBlock value={sorted.length} label="Ordered" />
        <View style={s.metricSep} />
        <MetricBlock value={totalSteps}    label="Steps" />
      </View>

      <Rule />

      <View style={s.section}>
        <SectionLabel text="BRING UP IN THIS ORDER" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.pathRow}>
            {sorted.map((id, i) => {
              const name = departments.find((d) => d.id === id)?.name ?? id
              return (
                <React.Fragment key={id}>
                  <View style={s.topoChip}>
                    <Text style={s.topoNum}>{i + 1}</Text>
                    <Text style={s.topoName}>{name}</Text>
                  </View>
                  {i < sorted.length - 1 && (
                    <ArrowRight size={11} color={Colors.pale} style={s.pathArrow} />
                  )}
                </React.Fragment>
              )
            })}
          </View>
        </ScrollView>
      </View>

      <Rule />

      <View style={s.section}>
        <SectionLabel text="WHAT THIS MEANS" />
        <Text style={s.body}>
          Bring devices online in the numbered order above. Each device's upstream dependencies — routers, switches, or DHCP servers — will already be running before it initialises. Powering up out of order risks missed adjacencies and configuration errors.
        </Text>
      </View>

      <TechToggle open={open} onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        setOpen(v => !v)
      }} />
      {open && (
        <TechCard lines={[
          'Method: dependency-order traversal',
          `Total steps: ${totalSteps}`,
          'Devices with no pending dependencies are started first. Their removal unlocks the next tier, repeating until all devices are ordered.',
        ]} />
      )}
    </>
  )
}

// ─── Root sheet ───────────────────────────────────────────────────────────────

export function AlgorithmInsightSheet({
  visible, onClose, onReplay,
  algorithm, currentStep, departments,
  sourceId, targetId, totalSteps,
}: Props) {
  if (!algorithm || !currentStep) return null

  function body() {
    if (!currentStep || !algorithm) return null
    switch (algorithm) {
      case 'dijkstra':
      case 'aStar':
        return <DijkstraContent step={currentStep} departments={departments} sourceId={sourceId} targetId={targetId} totalSteps={totalSteps} />
      case 'prims':
        return <PrimsContent step={currentStep} departments={departments} />
      case 'cycleDetection':
        return <CycleContent step={currentStep} departments={departments} totalSteps={totalSteps} />
      case 'topologicalSort':
        return <TopoContent step={currentStep} departments={departments} totalSteps={totalSteps} />
      default:
        return null
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={580}>
      {/* Fixed header — outside ScrollView so it stays pinned */}
      <View style={s.header}>
        <View style={s.headerMeta}>
          <View style={s.tag}>
            <Text style={s.tagText}>{phaseTag(algorithm as Algorithm)}</Text>
          </View>
          <Text style={s.headerTitle}>{analysisLabel(algorithm as Algorithm)}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
          <X size={15} color={Colors.textMuted} />
        </Pressable>
      </View>

      <View style={s.headerRule} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {body()}

        <Rule />

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [s.replayBtn, pressed && { opacity: 0.8 }]}
          onPress={() => { onReplay(); onClose() }}
        >
          <Text style={s.replayText}>Step through replay</Text>
          <ArrowRight size={14} color={Colors.primary} />
        </Pressable>
      </ScrollView>
    </BottomSheet>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header (outside scroll)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  tag: {
    backgroundColor: Colors.ice,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 0.7,
  },
  headerTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  headerRule: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
    marginBottom: 4,
  },

  // Scroll body
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 14,
  },

  // Headline
  headline: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 21,
    color: Colors.textPrimary,
    lineHeight: 27,
  },

  // Metrics row — 3 equal columns separated by 1px rules
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  metricValue: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 26,
    color: Colors.textPrimary,
    lineHeight: 32,
  },
  metricLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metricSep: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },

  // Horizontal rule between sections
  rule: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // Section block
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.7,
  },

  // Body text
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Path / sequence row
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pathArrow: { marginHorizontal: 4 },

  // Chips
  chip: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipPrimary: {
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '0C',
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textPrimary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  // Topo numbered chip
  topoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  topoNum: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: Colors.primary,
  },
  topoName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textPrimary,
  },

  // Edge pill (Prim's backbone links)
  edgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  edgePillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textPrimary,
  },
  edgeCost: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 2,
  },

  // Technical details
  techToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  techToggleText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
  },
  techCard: {
    backgroundColor: Colors.ice,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 4,
  },
  techLine: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Replay CTA
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  replayText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
  },
})
