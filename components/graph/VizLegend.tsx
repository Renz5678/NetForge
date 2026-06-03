// VizLegend.tsx
// Small overlay legend that explains the algorithm visualization color language.
// Rendered as a React Native View (not Skia) so it sits above the canvas.
// Dismissible via the X button.

import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Colors } from '@/constants/colors'
import type { AlgorithmType } from '@/types'
import { X } from 'phosphor-react-native'

type LegendItem = {
  color: string
  label: string
  border?: string
  dashed?: boolean
}

const COMMON_ITEMS: LegendItem[] = [
  { color: Colors.vizUnvisited, label: 'Unvisited' },
  { color: Colors.vizInQueue, label: 'In Queue' },
  { color: Colors.vizSettled, label: 'Settled / Done' },
  { color: Colors.vizPath, label: 'Final Path' },
]

const CYCLE_ITEMS: LegendItem[] = [
  { color: Colors.vizUnvisited, label: 'Unvisited' },
  { color: Colors.vizInStack, label: 'In DFS Stack' },
  { color: Colors.vizSettled, label: 'Fully Processed' },
  { color: Colors.vizCycle, label: 'Cycle Detected' },
]

const TOPO_ITEMS: LegendItem[] = [
  { color: Colors.vizUnvisited, label: 'Waiting' },
  { color: Colors.vizInQueue, label: 'In BFS Queue' },
  { color: Colors.vizSettled, label: 'Sorted' },
]

const MST_ITEMS: LegendItem[] = [
  { color: Colors.vizUnvisited, label: 'Not Reached' },
  { color: Colors.vizInQueue, label: 'Frontier (Cut)' },
  { color: Colors.vizMstEdge, label: 'In MST' },
  { color: Colors.vizCandidate, label: 'Candidate Edge', dashed: true },
]

function getLegendItems(algorithm: AlgorithmType): LegendItem[] {
  switch (algorithm) {
    case 'cycleDetection': return CYCLE_ITEMS
    case 'topologicalSort': return TOPO_ITEMS
    case 'prims': return MST_ITEMS
    default: return COMMON_ITEMS
  }
}

function getAlgorithmLabel(algorithm: AlgorithmType): string {
  switch (algorithm) {
    case 'dijkstra': return 'Dijkstra'
    case 'aStar': return 'A* Search'
    case 'cycleDetection': return 'Cycle Detection'
    case 'topologicalSort': return 'Topological Sort'
    case 'prims': return 'Optimal Wiring'
    case 'pathfindingComparison': return 'Route Comparison'
  }
}

type VizLegendProps = {
  algorithm: AlgorithmType
  onDismiss: () => void
  hideClose?: boolean
}

export function VizLegend({ algorithm, onDismiss, hideClose }: VizLegendProps) {
  const items = getLegendItems(algorithm)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{getAlgorithmLabel(algorithm)}</Text>
        {!hideClose && (
          <Pressable onPress={onDismiss} style={styles.closeBtn} hitSlop={8}>
            <X size={12} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>
      {items.map((item, i) => (
        <View key={i} style={styles.row}>
          <View
            style={[
              styles.dot,
              { backgroundColor: item.color },
              item.dashed && styles.dotDashed,
            ]}
          />
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 160,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotDashed: {
    borderRadius: 2,
    width: 18,
    height: 4,
  },
  label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
  },
})
