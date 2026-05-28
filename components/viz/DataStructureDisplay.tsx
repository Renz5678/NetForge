// DataStructureDisplay.tsx
// Renders the algorithm's internal data structure state for the current visualization step.
// Shows: priority queue (Dijkstra/A*), DFS stack (Cycle Detection),
//        in-degree map + BFS queue (Topo Sort), candidate edges (Prim's).

import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Colors } from '@/constants/colors'
import type { AlgorithmType, VisualizationStep } from '@/types'

type DataStructureDisplayProps = {
  algorithm: AlgorithmType
  step: VisualizationStep
  departments: Array<{ id: string; name: string }>
}

function label(id: string, depts: Array<{ id: string; name: string }>): string {
  return depts.find((d) => d.id === id)?.name ?? id
}

function distStr(d: number | undefined): string {
  if (d === undefined) return '∞'
  if (d === Infinity) return '∞'
  return typeof d === 'number' && !Number.isInteger(d) ? d.toFixed(2) : String(d)
}

// ── Priority Queue (Dijkstra / A*) ──────────────────────────────────────────
function PriorityQueueDisplay({
  step,
  depts,
  showHeuristic,
}: {
  step: VisualizationStep
  depts: Array<{ id: string; name: string }>
  showHeuristic: boolean
}) {
  const queue = step.priorityQueue ?? []
  const distances = step.distances ?? {}

  return (
    <View style={ds.section}>
      <Text style={ds.sectionTitle}>{showHeuristic ? 'Open Set (f = g + h)' : 'Priority Queue'}</Text>
      {queue.length === 0 ? (
        <Text style={ds.emptyText}>Queue is empty</Text>
      ) : (
        queue.map((entry, i) => {
          const isCurrentNode = entry.id === step.currentNode
          return (
            <View key={`${entry.id}-${i}`} style={[ds.queueRow, isCurrentNode && ds.queueRowActive]}>
              <View style={[ds.rankBadge, isCurrentNode && ds.rankBadgeActive]}>
                <Text style={[ds.rankText, isCurrentNode && ds.rankTextActive]}>{i + 1}</Text>
              </View>
              <Text style={[ds.queueNodeName, isCurrentNode && ds.activeText]} numberOfLines={1}>
                {label(entry.id, depts)}
              </Text>
              <View style={ds.scoreGroup}>
                {showHeuristic ? (
                  <>
                    <Text style={ds.scoreLabel}>g={distStr(entry.dist)}</Text>
                    {entry.h !== undefined && <Text style={ds.scoreLabel}>h={distStr(entry.h)}</Text>}
                    <Text style={[ds.scoreLabel, ds.fScore]}>f={distStr(entry.f ?? entry.dist)}</Text>
                  </>
                ) : (
                  <Text style={ds.scoreLabel}>{distStr(entry.dist)} hops</Text>
                )}
              </View>
            </View>
          )
        })
      )}

      {/* Distances summary */}
      <Text style={[ds.sectionTitle, { marginTop: 10 }]}>Distance Table</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={ds.distTable}>
          {Object.entries(distances)
            .sort(([, a], [, b]) => (a === Infinity ? 1 : b === Infinity ? -1 : a - b))
            .map(([id, dist]) => (
              <View key={id} style={ds.distCell}>
                <Text style={ds.distNodeName} numberOfLines={1}>{label(id, depts)}</Text>
                <Text style={[ds.distValue, dist === Infinity && ds.distInfinity]}>
                  {distStr(dist)}
                </Text>
              </View>
            ))}
        </View>
      </ScrollView>
    </View>
  )
}

// ── DFS Stack (Cycle Detection) ───────────────────────────────────────────────
function DFSStackDisplay({
  step,
  depts,
}: {
  step: VisualizationStep
  depts: Array<{ id: string; name: string }>
}) {
  const stack = step.dfsStack ?? []

  return (
    <View style={ds.section}>
      <Text style={ds.sectionTitle}>DFS Recursion Stack ({stack.length} deep)</Text>
      {stack.length === 0 ? (
        <Text style={ds.emptyText}>Stack is empty</Text>
      ) : (
        <View style={ds.stackContainer}>
          {[...stack].reverse().map((id, i) => {
            const isTop = i === 0
            const isBackEdge = step.backEdge?.from === id || step.backEdge?.to === id
            return (
              <View
                key={`${id}-${i}`}
                style={[
                  ds.stackFrame,
                  isTop && ds.stackFrameTop,
                  isBackEdge && ds.stackFrameCycle,
                ]}
              >
                <View style={[ds.stackDot, isBackEdge ? ds.stackDotCycle : (isTop ? ds.stackDotActive : ds.stackDotNormal)]} />
                <Text style={[ds.stackNodeName, isBackEdge && ds.cycleText]}>
                  {label(id, depts)}
                </Text>
                {isTop && <Text style={ds.stackTopLabel}>← current</Text>}
                {isBackEdge && step.backEdge && <Text style={ds.cycleTag}>CYCLE EDGE</Text>}
              </View>
            )
          })}
        </View>
      )}

      {step.backEdge && (
        <View style={ds.backEdgeCallout}>
          <Text style={ds.backEdgeText}>
            ⚠ Back-edge: {label(step.backEdge.from, depts)} → {label(step.backEdge.to, depts)}
          </Text>
        </View>
      )}
    </View>
  )
}

// ── In-Degree Map + Queue (Topological Sort) ─────────────────────────────────
function TopoDisplay({
  step,
  depts,
}: {
  step: VisualizationStep
  depts: Array<{ id: string; name: string }>
}) {
  const inDegreeMap = step.inDegreeMap ?? {}
  const queue = step.topoQueue ?? []
  const sortedResult = step.sortedResult ?? []

  return (
    <View style={ds.section}>
      {/* BFS Queue */}
      <Text style={ds.sectionTitle}>BFS Queue (in-degree = 0)</Text>
      {queue.length === 0 ? (
        <Text style={ds.emptyText}>Queue is empty</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={ds.pillRow}>
            {queue.map((id, i) => (
              <View key={i} style={ds.queuePill}>
                <Text style={ds.queuePillText}>{label(id, depts)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* In-Degree Table */}
      <Text style={[ds.sectionTitle, { marginTop: 10 }]}>In-Degree Map</Text>
      <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
        {Object.entries(inDegreeMap)
          .sort(([, a], [, b]) => a - b)
          .map(([id, deg]) => (
            <View key={id} style={ds.inDegreeRow}>
              <Text style={ds.inDegreeName} numberOfLines={1}>{label(id, depts)}</Text>
              <View style={[ds.inDegreeBadge, deg === 0 && ds.inDegreeBadgeReady]}>
                <Text style={[ds.inDegreeValue, deg === 0 && ds.inDegreeValueReady]}>{deg}</Text>
              </View>
            </View>
          ))}
      </ScrollView>

      {/* Sorted Result */}
      {sortedResult.length > 0 && (
        <>
          <Text style={[ds.sectionTitle, { marginTop: 10 }]}>Sorted Order So Far</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={ds.pillRow}>
              {sortedResult.map((id, i) => (
                <View key={i} style={ds.resultPill}>
                  <Text style={ds.resultPillOrder}>{i + 1}</Text>
                  <Text style={ds.resultPillName}>{label(id, depts)}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}
    </View>
  )
}

// ── Candidate Edges + MST (Prim's) ───────────────────────────────────────────
function PrimsDisplay({
  step,
  depts,
}: {
  step: VisualizationStep
  depts: Array<{ id: string; name: string }>
}) {
  const mstEdges = step.mstEdges ?? []
  const candidateEdges = step.candidateEdges ?? []
  const totalCost = step.mstCost ?? 0
  const currentEdge = step.currentEdge

  return (
    <View style={ds.section}>
      {/* Running cost counter */}
      <View style={ds.costRow}>
        <Text style={ds.costLabel}>Total Wiring Cost</Text>
        <Text style={ds.costValue}>{totalCost} hop{totalCost !== 1 ? 's' : ''}</Text>
        <Text style={ds.edgeCount}>{mstEdges.length} cable{mstEdges.length !== 1 ? 's' : ''} laid</Text>
      </View>

      {/* Currently considered edge */}
      {currentEdge && (
        <View style={ds.currentEdgeCard}>
          <Text style={ds.currentEdgeLabel}>Adding to MST</Text>
          <Text style={ds.currentEdgeName}>
            {label(currentEdge.source, depts)} — {label(currentEdge.target, depts)}
          </Text>
          <Text style={ds.currentEdgeCost}>Cost: {currentEdge.weight}</Text>
        </View>
      )}

      {/* Frontier crossing edges */}
      <Text style={ds.sectionTitle}>Cut Frontier (sorted by cost)</Text>
      {candidateEdges.length === 0 ? (
        <Text style={ds.emptyText}>No frontier edges</Text>
      ) : (
        candidateEdges.slice(0, 5).map((edge, i) => (
          <View key={i} style={[ds.candidateRow, i === 0 && ds.candidateRowCheapest]}>
            <Text style={ds.candidateRank}>{i === 0 ? '★' : `${i + 1}.`}</Text>
            <Text style={ds.candidateName} numberOfLines={1}>
              {label(edge.source, depts)} → {label(edge.target, depts)}
            </Text>
            <Text style={[ds.candidateCost, i === 0 && ds.candidateCostCheapest]}>
              {edge.weight}
            </Text>
          </View>
        ))
      )}

      {/* Accepted MST edges */}
      {mstEdges.length > 0 && (
        <>
          <Text style={[ds.sectionTitle, { marginTop: 10 }]}>Accepted MST Cables</Text>
          {mstEdges.map((edge, i) => (
            <View key={i} style={ds.mstEdgeRow}>
              <View style={ds.mstDot} />
              <Text style={ds.mstEdgeName}>
                {label(edge.source, depts)} — {label(edge.target, depts)}
              </Text>
              <Text style={ds.mstEdgeCost}>{edge.weight}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  )
}

export function DataStructureDisplay({ algorithm, step, departments }: DataStructureDisplayProps) {
  const depts = departments

  switch (algorithm) {
    case 'dijkstra':
      return <PriorityQueueDisplay step={step} depts={depts} showHeuristic={false} />
    case 'aStar':
      return <PriorityQueueDisplay step={step} depts={depts} showHeuristic={true} />
    case 'cycleDetection':
      return <DFSStackDisplay step={step} depts={depts} />
    case 'topologicalSort':
      return <TopoDisplay step={step} depts={depts} />
    case 'prims':
      return <PrimsDisplay step={step} depts={depts} />
    default:
      return null
  }
}

const ds = StyleSheet.create({
  section: { gap: 6 },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Priority Queue
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 8,
    marginBottom: 3,
  },
  queueRowActive: {
    backgroundColor: `${Colors.primary}15`,
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
  },
  rankBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeActive: { backgroundColor: Colors.primary },
  rankText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.textMuted,
  },
  rankTextActive: { color: Colors.white },
  queueNodeName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textPrimary,
    flex: 1,
  },
  activeText: { color: Colors.primary },
  scoreGroup: { flexDirection: 'row', gap: 6 },
  scoreLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  fScore: { color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
  distTable: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  distCell: {
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 60,
  },
  distNodeName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
  },
  distValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  distInfinity: { color: Colors.textMuted },
  // DFS Stack
  stackContainer: { gap: 2 },
  stackFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 6,
  },
  stackFrameTop: {
    backgroundColor: `${Colors.vizInStack}20`,
    borderWidth: 1,
    borderColor: Colors.vizInStack,
  },
  stackFrameCycle: {
    backgroundColor: `${Colors.vizCycle}20`,
    borderWidth: 1,
    borderColor: Colors.vizCycle,
  },
  stackDot: { width: 8, height: 8, borderRadius: 4 },
  stackDotNormal: { backgroundColor: Colors.vizInStack },
  stackDotActive: { backgroundColor: Colors.vizInStack },
  stackDotCycle: { backgroundColor: Colors.vizCycle },
  stackNodeName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textPrimary,
    flex: 1,
  },
  cycleText: { color: Colors.vizCycle },
  stackTopLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.vizInStack,
  },
  cycleTag: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: Colors.vizCycle,
    letterSpacing: 0.3,
  },
  backEdgeCallout: {
    marginTop: 6,
    backgroundColor: `${Colors.vizCycle}15`,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: `${Colors.vizCycle}40`,
  },
  backEdgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.vizCycle,
  },
  // Topo Sort
  pillRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  queuePill: {
    backgroundColor: `${Colors.vizInQueue}30`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.vizInQueue,
  },
  queuePillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textPrimary,
  },
  inDegreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  inDegreeName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textPrimary,
    flex: 1,
  },
  inDegreeBadge: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  inDegreeBadgeReady: { backgroundColor: `${Colors.vizSettled}30` },
  inDegreeValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  inDegreeValueReady: { color: Colors.vizSettled },
  resultPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.vizSettled}20`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.vizSettled,
  },
  resultPillOrder: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.vizSettled,
  },
  resultPillName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textPrimary,
  },
  // Prim's
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Colors.vizMstEdge}15`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  costLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
  costValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.vizMstEdge,
  },
  edgeCount: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  currentEdgeCard: {
    backgroundColor: `${Colors.vizInQueue}20`,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.vizInQueue,
  },
  currentEdgeLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  currentEdgeName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
  },
  currentEdgeCost: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 6,
    marginBottom: 3,
  },
  candidateRowCheapest: {
    backgroundColor: `${Colors.vizCandidate}20`,
    borderWidth: 1,
    borderColor: Colors.vizCandidate,
  },
  candidateRank: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    width: 18,
    textAlign: 'center',
  },
  candidateName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textPrimary,
    flex: 1,
  },
  candidateCost: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  candidateCostCheapest: { color: Colors.vizCandidate },
  mstEdgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  mstDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.vizMstEdge,
  },
  mstEdgeName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textPrimary,
    flex: 1,
  },
  mstEdgeCost: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textSecondary,
  },
})
