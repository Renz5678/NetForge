// AlgorithmVisualizerPanel.tsx
// The main algorithm visualization panel.
// Subscribes to useVisualizationStore for all state.

import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Animated,
  LayoutAnimation,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/constants/colors'
import { useVisualizationStore, SPEED_MS } from '@/stores/useVisualizationStore'
import { DataStructureDisplay } from './DataStructureDisplay'
import { AlgorithmInsightSheet } from './AlgorithmInsightSheet'
import { useHaptics } from '@/hooks/useHaptics'
import type { Department } from '@/types'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  CaretLeft,
  CaretRight,
  Info,
  ArrowRight,
  ArrowsLeftRight,
  Compass,
  Target,
} from 'phosphor-react-native'
import type { ComparisonResult } from '@/stores/useVisualizationStore'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.45
const COLLAPSED_HEIGHT = 220

type AlgorithmVisualizerPanelProps = {
  departments: Department[]
}

function getAlgorithmLabel(algorithm: string): string {
  switch (algorithm) {
    case 'dijkstra': return 'Shortest Route Analysis'
    case 'aStar': return 'Guided Path Search'
    case 'cycleDetection': return 'Loop Detection'
    case 'topologicalSort': return 'Deployment Order Analysis'
    case 'prims': return 'Optimal Cabling Plan'
    case 'pathfindingComparison': return 'Route Algorithm Comparison'
    default: return algorithm
  }
}

function getAlgorithmTechnicalName(algorithm: string): string {
  switch (algorithm) {
    case 'dijkstra': return "Dijkstra's SPF Algorithm"
    case 'aStar': return 'A* Heuristic Search'
    case 'cycleDetection': return 'DFS Cycle Detection'
    case 'topologicalSort': return "Kahn's Topological Sort"
    case 'prims': return "Prim's Minimum Spanning Tree"
    case 'pathfindingComparison': return 'Dijkstra vs A* Side-by-Side'
    default: return algorithm
  }
}

function getExplanationColor(explanation: string): string {
  const expLower = explanation.toLowerCase()
  if (expLower.includes('cycle') || expLower.includes('back-edge')) {
    return Colors.vizCycle
  }
  if (expLower.includes('settl') || expLower.includes('added to mst') || expLower.includes('complete') || expLower.includes('done') || expLower.includes('found')) {
    return Colors.vizSettled
  }
  if (expLower.includes('relax') || expLower.includes('updating cost') || expLower.includes('update cost') || expLower.includes('in queue') || expLower.includes('added to queue')) {
    return Colors.vizInQueue
  }
  return Colors.textPrimary
}

function reconstructPathFromSet(
  sourceId: string | null,
  targetId: string | null,
  nodeStates: Record<string, string>,
  departments: Department[]
): string[] {
  if (!sourceId || !targetId) return []
  
  // Find all node IDs in path
  const pathSet = new Set<string>()
  Object.keys(nodeStates).forEach((id) => {
    if (nodeStates[id] === 'path') {
      pathSet.add(id)
    }
  })
  
  if (pathSet.size === 0) return []
  
  // Trace path from source to target
  const path: string[] = [sourceId]
  let current = sourceId
  const visited = new Set<string>([sourceId])
  
  while (current !== targetId) {
    const dept = departments.find((d) => d.id === current)
    if (!dept) break
    const next = dept.peers.find((p) => pathSet.has(p) && !visited.has(p))
    if (!next) {
      // Undirected reverse link trace fallback
      const rev = departments.find((d) => d.peers.includes(current) && pathSet.has(d.id) && !visited.has(d.id))
      if (!rev) break
      current = rev.id
    } else {
      current = next
    }
    path.push(current)
    visited.add(current)
    if (path.length > 50) break // safety break
  }
  
  return path
}

export function AlgorithmVisualizerPanel({ departments }: AlgorithmVisualizerPanelProps) {
  const insets = useSafeAreaInsets()
  const haptics = useHaptics()
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current
  const [showHint, setShowHint] = useState(false)
  const [showTechDetails, setShowTechDetails] = useState(false)
  const [showInsight, setShowInsight] = useState(false)
  const hasHapticsOnComplete = useRef(false)
  const hasShownInsight = useRef(false)

  const isActive = useVisualizationStore((s) => s.isActive)
  const algorithm = useVisualizationStore((s) => s.algorithm)
  const currentStepIndex = useVisualizationStore((s) => s.currentStepIndex)
  const totalSteps = useVisualizationStore((s) => s.totalSteps)
  const currentStep = useVisualizationStore((s) => s.currentStep)
  const isPlaying = useVisualizationStore((s) => s.isPlaying)
  const speed = useVisualizationStore((s) => s.speed)
  const isExpanded = useVisualizationStore((s) => s.isExpanded)
  const showSteps = useVisualizationStore((s) => s.showSteps)

  const sourceId = useVisualizationStore((s) => s.sourceId)
  const targetId = useVisualizationStore((s) => s.targetId)

  const { stopVisualization, play, pause, stepForward, stepBack, setStep, setSpeed, setIsExpanded, setShowSteps, _advanceStep } =
    useVisualizationStore()

  const comparisonResult = useVisualizationStore((s) => s.comparisonResult)

  const totalStepsVal = totalSteps
  const progress = totalStepsVal > 1 ? currentStepIndex / (totalStepsVal - 1) : 0
  const explanationColor = currentStep ? getExplanationColor(currentStep.explanation) : Colors.textPrimary
  const currentPanelHeight = showSteps ? (isExpanded ? PANEL_HEIGHT : COLLAPSED_HEIGHT) : 72

  const deptList = departments.map((d) => ({ id: d.id, name: d.name }))

  // Auto-play timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        _advanceStep()
      }, SPEED_MS[speed])
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, speed, _advanceStep])

  // Slide-up / slide-down animation
  useEffect(() => {
    const targetY = isActive ? 0 : currentPanelHeight
    if (isActive) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }).start()
    } else {
      Animated.timing(translateY, {
        toValue: targetY,
        duration: 240,
        useNativeDriver: true,
      }).start()
    }
  }, [isActive, isExpanded, showSteps, translateY])

  // Haptic feedback when algorithm completes
  const isCompleted = totalStepsVal > 0 && currentStepIndex === totalStepsVal - 1
  useEffect(() => {
    if (!isActive || !isCompleted || !currentStep) return
    if (hasHapticsOnComplete.current) return
    hasHapticsOnComplete.current = true
    // Detect cycle at completion
    const hasCycle = Object.values(currentStep.nodeStates ?? {}).some((s) => s === 'cycle')
    if (hasCycle) {
      haptics.error()
    } else {
      haptics.success()
    }

    // Auto-show insight sheet 600ms after completion
    if (!hasShownInsight.current) {
      hasShownInsight.current = true
      setTimeout(() => setShowInsight(true), 600)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleted, isActive, currentStep])

  // Reset completion haptic + insight flags when algorithm resets
  useEffect(() => {
    hasHapticsOnComplete.current = false
    hasShownInsight.current = false
    setShowInsight(false)
  }, [algorithm, isActive])

  // Reset hint state on step change
  useEffect(() => {
    setShowHint(false)
  }, [currentStepIndex])

  if (!isActive || !algorithm) return null

  // Shared sheet element — rendered in ALL return paths that can follow completion
  const insightSheetEl = (
    <AlgorithmInsightSheet
      visible={showInsight}
      onClose={() => setShowInsight(false)}
      onReplay={() => {
        setIsExpanded(true)
        setShowSteps(true)
        setShowInsight(false)
      }}
      algorithm={algorithm as any}
      currentStep={currentStep}
      departments={departments}
      sourceId={sourceId}
      targetId={targetId}
      totalSteps={totalSteps}
    />
  )

  // ── Pathfinding Comparison — static result card (no step animation) ──────────
  if (algorithm === 'pathfindingComparison' && comparisonResult) {
    const srcName = departments.find((d) => d.id === comparisonResult.sourceId)?.name ?? comparisonResult.sourceId
    const dstName = departments.find((d) => d.id === comparisonResult.targetId)?.name ?? comparisonResult.targetId

    const dj = comparisonResult.dijkstra
    const as = comparisonResult.aStar

    // Determine winner by nodes visited (fewer = more efficient)
    const astarWins = dj && as && as.nodesVisited < dj.nodesVisited
    const dijkstraWins = dj && as && dj.nodesVisited < as.nodesVisited
    const tied = dj && as && dj.nodesVisited === as.nodesVisited

    const getName = (id: string) => departments.find((d) => d.id === id)?.name ?? id

    return (
      <>
        <Animated.View
          style={[
            styles.comparisonPanel,
            { transform: [{ translateY }], paddingBottom: insets.bottom + 8 },
          ]}
      >
        {/* Header */}
        <View style={styles.comparisonHeader}>
          <ArrowsLeftRight size={18} color={Colors.primary} weight="duotone" />
          <Text style={styles.comparisonTitle}>Route Algorithm Comparison</Text>
          <Pressable onPress={stopVisualization} hitSlop={8}>
            <X size={16} color={Colors.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.comparisonRoute}>
          {srcName} → {dstName}
        </Text>

        {/* Winner banner */}
        {(astarWins || dijkstraWins || tied) && (
          <View style={[
            styles.winnerBanner,
            { backgroundColor: astarWins ? `${Colors.vizPath}15` : dijkstraWins ? `${Colors.primary}12` : `${Colors.success}12` },
          ]}>
            <Text style={[styles.winnerText, { color: astarWins ? Colors.vizPath : dijkstraWins ? Colors.primary : Colors.success }]}>
              {tied
                ? '⚖ Both algorithms visited the same number of nodes'
                : astarWins
                ? `⚡ A* explored ${dj!.nodesVisited - as!.nodesVisited} fewer nodes — spatial heuristic paid off`
                : `🧭 Dijkstra matched A* efficiency on this topology`}
            </Text>
          </View>
        )}

        {/* Side-by-side columns */}
        <View style={styles.comparisonColumns}>
          {/* Dijkstra column */}
          <View style={[styles.comparisonCol, { borderColor: `${Colors.primary}30` }]}>
            <View style={styles.comparisonColHeader}>
              <Compass size={14} color={Colors.primary} weight="duotone" />
              <Text style={[styles.comparisonColTitle, { color: Colors.primary }]}>Dijkstra</Text>
              {dijkstraWins && <Text style={styles.comparisonBadge}>WINNER</Text>}
            </View>
            {dj ? (
              <>
                <View style={styles.comparisonMetricRow}>
                  <Text style={styles.comparisonMetricVal}>{dj.hops}</Text>
                  <Text style={styles.comparisonMetricLbl}>hops</Text>
                </View>
                <View style={styles.comparisonMetricRow}>
                  <Text style={styles.comparisonMetricVal}>{dj.nodesVisited}</Text>
                  <Text style={styles.comparisonMetricLbl}>nodes explored</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {dj.path.map((id, idx) => (
                      <React.Fragment key={id}>
                        <View style={[styles.comparisonChip, { borderColor: `${Colors.primary}30`, backgroundColor: `${Colors.primary}08` }]}>
                          <Text style={[styles.comparisonChipText, { color: Colors.primary }]} numberOfLines={1}>{getName(id)}</Text>
                        </View>
                        {idx < dj.path.length - 1 && <ArrowRight size={10} color={Colors.textMuted} />}
                      </React.Fragment>
                    ))}
                  </View>
                </ScrollView>
              </>
            ) : (
              <Text style={styles.comparisonNoPath}>No path</Text>
            )}
          </View>

          {/* A* column */}
          <View style={[styles.comparisonCol, { borderColor: `${Colors.vizPath}40` }]}>
            <View style={styles.comparisonColHeader}>
              <Target size={14} color={Colors.vizPath} weight="duotone" />
              <Text style={[styles.comparisonColTitle, { color: Colors.vizPath }]}>A*</Text>
              {astarWins && <Text style={[styles.comparisonBadge, { backgroundColor: `${Colors.vizPath}20`, color: Colors.vizPath }]}>WINNER</Text>}
            </View>
            {as ? (
              <>
                <View style={styles.comparisonMetricRow}>
                  <Text style={[styles.comparisonMetricVal, { color: Colors.vizPath }]}>{as.hops}</Text>
                  <Text style={styles.comparisonMetricLbl}>hops</Text>
                </View>
                <View style={styles.comparisonMetricRow}>
                  <Text style={[styles.comparisonMetricVal, { color: Colors.vizPath }]}>{as.nodesVisited}</Text>
                  <Text style={styles.comparisonMetricLbl}>nodes explored</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {as.path.map((id, idx) => (
                      <React.Fragment key={id}>
                        <View style={[styles.comparisonChip, { borderColor: `${Colors.vizPath}40`, backgroundColor: `${Colors.vizPath}08` }]}>
                          <Text style={[styles.comparisonChipText, { color: Colors.vizPath }]} numberOfLines={1}>{getName(id)}</Text>
                        </View>
                        {idx < as.path.length - 1 && <ArrowRight size={10} color={Colors.textMuted} />}
                      </React.Fragment>
                    ))}
                  </View>
                </ScrollView>
              </>
            ) : (
              <Text style={styles.comparisonNoPath}>No path</Text>
            )}
          </View>
        </View>
        </Animated.View>
        {insightSheetEl}
      </>
    )
  }

  if (!currentStep) return null

  const handleToggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setIsExpanded(!isExpanded)
  }

  // Render a minimal floating bar if showSteps is disabled
  if (!showSteps) {
    return (
      <>
        <Animated.View
          style={[
            styles.miniPanel,
            {
              height: 72,
              transform: [{ translateY }],
            },
          ]}
      >
        <View style={styles.miniContainer}>
          <View style={styles.miniTextSection}>
            <View style={styles.miniTitleRow}>
              <View style={styles.miniDot} />
              <Text style={styles.miniTitle} numberOfLines={1}>
                {getAlgorithmLabel(algorithm)}
              </Text>
            </View>
            <Text style={styles.miniSubtitle}>
              Step {currentStepIndex + 1} of {totalStepsVal} • {Math.round(progress * 100)}%
            </Text>
          </View>

          <View style={styles.miniActions}>
            {/* Play/Pause */}
            <Pressable
              onPress={isPlaying ? pause : play}
              style={styles.miniActionBtn}
              hitSlop={8}
            >
              {isPlaying ? (
                <Pause size={14} color={Colors.primary} weight="fill" />
              ) : (
                <Play size={14} color={Colors.primary} weight="fill" />
              )}
            </Pressable>

            {/* Show Steps button */}
            <Pressable
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                setShowSteps(true)
                setIsExpanded(true)
              }}
              style={styles.miniStepsBtn}
              hitSlop={8}
            >
              <Text style={styles.miniStepsText}>Show Steps</Text>
            </Pressable>

            {/* Close */}
            <Pressable
              onPress={stopVisualization}
              style={styles.miniCloseBtn}
              hitSlop={8}
            >
              <X size={14} color={Colors.textMuted} />
            </Pressable>
          </View>
        </View>
        </Animated.View>
        {insightSheetEl}
      </>
    )
  }



  const renderResultSummary = () => {
    // Build a networking-first impact summary
    const buildImpactSummary = () => {
      if (algorithm === 'dijkstra' || algorithm === 'aStar') {
        const pathNodeIds = reconstructPathFromSet(sourceId, targetId, currentStep.nodeStates, departments)
        const hops = pathNodeIds.length > 0 ? pathNodeIds.length - 1 : 0
        const totalCost = currentStep.distances && targetId ? currentStep.distances[targetId] : null
        const srcName = departments.find((d) => d.id === sourceId)?.name ?? sourceId ?? 'Source'
        const tgtName = departments.find((d) => d.id === targetId)?.name ?? targetId ?? 'Target'
        const nodesEvaluated = Object.keys(currentStep.nodeStates).filter(
          (id) => currentStep.nodeStates[id] === 'settled' || currentStep.nodeStates[id] === 'path'
        ).length

        return {
          whatHappened: pathNodeIds.length > 0
            ? `Best route found: ${srcName} → ${tgtName} in ${hops} hop${hops !== 1 ? 's' : ''}.`
            : `No route exists between ${srcName} and ${tgtName}.`,
          whyItMatters: pathNodeIds.length > 0
            ? `Traffic between these devices will follow this ${hops}-hop path. Path cost: ${totalCost !== null && totalCost !== Infinity ? totalCost : 'N/A'}.`
            : `These devices cannot communicate. Check links and routing configuration.`,
          behindTheScenes: `${getAlgorithmTechnicalName(algorithm)} evaluated ${nodesEvaluated} device${nodesEvaluated !== 1 ? 's' : ''} and ${Object.keys(currentStep.distances ?? {}).length} links.`,
        }
      }
      if (algorithm === 'prims') {
        const edgeCount = currentStep.mstEdges?.length ?? 0
        const cost = currentStep.mstCost ?? 0
        const totalLinks = departments.reduce((sum, d) => sum + d.peers.length, 0) / 2
        const removed = Math.max(0, Math.round(totalLinks) - edgeCount)
        return {
          whatHappened: `Optimal cabling plan complete. ${edgeCount} links maintain full connectivity.`,
          whyItMatters: removed > 0
            ? `${removed} redundant link${removed !== 1 ? 's' : ''} identified. Removing them would not disconnect any device.`
            : `All links in your topology are necessary for full connectivity.`,
          behindTheScenes: `Prim's Minimum Spanning Tree grew from a root device, adding the lowest-cost crossing link at each step. Total MST weight: ${cost}.`,
        }
      }
      if (algorithm === 'cycleDetection') {
        const cycleNodes = Object.keys(currentStep.nodeStates).filter(
          (id) => currentStep.nodeStates[id] === 'cycle'
        )
        return {
          whatHappened: cycleNodes.length > 0
            ? `Routing loop detected involving ${cycleNodes.length} device${cycleNodes.length !== 1 ? 's' : ''}.`
            : `No routing loops found. Topology is loop-free.`,
          whyItMatters: cycleNodes.length > 0
            ? `Loops cause broadcast storms and routing instability. Fix the cyclic path before deploying.`
            : `Your network is safe to deploy. No circular dependencies were found.`,
          behindTheScenes: `DFS-based cycle detection traced all paths in the graph looking for back-edges that indicate cycles.`,
        }
      }
      if (algorithm === 'topologicalSort') {
        const sorted = currentStep.sortedResult ?? []
        return {
          whatHappened: `Startup sequence for ${sorted.length} device${sorted.length !== 1 ? 's' : ''} determined.`,
          whyItMatters: `Bringing devices online in this order ensures each device's upstream dependencies are ready first, preventing configuration failures.`,
          behindTheScenes: `Kahn's algorithm processed in-degree counts to find devices with no dependencies, placing them first in the startup order.`,
        }
      }
      return null
    }

    const impact = buildImpactSummary()

    if (algorithm === 'dijkstra' || algorithm === 'aStar') {
      const pathNodeIds = reconstructPathFromSet(sourceId, targetId, currentStep.nodeStates, departments)
      const hops = pathNodeIds.length > 0 ? pathNodeIds.length - 1 : 0
      const totalCost = currentStep.distances && targetId ? currentStep.distances[targetId] : null
      return (
        <View style={styles.resultContainer}>
          {/* Before / After story */}
          {impact && (
            <View style={styles.impactBlock}>
              <Text style={styles.impactWhatHappened}>{impact.whatHappened}</Text>
              <Text style={styles.impactWhyItMatters}>{impact.whyItMatters}</Text>
            </View>
          )}

          <Text style={styles.resultTitle}>Route Details</Text>
          <View style={styles.resultMetrics}>
            <View style={styles.resultMetricItem}>
              <Text style={styles.resultMetricVal}>{hops}</Text>
              <Text style={styles.resultMetricLbl}>Hops</Text>
            </View>
            <View style={styles.resultMetricItem}>
              <Text style={styles.resultMetricVal}>{totalCost !== null && totalCost !== Infinity ? totalCost : 'N/A'}</Text>
              <Text style={styles.resultMetricLbl}>Total Cost</Text>
            </View>
          </View>
          {pathNodeIds.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.resultScroll}>
              <View style={styles.resultPathRow}>
                {pathNodeIds.map((id, index) => {
                  const nodeName = departments.find((d) => d.id === id)?.name ?? id
                  return (
                    <React.Fragment key={id}>
                      <View style={styles.pathChip}>
                        <Text style={styles.pathChipText}>{nodeName}</Text>
                      </View>
                      {index < pathNodeIds.length - 1 && (
                        <ArrowRight size={14} color={Colors.textMuted} style={styles.pathArrow} />
                      )}
                    </React.Fragment>
                  )
                })}
              </View>
            </ScrollView>
          ) : (
            <Text style={styles.resultEmptyText}>No path was found between these segments.</Text>
          )}

          {/* Behind the scenes reveal */}
          {impact && (
            <Pressable
              style={styles.behindScenesToggle}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                setShowTechDetails(!showTechDetails)
              }}
            >
              <Info size={13} color={Colors.textMuted} />
              <Text style={styles.behindScenesText}>
                {showTechDetails ? 'Hide technical details' : 'Behind the scenes'}
              </Text>
            </Pressable>
          )}
          {showTechDetails && impact && (
            <View style={styles.behindScenesReveal}>
              <Text style={styles.behindScenesRevealText}>{impact.behindTheScenes}</Text>
            </View>
          )}
        </View>
      )
    }

    if (algorithm === 'prims') {
      const cost = currentStep.mstCost ?? 0
      const edgeCount = currentStep.mstEdges?.length ?? 0
      return (
        <View style={styles.resultContainer}>
          {impact && (
            <View style={styles.impactBlock}>
              <Text style={styles.impactWhatHappened}>{impact.whatHappened}</Text>
              <Text style={styles.impactWhyItMatters}>{impact.whyItMatters}</Text>
            </View>
          )}
          <Text style={styles.resultTitle}>Cabling Plan Summary</Text>
          <View style={styles.resultMetrics}>
            <View style={styles.resultMetricItem}>
              <Text style={styles.resultMetricVal}>{edgeCount}</Text>
              <Text style={styles.resultMetricLbl}>Links in Plan</Text>
            </View>
            <View style={styles.resultMetricItem}>
              <Text style={styles.resultMetricVal}>{cost}</Text>
              <Text style={styles.resultMetricLbl}>Total Cost</Text>
            </View>
          </View>
          {impact && (
            <Pressable
              style={styles.behindScenesToggle}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                setShowTechDetails(!showTechDetails)
              }}
            >
              <Info size={13} color={Colors.textMuted} />
              <Text style={styles.behindScenesText}>
                {showTechDetails ? 'Hide technical details' : 'Behind the scenes'}
              </Text>
            </Pressable>
          )}
          {showTechDetails && impact && (
            <View style={styles.behindScenesReveal}>
              <Text style={styles.behindScenesRevealText}>{impact.behindTheScenes}</Text>
            </View>
          )}
        </View>
      )
    }

    if (algorithm === 'cycleDetection') {
      const cycleNodes: string[] = []
      Object.keys(currentStep.nodeStates).forEach((id) => {
        if (currentStep.nodeStates[id] === 'cycle') {
          cycleNodes.push(id)
        }
      })

      return (
        <View style={styles.resultContainer}>
          {impact && (
            <View style={styles.impactBlock}>
              <Text style={styles.impactWhatHappened}>{impact.whatHappened}</Text>
              <Text style={styles.impactWhyItMatters}>{impact.whyItMatters}</Text>
            </View>
          )}
          <Text style={styles.resultTitle}>Loop Detection Result</Text>
          {cycleNodes.length > 0 ? (
            <View style={{ alignItems: 'center' }}>
              <View style={[styles.resultBadge, { backgroundColor: Colors.errorContainer, borderColor: Colors.error }]}>
                <Text style={[styles.resultBadgeText, { color: Colors.error }]}>ROUTING LOOP FOUND</Text>
              </View>
              <Text style={styles.resultInfoText}>
                A routing loop was detected. Packets would circulate indefinitely between these devices:
              </Text>
              <View style={styles.resultPathRow}>
                {cycleNodes.map((id) => {
                  const nodeName = departments.find((d) => d.id === id)?.name ?? id
                  return (
                    <View key={id} style={[styles.pathChip, { backgroundColor: Colors.errorContainer, borderColor: `${Colors.error}40` }]}>
                      <Text style={[styles.pathChipText, { color: Colors.error }]}>{nodeName}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <View style={[styles.resultBadge, { backgroundColor: Colors.successContainer, borderColor: Colors.success }]}>
                <Text style={[styles.resultBadgeText, { color: Colors.success }]}>LOOP FREE</Text>
              </View>
              <Text style={styles.resultInfoText}>
                No routing loops found. Your topology is safe to deploy.
              </Text>
            </View>
          )}
          {impact && (
            <Pressable
              style={styles.behindScenesToggle}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                setShowTechDetails(!showTechDetails)
              }}
            >
              <Info size={13} color={Colors.textMuted} />
              <Text style={styles.behindScenesText}>
                {showTechDetails ? 'Hide technical details' : 'Behind the scenes'}
              </Text>
            </Pressable>
          )}
          {showTechDetails && impact && (
            <View style={styles.behindScenesReveal}>
              <Text style={styles.behindScenesRevealText}>{impact.behindTheScenes}</Text>
            </View>
          )}
        </View>
      )
    }

    if (algorithm === 'topologicalSort') {
      const sorted = currentStep.sortedResult ?? []
      return (
        <View style={styles.resultContainer}>
          {impact && (
            <View style={styles.impactBlock}>
              <Text style={styles.impactWhatHappened}>{impact.whatHappened}</Text>
              <Text style={styles.impactWhyItMatters}>{impact.whyItMatters}</Text>
            </View>
          )}
          <Text style={styles.resultTitle}>Startup Sequence</Text>
          <Text style={styles.resultInfoText}>
            Bring devices online in this order to ensure upstream links are ready:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.resultScroll}>
            <View style={styles.resultPathRow}>
              {sorted.map((id, index) => {
                const nodeName = departments.find((d) => d.id === id)?.name ?? id
                return (
                  <React.Fragment key={id}>
                    <View style={[styles.pathChip, { borderColor: `${Colors.primary}30` }]}>
                      <Text style={[styles.pathChipText, { color: Colors.primary }]}>
                        {index + 1}. {nodeName}
                      </Text>
                    </View>
                    {index < sorted.length - 1 && (
                      <ArrowRight size={14} color={Colors.textMuted} style={styles.pathArrow} />
                    )}
                  </React.Fragment>
                )
              })}
            </View>
          </ScrollView>
          {impact && (
            <Pressable
              style={styles.behindScenesToggle}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                setShowTechDetails(!showTechDetails)
              }}
            >
              <Info size={13} color={Colors.textMuted} />
              <Text style={styles.behindScenesText}>
                {showTechDetails ? 'Hide technical details' : 'Behind the scenes'}
              </Text>
            </Pressable>
          )}
          {showTechDetails && impact && (
            <View style={styles.behindScenesReveal}>
              <Text style={styles.behindScenesRevealText}>{impact.behindTheScenes}</Text>
            </View>
          )}
        </View>
      )
    }

    return null
  }

  const defaultHint = () => {
    switch (algorithm) {
      case 'dijkstra': return 'OSPF routers use the same logic to choose next-hop routes. NetForge is calculating the lowest-cost path the same way.'
      case 'aStar': return 'A spatial heuristic guides the search toward the target, so fewer devices need to be evaluated than a full Dijkstra sweep.'
      case 'prims': return "NetForge is growing a 'minimum cabling tree' by always picking the cheapest available link that connects a new device."
      case 'cycleDetection': return 'DFS tracks which devices are currently being traced. A routing loop is detected when a device is encountered that is already in the current trace path.'
      case 'topologicalSort': return "Devices with no dependencies (nothing they need to wait for) are activated first. This mirrors how a real data center powers up hardware in dependency order."
      default: return 'This step is part of the automated analysis running on your network topology.'
    }
  }

  return (
    <>
      <Animated.View
        style={[
          styles.panel,
          {
          height: currentPanelHeight,
          transform: [{ translateY }],
          paddingBottom: insets.bottom + 8,
        },
      ]}
    >
      {/* Handle bar */}
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.algoBadge}>
            <Text style={styles.algoBadgeText}>NETWORK</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {getAlgorithmLabel(algorithm)}
          </Text>
        </View>
        
        {/* Toggle Details */}
        <Pressable
          onPress={handleToggleExpand}
          style={styles.expandButton}
          hitSlop={8}
        >
          <Text style={styles.expandText}>
            {isExpanded ? 'Hide Details ▽' : 'Show Details △'}
          </Text>
        </Pressable>

        <Pressable onPress={stopVisualization} style={styles.closeButton} hitSlop={8}>
          <X size={14} color={Colors.textMuted} />
        </Pressable>
      </View>

      {/* Tappable step counter chip + progress bar */}
      <View style={styles.progressRow}>
        <View style={styles.stepCounterChip}>
          <Pressable
            onPress={() => stepBack()}
            disabled={currentStepIndex === 0}
            style={styles.stepChipArrow}
            hitSlop={6}
          >
            <CaretLeft size={12} color={currentStepIndex === 0 ? Colors.pale : Colors.primary} weight="bold" />
          </Pressable>
          <Text style={styles.stepChipText}>
            {currentStepIndex + 1} / {totalStepsVal}
          </Text>
          <Pressable
            onPress={() => stepForward()}
            disabled={currentStepIndex === totalStepsVal - 1}
            style={styles.stepChipArrow}
            hitSlop={6}
          >
            <CaretRight size={12} color={currentStepIndex === totalStepsVal - 1 ? Colors.pale : Colors.primary} weight="bold" />
          </Pressable>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressPctText}>{Math.round(progress * 100)}%</Text>
      </View>

      {/* Explanation card or Result Summary */}
      {isCompleted ? (
        renderResultSummary()
      ) : (
        <View style={[styles.explanationCard, { borderLeftColor: explanationColor }]}>
          <Text style={[styles.explanationText, { color: explanationColor }]} numberOfLines={isExpanded ? undefined : 2}>
            {currentStep.explanation}
          </Text>
          
          {/* Why conceptual hint toggle */}
          {isExpanded && (
            <View style={{ marginTop: 8 }}>
              <Pressable
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                  setShowHint(!showHint)
                }}
                style={styles.whyToggle}
              >
                <Info size={14} color={Colors.primary} />
                <Text style={styles.whyToggleText}>{showHint ? 'Hide details' : 'Why this step?'}</Text>
              </Pressable>
              {showHint && (
                <Text style={styles.whyHintText}>
                  {currentStep.hint ?? defaultHint()}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Data structure display */}
      {isExpanded && !isCompleted && (
        <ScrollView
          style={styles.dataStructureContainer}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <DataStructureDisplay
            algorithm={algorithm}
            step={currentStep}
            departments={deptList}
          />
        </ScrollView>
      )}

      {/* Playback controls */}
      <View style={styles.controls}>
        {/* Step back */}
        <Pressable
          onPress={() => stepBack()}
          style={[styles.controlBtn, currentStepIndex === 0 && styles.controlBtnDisabled]}
          disabled={currentStepIndex === 0}
        >
          <SkipBack size={20} color={currentStepIndex === 0 ? Colors.pale : Colors.textPrimary} />
        </Pressable>

        {/* Play / Pause */}
        <Pressable
          onPress={isPlaying ? pause : play}
          style={[styles.controlBtn, styles.controlBtnPlay]}
        >
          {isPlaying ? (
            <Pause size={24} color={Colors.white} weight="fill" />
          ) : (
            <Play size={24} color={Colors.white} weight="fill" />
          )}
        </Pressable>

        {/* Step forward */}
        <Pressable
          onPress={() => stepForward()}
          style={[styles.controlBtn, currentStepIndex === totalStepsVal - 1 && styles.controlBtnDisabled]}
          disabled={currentStepIndex === totalStepsVal - 1}
        >
          <SkipForward size={20} color={currentStepIndex === totalStepsVal - 1 ? Colors.pale : Colors.textPrimary} />
        </Pressable>
      </View>

      {/* Speed selector / Result control buttons */}
      {isCompleted ? (
        <View style={styles.resultActionsRow}>
          <Pressable
            style={[styles.resultActionBtn, styles.resultActionBtnSecondary]}
            onPress={() => setStep(0)}
          >
            <Text style={styles.resultActionBtnTextSecondary}>Run Again</Text>
          </Pressable>
          <Pressable
            style={[styles.resultActionBtn, styles.resultActionBtnGhost]}
            onPress={() => {
              stopVisualization()
              // Auto-trigger options sheet
              const screen = departments.length >= 2
              if (screen) {
                // To trigger Change Algorithm: we close visualizer panel
              }
            }}
          >
            <Text style={styles.resultActionBtnTextGhost}>Change Algorithm</Text>
          </Pressable>
        </View>
      ) : (
        isExpanded && (
          <View style={styles.speedRow}>
            <Text style={styles.speedLabel}>Speed</Text>
            {(['slow', 'normal', 'fast'] as const).map((s) => (
              <Pressable
                key={s}
                style={[styles.speedChip, speed === s && styles.speedChipActive]}
                onPress={() => setSpeed(s)}
              >
                <Text style={[styles.speedChipText, speed === s && styles.speedChipTextActive]}>
                  {s === 'slow' ? '0.5×' : s === 'normal' ? '1×' : '3×'}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      )}
    </Animated.View>

      <AlgorithmInsightSheet
        visible={showInsight}
        onClose={() => setShowInsight(false)}
        onReplay={() => {
          setIsExpanded(true)
          setShowSteps(true)
          setShowInsight(false)
        }}
        algorithm={algorithm as any}
        currentStep={currentStep}
        departments={departments}
        sourceId={sourceId}
        targetId={targetId}
        totalSteps={totalSteps}
      />
    </>
  )
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingHorizontal: 16,
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  algoBadge: {
    backgroundColor: `${Colors.primary}15`,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  algoBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.textPrimary,
    flex: 1,
  },
  expandButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: `${Colors.primary}10`,
    marginRight: 8,
  },
  expandText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  stepCounterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.ice,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  stepChipArrow: {
    paddingHorizontal: 2,
  },
  stepChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
    minWidth: 44,
    textAlign: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressPctText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
  },
  explanationCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  explanationText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  whyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  whyToggleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
  },
  whyHintText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 6,
    backgroundColor: Colors.white,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dataStructureContainer: {
    flex: 1,
    marginBottom: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  controlBtnPlay: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  controlBtnDisabled: {
    opacity: 0.35,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 2,
    justifyContent: 'center',
  },
  speedLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginRight: 4,
  },
  speedChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  speedChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  speedChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  speedChipTextActive: {
    color: Colors.white,
  },
  miniPanel: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: Colors.white,
    borderRadius: 20,
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  miniContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  miniTextSection: {
    flex: 1,
    marginRight: 12,
  },
  miniTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  miniTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
  },
  miniSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  miniActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${Colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStepsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  miniStepsText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.white,
  },
  miniCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Results summary UI
  resultContainer: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    alignItems: 'stretch',
  },
  impactBlock: {
    backgroundColor: `${Colors.primary}08`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    gap: 4,
  },
  impactWhatHappened: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  impactWhyItMatters: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  behindScenesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  behindScenesText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
  },
  behindScenesReveal: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 4,
  },
  behindScenesRevealText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  resultTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  resultMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  resultMetricItem: {
    alignItems: 'center',
  },
  resultMetricVal: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.primary,
  },
  resultMetricLbl: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  resultScroll: {
    marginVertical: 4,
  },
  resultPathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  pathChip: {
    backgroundColor: Colors.ice,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pathChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textPrimary,
  },
  pathArrow: {
    marginHorizontal: 6,
  },
  resultEmptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.error,
    textAlign: 'center',
  },
  resultInfoText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  resultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  resultBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
  resultActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 4,
    paddingBottom: 2,
  },
  resultActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resultActionBtnSecondary: {
    backgroundColor: Colors.ice,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultActionBtnTextSecondary: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },
  resultActionBtnGhost: {
    backgroundColor: 'transparent',
  },
  resultActionBtnTextGhost: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textMuted,
  },

  // ── Pathfinding Comparison panel ────────────────────────────────────────────
  comparisonPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
    gap: 10,
    zIndex: 100,
  },
  comparisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  comparisonTitle: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.textPrimary,
  },
  comparisonRoute: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
  },
  winnerBanner: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  winnerText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 17,
  },
  comparisonColumns: {
    flexDirection: 'row',
    gap: 10,
  },
  comparisonCol: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    backgroundColor: Colors.surfaceAlt,
  },
  comparisonColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  comparisonColTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    flex: 1,
  },
  comparisonBadge: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
    color: Colors.primary,
    backgroundColor: `${Colors.primary}18`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  comparisonMetricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  comparisonMetricVal: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    color: Colors.primary,
  },
  comparisonMetricLbl: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  comparisonChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: 90,
  },
  comparisonChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
  },
  comparisonNoPath: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
  },
})
