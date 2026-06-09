/**
 * components/graph/VizLegend.tsx
 *
 * Minimal floating color key shown during visualization.
 * Shows only: step counter + colored dots with short state labels.
 * No algorithm name, no description text.
 */

import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Colors } from '@/constants/colors'
import { X } from 'phosphor-react-native'
import { useVisualizationStore } from '@/stores/useVisualizationStore'
import type { AlgorithmType } from '@/types'

type Item = { color: string; label: string; isEdge?: boolean }

const ROUTING_ITEMS: Item[] = [
  { color: Colors.vizUnvisited, label: 'Unvisited' },
  { color: Colors.vizInQueue,   label: 'Queued' },
  { color: Colors.vizSettled,   label: 'Settled' },
  { color: Colors.vizPath,      label: 'Route' },
]

const CYCLE_ITEMS: Item[] = [
  { color: Colors.vizUnvisited, label: 'Unvisited' },
  { color: Colors.vizInStack,   label: 'Active' },
  { color: Colors.vizSettled,   label: 'Done' },
  { color: Colors.vizCycle,     label: 'Loop' },
]

const TOPO_ITEMS: Item[] = [
  { color: Colors.vizUnvisited, label: 'Waiting' },
  { color: Colors.vizInQueue,   label: 'Ready' },
  { color: Colors.vizSettled,   label: 'Placed' },
]

const MST_ITEMS: Item[] = [
  { color: Colors.vizUnvisited, label: 'Unvisited' },
  { color: Colors.vizInQueue,   label: 'Frontier' },
  { color: Colors.vizSettled,   label: 'Connected' },
  { color: Colors.vizMstEdge,   label: 'Backbone', isEdge: true },
]

function getItems(alg: AlgorithmType): Item[] {
  switch (alg) {
    case 'cycleDetection':  return CYCLE_ITEMS
    case 'topologicalSort': return TOPO_ITEMS
    case 'prims':           return MST_ITEMS
    default:                return ROUTING_ITEMS
  }
}

type Props = {
  algorithm: AlgorithmType
  onDismiss: () => void
  hideClose?: boolean
}

export function VizLegend({ algorithm, onDismiss, hideClose }: Props) {
  const step  = useVisualizationStore((s) => s.currentStepIndex)
  const total = useVisualizationStore((s) => s.totalSteps)
  const items = getItems(algorithm)

  return (
    <View style={st.card}>
      {/* Step counter + close */}
      <View style={st.topRow}>
        {total > 0 && (
          <Text style={st.stepText}>
            {step + 1} <Text style={st.stepOf}>/ {total}</Text>
          </Text>
        )}
        {!hideClose && (
          <Pressable onPress={onDismiss} hitSlop={10} style={st.closeBtn}>
            <X size={11} color="rgba(148,163,184,0.7)" />
          </Pressable>
        )}
      </View>

      {/* Color key */}
      <View style={st.items}>
        {items.map((item, i) => (
          <View key={i} style={st.row}>
            {item.isEdge ? (
              <View style={st.edgeSwatch}>
                <View style={[st.edgeLine, { backgroundColor: item.color }]} />
              </View>
            ) : (
              <View style={[st.dot, { backgroundColor: item.color }]} />
            )}
            <Text style={st.label}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 104,
    left: 12,
    width: 130,
    backgroundColor: 'rgba(13,17,23,0.88)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(99,132,255,0.14)',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: 'rgba(203,213,225,0.9)',
  },
  stepOf: {
    fontFamily: 'Inter_400Regular',
    color: 'rgba(148,163,184,0.6)',
  },
  closeBtn: {
    padding: 2,
  },
  items: {
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  edgeSwatch: {
    width: 16,
    height: 8,
    justifyContent: 'center',
    flexShrink: 0,
  },
  edgeLine: {
    height: 2,
    borderRadius: 1,
    width: '100%',
  },
  label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: 'rgba(203,213,225,0.75)',
  },
})
