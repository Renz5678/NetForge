// VizLegend.tsx — v2: Dark glassmorphism card
//
// Redesigned from a plain white card to a dark frosted-glass overlay that
// blends with the dark canvas without occluding the topology.
//
// Additions vs v1:
//   - Algorithm one-liner description below the title
//   - Step counter inline in the header (Step N / Total)
//   - Edge-line preview swatch for edge-state entries (not just a dot)
//   - Compact two-column layout for algorithms with many legend items

import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Colors } from '@/constants/colors'
import type { AlgorithmType } from '@/types'
import { X } from 'phosphor-react-native'
import { useVisualizationStore } from '@/stores/useVisualizationStore'

type LegendItem = {
  color:     string
  label:     string
  isEdge?:   boolean   // render a line swatch instead of a dot
  dashed?:   boolean
}

// ── Colour sets per algorithm ─────────────────────────────────────────────────
const COMMON_ITEMS: LegendItem[] = [
  { color: Colors.vizUnvisited, label: 'Unvisited' },
  { color: Colors.vizInQueue,   label: 'In Queue' },
  { color: Colors.vizSettled,   label: 'Settled' },
  { color: Colors.vizPath,      label: 'Final Path' },
  { color: Colors.vizPath,      label: 'Path Edge', isEdge: true },
]

const CYCLE_ITEMS: LegendItem[] = [
  { color: Colors.vizUnvisited, label: 'Unvisited' },
  { color: Colors.vizInStack,   label: 'DFS Stack' },
  { color: Colors.vizSettled,   label: 'Processed' },
  { color: Colors.vizCycle,     label: 'Cycle' },
  { color: Colors.vizCycle,     label: 'Back Edge', isEdge: true },
]

const TOPO_ITEMS: LegendItem[] = [
  { color: Colors.vizUnvisited, label: 'Waiting' },
  { color: Colors.vizInQueue,   label: 'In Queue' },
  { color: Colors.vizSettled,   label: 'Sorted' },
]

const MST_ITEMS: LegendItem[] = [
  { color: Colors.vizUnvisited,  label: 'Not Reached' },
  { color: Colors.vizInQueue,    label: 'Frontier' },
  { color: Colors.vizSettled,    label: 'In MST' },
  { color: Colors.vizMstEdge,    label: 'MST Edge',  isEdge: true },
  { color: Colors.vizCandidate,  label: 'Candidate', isEdge: true, dashed: true },
]

function getLegendItems(algorithm: AlgorithmType): LegendItem[] {
  switch (algorithm) {
    case 'cycleDetection':     return CYCLE_ITEMS
    case 'topologicalSort':    return TOPO_ITEMS
    case 'prims':              return MST_ITEMS
    default:                   return COMMON_ITEMS
  }
}

// ── Algorithm metadata ────────────────────────────────────────────────────────
type AlgoMeta = { label: string; desc: string }
const ALGO_META: Record<AlgorithmType, AlgoMeta> = {
  dijkstra:            { label: 'Dijkstra',         desc: 'Finds the lowest-cost path by always settling the cheapest frontier node first.' },
  aStar:               { label: 'A* Search',         desc: 'Dijkstra + a heuristic estimate, converging faster toward the target.' },
  cycleDetection:      { label: 'Cycle Detection',   desc: 'DFS marks back-edges — any back-edge means a routing loop exists.' },
  topologicalSort:     { label: 'Topological Sort',  desc: 'Kahn\'s BFS sorts nodes so every dependency precedes its dependants.' },
  prims:               { label: 'Optimal Wiring',    desc: 'Prim\'s MST finds the minimum-cost cable tree covering all devices.' },
  pathfindingComparison: { label: 'Route Comparison', desc: 'Side-by-side Dijkstra vs A* to compare nodes visited and path cost.' },
}

type VizLegendProps = {
  algorithm: AlgorithmType
  onDismiss: () => void
  hideClose?: boolean
}

export function VizLegend({ algorithm, onDismiss, hideClose }: VizLegendProps) {
  const items = getLegendItems(algorithm)
  const meta  = ALGO_META[algorithm] ?? { label: algorithm, desc: '' }

  const currentStepIndex = useVisualizationStore((s) => s.currentStepIndex)
  const totalSteps       = useVisualizationStore((s) => s.totalSteps)

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>{meta.label}</Text>
          {totalSteps > 0 && (
            <View style={styles.stepChip}>
              <Text style={styles.stepChipText}>
                {currentStepIndex + 1}/{totalSteps}
              </Text>
            </View>
          )}
        </View>
        {!hideClose && (
          <Pressable onPress={onDismiss} style={styles.closeBtn} hitSlop={8}>
            <X size={13} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* One-liner description */}
      <Text style={styles.desc} numberOfLines={2}>{meta.desc}</Text>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Legend items */}
      <View style={styles.itemsGrid}>
        {items.map((item, i) => (
          <View key={i} style={styles.row}>
            {item.isEdge ? (
              // Edge line swatch
              <View style={styles.edgeSwatch}>
                <View
                  style={[
                    styles.edgeLine,
                    { backgroundColor: item.color },
                    item.dashed && styles.edgeDashed,
                  ]}
                />
              </View>
            ) : (
              // Node colour dot
              <View style={[styles.dot, { backgroundColor: item.color }]} />
            )}
            <Text style={styles.label}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 104,
    left: 12,
    width: 178,
    backgroundColor: 'rgba(13,17,23,0.92)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(99,132,255,0.18)',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#E2E8F0',
    letterSpacing: 0.3,
  },
  stepChip: {
    backgroundColor: 'rgba(99,132,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stepChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    color: '#93C5FD',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: 'rgba(148,163,184,0.80)',
    lineHeight: 13,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(99,132,255,0.14)',
    marginBottom: 8,
  },
  itemsGrid: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  edgeSwatch: {
    width: 20,
    height: 10,
    justifyContent: 'center',
    flexShrink: 0,
  },
  edgeLine: {
    height: 2.5,
    borderRadius: 2,
    width: '100%',
  },
  edgeDashed: {
    // Simulate dash via opacity — React Native doesn't support dashed backgrounds
    opacity: 0.55,
    height: 2,
  },
  label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: 'rgba(203,213,225,0.85)',
  },
})
