// NetworkGraph.tsx
// Full canvas graph renderer using @shopify/react-native-skia.
// Pan + pinch zoom via GestureDetector.
// Node tap: single = tooltip, two nodes = auto-Dijkstra sweep then path highlight.
// Visualization mode: subscribes to useVisualizationStore and applies
// viz color overlays to nodes and edges via the vizState/vizEdgeState props.
//
// KEY BEHAVIOUR CHANGE:
// When two nodes are selected, Dijkstra fires automatically at 'fast' speed
// with no expanded panel (showSteps=false). The algorithm is *visible* as
// the frontier sweeps but the user never had to select "Dijkstra" from a menu.
// After it completes, an AlgorithmToast badge appears: "Shortest path · Dijkstra · N hops"
// with a "Step-by-step ›" link that opens the full visualizer panel.

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Dimensions,
  Platform,
} from 'react-native'
import {
  Canvas,
  Group,
  useFont,
  RoundedRect,
  Text as SkiaText,
  matchFont,
  Circle,
  Paint,
} from '@shopify/react-native-skia'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useDerivedValue,
} from 'react-native-reanimated'
import { Colors } from '@/constants/colors'
import { useGraphLayout } from '@/hooks/useGraphLayout'
import { findShortestPath } from '@/lib/algorithms/dijkstra'
import { validateConnectivity } from '@/lib/algorithms/bfsValidator'
import { useVisualizationStore } from '@/stores/useVisualizationStore'
import { GraphNodeComponent, NODE_WIDTH, NODE_HEIGHT } from './GraphNode'
import { GraphEdgeComponent } from './GraphEdge'
import { PathOverlay } from './PathOverlay'
import { MSTOverlay } from './MSTOverlay'
import { VizLegend } from './VizLegend'
import { AlgorithmToast, type ToastData } from '@/components/ui/AlgorithmToast'
import { BottomSheet } from '@/components/ui/BottomSheet'
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  CornersOut,
  ArrowCounterClockwise,
  Play,
  Warning,
  X,
} from 'phosphor-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { CoachMark } from '@/components/ui/CoachMark'
import { ExplainModeToggle } from '@/components/ui/ExplainModeToggle'
import type { Department, PathResult } from '@/types'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const CANVAS_HEIGHT = SCREEN_HEIGHT - 200

const systemFont = matchFont({
  fontFamily: Platform.OS === 'ios' ? 'Helvetica' : 'sans-serif',
  fontSize: 13,
  fontWeight: 'bold',
})

// Dot-grid density: every N canvas pixels a dot is drawn
const GRID_SPACING = 28
const GRID_DOT_RADIUS = 1.2

type NetworkGraphProps = {
  departments: Department[]
  onPathFound?: (result: PathResult | null, nodeIds: string[]) => void
  onVisualize?: () => void
  onWarningPress?: () => void
  // Validation summary for the live badge
  validationWarnings?: number
  validationPassed?: boolean
}

export function NetworkGraph({
  departments,
  onPathFound,
  onVisualize,
  onWarningPress,
  validationWarnings = 0,
  validationPassed,
}: NetworkGraphProps) {
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [pathResult, setPathResult] = useState<PathResult | null>(null)
  const [showLegend, setShowLegend] = useState(true)
  const [toast, setToast] = useState<ToastData | null>(null)
  const [showFailureSheet, setShowFailureSheet] = useState(false)

  const [showCoachMark, setShowCoachMark] = useState(false)
  const [showAlgoHint, setShowAlgoHint] = useState(true)
  const [sessionHasSelectedTwoNodes, setSessionHasSelectedTwoNodes] = useState(false)

  useEffect(() => {
    if (showAlgoHint) {
      const timer = setTimeout(() => setShowAlgoHint(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [showAlgoHint])

  // One-time coach mark check on mount
  useEffect(() => {
    const checkHint = async () => {
      try {
        const hasSeen = await AsyncStorage.getItem('hasSeenAlgorithmHint')
        if (!hasSeen) {
          setShowCoachMark(true)
        }
      } catch (err) {
        console.warn('AsyncStorage error checking coach mark hint:', err)
      }
    }
    checkHint()
  }, [])

  const handleDismissCoachMark = async () => {
    setShowCoachMark(false)
    try {
      await AsyncStorage.setItem('hasSeenAlgorithmHint', 'true')
    } catch (err) {
      console.warn('AsyncStorage error saving coach mark hint:', err)
    }
  }

  // Mirror of selectedNodes in a ref so handleTap can read the current
  // value without a functional updater — critical to avoid calling setState
  // (setPathResult, onPathFound) inside another setState's updater function.
  const selectedNodesRef = useRef<string[]>([])

  // Pan & zoom
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const scale = useSharedValue(1)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)
  const savedScale = useSharedValue(1)

  const { nodes, edges } = useGraphLayout(departments, SCREEN_WIDTH, CANVAS_HEIGHT)

  // Visualization store — read current step state
  const vizActive = useVisualizationStore((s) => s.isActive)
  const vizAlgorithm = useVisualizationStore((s) => s.algorithm)
  const currentStep = useVisualizationStore((s) => s.currentStep)
  const isExpanded = useVisualizationStore((s) => s.isExpanded)
  const isPlaying = useVisualizationStore((s) => s.isPlaying)
  const criticalNodeIds = useVisualizationStore((s) => s.criticalNodeIds)
  const failedNodeId = useVisualizationStore((s) => s.failedNodeId)
  const failureSimResult = useVisualizationStore((s) => s.failureSimResult)
  const { startVisualization, stopVisualization, setShowSteps, setIsExpanded,
          setFailedNodeId, setFailureSimResult, clearFailureSim } = useVisualizationStore()

  useEffect(() => {
    if (vizActive) {
      setShowAlgoHint(false)
    }
  }, [vizActive])

  // Track if the current viz is an auto-triggered Dijkstra (not user-selected)
  // so we can show the toast and "Step-by-step" CTA instead of the full panel
  const autoVizRef = useRef(false)

  // Stop auto viz and dismiss toast when it finishes playing
  const prevIsPlaying = useRef(isPlaying)
  React.useEffect(() => {
    if (autoVizRef.current && prevIsPlaying.current && !isPlaying && vizActive) {
      // Auto-viz finished playing — stop it so the path overlay takes over
      stopVisualization()
      autoVizRef.current = false
    }
    prevIsPlaying.current = isPlaying
  }, [isPlaying, vizActive])

  // Auto-center camera offset when visualization is active/expanded
  React.useEffect(() => {
    if (vizActive) {
      if (isExpanded) {
        translateY.value = withSpring(-140)
        scale.value = withSpring(0.78)
      } else {
        translateY.value = withSpring(-40)
        scale.value = withSpring(0.9)
      }
    } else {
      translateY.value = withSpring(0)
      scale.value = withSpring(1)
      translateX.value = withSpring(0)
    }
  }, [vizActive, isExpanded, translateY, translateX, scale])

  const hitTestNode = useCallback(
    (touchX: number, touchY: number): string | null => {
      const canvasX = (touchX - translateX.value) / scale.value
      const canvasY = (touchY - translateY.value) / scale.value

      for (const node of nodes) {
        const nx = node.x - NODE_WIDTH / 2
        const ny = node.y - NODE_HEIGHT / 2
        if (
          canvasX >= nx &&
          canvasX <= nx + NODE_WIDTH &&
          canvasY >= ny &&
          canvasY <= ny + NODE_HEIGHT
        ) {
          return node.id
        }
      }
      return null
    },
    [nodes, translateX, translateY, scale]
  )

  const handleTap = useCallback(
    (touchX: number, touchY: number) => {
      // In viz mode, taps are ignored (no node selection interference)
      if (vizActive) return

      const tappedId = hitTestNode(touchX, touchY)
      // Read current selection from ref — avoids functional updater pattern
      // which would cause setState-during-render errors when calling onPathFound
      const prev = selectedNodesRef.current

      if (!tappedId) {
        selectedNodesRef.current = []
        setSelectedNodes([])
        setPathResult(null)
        setToast(null)
        onPathFound?.(null, [])
        return
      }

      if (prev.length === 0) {
        // First node selected — just highlight it
        selectedNodesRef.current = [tappedId]
        setSelectedNodes([tappedId])
        return
      }

      if (prev.length === 1) {
        if (prev[0] === tappedId) return // tapped same node again

        const srcId = prev[0]
        const tgtId = tappedId
        const newSelected = [srcId, tgtId]
        selectedNodesRef.current = newSelected
        setSelectedNodes(newSelected)
        setShowAlgoHint(false)
        setSessionHasSelectedTwoNodes(true)

        // Compute path — all state updates are at handler top level, never inside
        // a setState updater, so React won't complain about setState-during-render
        const pathFindResult = findShortestPath(departments, srcId, tgtId)
        setPathResult(pathFindResult)
        onPathFound?.(pathFindResult, newSelected)

        // ── Auto-trigger Dijkstra visualization ──────────────────────────
        // Dynamic import to avoid a circular dep at module level
        import('@/lib/algorithms/dijkstraVisualizer').then(({ buildDijkstraSteps }) => {
          const vizResult = buildDijkstraSteps(departments, srcId, tgtId)
          const steps = vizResult.steps
          if (steps.length > 0) {
            autoVizRef.current = true
            setToast(null) // clear any existing toast while viz plays
            startVisualization('dijkstra', steps, {
              sourceId: srcId,
              targetId: tgtId,
              showSteps: false, // mini-panel only, no expanded data structure view
            })

            // Show toast after viz auto-play finishes (~steps * speed interval)
            const hops = pathFindResult?.hops ?? 0
            const srcName = departments.find((d) => d.id === srcId)?.name ?? srcId
            const tgtName = departments.find((d) => d.id === tgtId)?.name ?? tgtId
            setTimeout(() => {
              const toastLabel = pathFindResult
                ? `${srcName} \u2192 ${tgtName} \u00b7 ${hops} hop${hops !== 1 ? 's' : ''} \u00b7 Shortest Route Analysis`
                : `No route found between ${srcName} and ${tgtName}`
              setToast({
                label: toastLabel,
                success: !!pathFindResult,
                onReplay: () => {
                  startVisualization('dijkstra', steps, {
                    sourceId: srcId,
                    targetId: tgtId,
                    showSteps: true,
                  })
                  setIsExpanded(true)
                  setShowSteps(true)
                  setToast(null)
                },
              })
            }, (steps.length * 200) + 200)
          }
        })
        return
      }

      // Third+ tap — reset to new single selection
      selectedNodesRef.current = [tappedId]
      setSelectedNodes([tappedId])
      setPathResult(null)
      setToast(null)
      onPathFound?.(null, [])
    },
    [hitTestNode, departments, onPathFound, vizActive, startVisualization, setIsExpanded, setShowSteps]
  )

  // ── Failure simulation ────────────────────────────────────────────────────
  // Long-pressing a node (≥600ms) simulates its removal:
  //   1. Filter departments, remove the failed node
  //   2. Re-run BFS to find nodes that become isolated
  //   3. Check Dijkstra between remaining nodes to find broken paths
  //   4. Store results → GraphNode renders failed/isolated overlays
  const handleLongPress = useCallback(
    (touchX: number, touchY: number) => {
      if (vizActive) return  // don't interfere with viz playback

      const pressedId = hitTestNode(touchX, touchY)
      if (!pressedId) return

      // Toggle off if pressing the already-failed node
      if (failedNodeId === pressedId) {
        clearFailureSim()
        setShowFailureSheet(false)
        return
      }

      // Simulate removal of this node
      const filteredDepts = departments.filter((d) => d.id !== pressedId)
      const failedNode = departments.find((d) => d.id === pressedId)
      const failedName = failedNode?.name ?? pressedId

      // Find isolated nodes (BFS reachability after removal)
      const { isolated: isolatedNames } = validateConnectivity(filteredDepts)
      // Convert names back to IDs
      const nameToId = new Map(departments.map((d) => [d.name, d.id]))
      const isolatedIds = isolatedNames.map((name) => nameToId.get(name) ?? '').filter(Boolean)

      // Find pairs with broken Dijkstra paths
      const brokenPaths: [string, string][] = []
      const filteredIds = filteredDepts.map((d) => d.id)
      for (let i = 0; i < filteredIds.length; i++) {
        for (let j = i + 1; j < filteredIds.length; j++) {
          const src = filteredIds[i]
          const dst = filteredIds[j]
          const path = findShortestPath(filteredDepts, src, dst)
          if (!path) {
            brokenPaths.push([src, dst])
          }
        }
      }

      setFailedNodeId(pressedId)
      setFailureSimResult({ isolatedNodes: isolatedIds, brokenPaths })
      setShowFailureSheet(true)

      // Reset selection state
      selectedNodesRef.current = []
      setSelectedNodes([])
      setPathResult(null)
      setToast(null)
      onPathFound?.(null, [])
    },
    [hitTestNode, vizActive, departments, failedNodeId, clearFailureSim,
     setFailedNodeId, setFailureSimResult, onPathFound]
  )

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX
      translateY.value = savedTranslateY.value + e.translationY
    })

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value
    })
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.3), 5)
    })

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      handleTap(e.x, e.y)
    })

  const longPressGesture = Gesture.LongPress()
    .minDuration(600)
    .runOnJS(true)
    .onStart((e) => {
      handleLongPress(e.x, e.y)
    })

  const composedGesture = Gesture.Exclusive(
    Gesture.Simultaneous(panGesture, pinchGesture),
    longPressGesture,
    tapGesture
  )

  const handleReset = () => {
    setSelectedNodes([])
    setPathResult(null)
    setToast(null)
    onPathFound?.(null, [])
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }))

  // Resolve viz state for each node from the current step snapshot
  const getNodeVizState = (nodeId: string) => {
    if (!vizActive || !currentStep) return undefined
    return currentStep.nodeStates[nodeId]
  }

  // Resolve viz state for each edge from the current step snapshot
  const getEdgeVizState = (srcId: string, tgtId: string) => {
    if (!vizActive || !currentStep?.edgeStates) return undefined
    const key = `${srcId}→${tgtId}`
    const reverseKey = `${tgtId}→${srcId}`
    return currentStep.edgeStates[key] ?? currentStep.edgeStates[reverseKey]
  }

  // MST overlay data for Prim's visualization
  const mstEdges = vizActive && vizAlgorithm === 'prims' ? (currentStep?.mstEdges ?? []) : []
  const candidateEdge = vizActive && vizAlgorithm === 'prims' ? currentStep?.currentEdge : null

  // Failure simulation helpers
  const failedNode = failedNodeId ? departments.find((d) => d.id === failedNodeId) : null
  const isolatedNodeIds = failureSimResult?.isolatedNodes ?? []
  const brokenPathCount = failureSimResult?.brokenPaths.length ?? 0

  // Derived transform value forces Skia canvas redraws when zoom/pan values update on UI thread
  const skiaTransform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ])

  // Build dot-grid positions (static, computed once at render)
  const dotGridPoints = React.useMemo(() => {
    const pts: { x: number; y: number }[] = []
    const cols = Math.ceil(SCREEN_WIDTH / GRID_SPACING) + 1
    const rows = Math.ceil(CANVAS_HEIGHT / GRID_SPACING) + 1
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pts.push({ x: c * GRID_SPACING, y: r * GRID_SPACING })
      }
    }
    return pts
  }, [])

  // Validation badge color
  const hasBadge = departments.length > 0 && validationPassed !== undefined
  const badgeColor = validationPassed ? Colors.success : Colors.warning
  const badgeBg = validationPassed ? Colors.successContainer : Colors.warningContainer
  const badgeLabel = validationPassed
    ? '✓ Valid'
    : `⚠ ${validationWarnings} warning${validationWarnings !== 1 ? 's' : ''}`

  return (
    <View style={styles.container}>
      {/* Viz mode banner */}
      {vizActive && !autoVizRef.current && (
        <View style={styles.vizBanner}>
          <View style={styles.vizDot} />
          <Text style={styles.vizBannerText}>
            Visualization Mode Active
          </Text>
        </View>
      )}

      {/* Failure simulation banner */}
      {failedNodeId && failedNode && (
        <View style={styles.failureBanner}>
          <Warning size={16} color={Colors.white} weight="fill" />
          <Text style={styles.failureBannerText} numberOfLines={1}>
            Simulating failure: <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{failedNode.name}</Text>
            {brokenPathCount > 0 ? `  ·  ${brokenPathCount} path${brokenPathCount !== 1 ? 's' : ''} broken` : ''}
            {isolatedNodeIds.length > 0 ? `  ·  ${isolatedNodeIds.length} isolated` : ''}
          </Text>
          <Pressable
            onPress={() => {
              clearFailureSim()
              setShowFailureSheet(false)
            }}
            hitSlop={8}
            style={{ marginLeft: 8 }}
          >
            <X size={14} color={Colors.white} />
          </Pressable>
        </View>
      )}

      {/* Reset selection pill (only when not in viz mode) */}
      {!vizActive && selectedNodes.length > 0 && (
        <Pressable style={styles.resetPill} onPress={handleReset}>
          <ArrowCounterClockwise size={14} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.resetText}>Reset selection</Text>
        </Pressable>
      )}

      {/* Algorithm result toast — appears after auto-Dijkstra / auto-Prim's */}
      <AlgorithmToast toast={toast} onDismiss={() => setToast(null)} />

      {/* Live validation badge — moved to top-left to not conflict with Explain toggle */}
      {hasBadge && !vizActive && selectedNodes.length === 0 && (
        <Pressable
          style={[styles.validationBadge, { backgroundColor: badgeBg, borderColor: `${badgeColor}40` }]}
          onPress={validationPassed ? undefined : onWarningPress}
        >
          <Text style={[styles.validationBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        </Pressable>
      )}

      {/* Hint banner — networking language */}
      {!vizActive && departments.length >= 2 && !sessionHasSelectedTwoNodes && showAlgoHint && (
        <View style={styles.hintBanner}>
          <Text style={styles.hintBannerText}>
            Tap two devices to find the best route, or run a full network analysis.
          </Text>
        </View>
      )}

      <GestureDetector gesture={composedGesture}>
        <Canvas style={styles.canvas}>
          {/* Dot-grid background — rendered outside the zoom group so it stays fixed */}
          {dotGridPoints.map((pt, i) => (
            <Circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={GRID_DOT_RADIUS}
              color={`${Colors.primary}18`}
            />
          ))}

          <Group transform={skiaTransform}>
            {/* Render edges first (behind nodes) */}
            {(() => {
              // Build parallel edge index: edges sharing same node pair get staggered curves
              const pairCount = new Map<string, number>()
              for (const e of edges) {
                const key = [e.source, e.target].sort().join('|')
                pairCount.set(key, (pairCount.get(key) ?? 0) + 1)
              }
              const runningIndex = new Map<string, number>()
              return edges.map((edge, i) => {
                const key = [edge.source, edge.target].sort().join('|')
                const total = pairCount.get(key) ?? 1
                const idx = runningIndex.get(key) ?? 0
                runningIndex.set(key, idx + 1)
                return (
                  <GraphEdgeComponent
                    key={`edge-${i}`}
                    edge={edge}
                    nodes={nodes}
                    departments={departments}
                    font={systemFont}
                    vizEdgeState={getEdgeVizState(edge.source, edge.target)}
                    parallelIndex={idx}
                    parallelTotal={total}
                  />
                )
              })
            })()}

            {/* MST overlay (Prim's only) */}
            {vizActive && vizAlgorithm === 'prims' && (
              <MSTOverlay
                mstEdges={mstEdges}
                nodes={nodes}
                candidateEdge={candidateEdge}
              />
            )}

            {/* Path overlay (non-viz mode Dijkstra) */}
            {!vizActive && pathResult && (
              <PathOverlay path={pathResult.path} nodes={nodes} edges={edges} />
            )}

            {/* Render nodes */}
            {nodes.map((node) => (
              <GraphNodeComponent
                key={node.id}
                node={node}
                selected={!vizActive && selectedNodes.includes(node.id)}
                font={systemFont}
                vizState={getNodeVizState(node.id)}
                isCritical={!vizActive && criticalNodeIds.includes(node.id) && !failedNodeId}
                isFailed={node.id === failedNodeId}
                isIsolated={isolatedNodeIds.includes(node.id)}
              />
            ))}
          </Group>
        </Canvas>
      </GestureDetector>

      {/* Viz legend overlay - forced visible in vizActive mode, close button hidden */}
      {vizActive && vizAlgorithm && (
        <VizLegend algorithm={vizAlgorithm} onDismiss={() => {}} hideClose={true} />
      )}

      {/* Zoom controls */}
      <View style={styles.zoomControls}>
        <Pressable
          style={styles.zoomButton}
          onPress={() => { scale.value = withSpring(Math.min(scale.value * 1.3, 5)) }}
        >
          <MagnifyingGlassPlus size={20} color={Colors.textPrimary} />
        </Pressable>
        <Pressable
          style={styles.zoomButton}
          onPress={() => { scale.value = withSpring(Math.max(scale.value / 1.3, 0.3)) }}
        >
          <MagnifyingGlassMinus size={20} color={Colors.textPrimary} />
        </Pressable>
        <Pressable
          style={styles.zoomButton}
          onPress={() => {
            scale.value = withSpring(1)
            translateX.value = withSpring(0)
            translateY.value = withSpring(0)
          }}
        >
          <CornersOut size={20} color={Colors.textPrimary} />
        </Pressable>
      </View>

      {/* "Analyze Network" — primary action at bottom-left */}
      {!vizActive && departments.length >= 2 && onVisualize && (
        <Pressable
          style={({ pressed }) => [styles.exploreLink, pressed && { opacity: 0.85 }]}
          onPress={() => {
            setShowLegend(true)
            setShowAlgoHint(false)
            setSessionHasSelectedTwoNodes(true)
            onVisualize()
          }}
          accessibilityRole="button"
          accessibilityLabel="Analyze Network"
        >
          <Play size={18} color={Colors.white} weight="fill" />
          <Text style={styles.exploreLinkText}>Analyze Network</Text>
        </Pressable>
      )}

      {/* Explain Mode Toggle — top-right corner */}
      {departments.length >= 1 && (
        <ExplainModeToggle style={styles.explainToggle} />
      )}

      <CoachMark
        visible={showCoachMark}
        text="Tap to explore Dijkstra, A*, Prim's, and more on this topology."
        onDismiss={handleDismissCoachMark}
      />

      {/* Failure simulation bottom sheet */}
      <BottomSheet
        visible={showFailureSheet}
        onClose={() => setShowFailureSheet(false)}
        snapHeight={340}
      >
        <View style={styles.sheetContent}>
          <View style={styles.sheetHeader}>
            <Warning size={22} color={Colors.error} weight="fill" />
            <Text style={styles.sheetTitle}>Failure Impact Analysis</Text>
          </View>
          <Text style={styles.sheetSubtitle}>
            Impact of removing <Text style={{ color: Colors.error, fontFamily: 'Inter_600SemiBold' }}>{failedNode?.name ?? ''}</Text> from the topology:
          </Text>

          <View style={styles.sheetMetricsRow}>
            <View style={[styles.sheetMetric, { borderColor: `${Colors.error}30`, backgroundColor: Colors.errorContainer }]}>
              <Text style={[styles.sheetMetricVal, { color: Colors.error }]}>{brokenPathCount}</Text>
              <Text style={styles.sheetMetricLbl}>Paths broken</Text>
            </View>
            <View style={[styles.sheetMetric, { borderColor: `${Colors.warning}30`, backgroundColor: Colors.warningContainer }]}>
              <Text style={[styles.sheetMetricVal, { color: Colors.warning }]}>{isolatedNodeIds.length}</Text>
              <Text style={styles.sheetMetricLbl}>Isolated nodes</Text>
            </View>
            <View style={[styles.sheetMetric, { borderColor: `${Colors.success}30`, backgroundColor: Colors.successContainer }]}>
              <Text style={[styles.sheetMetricVal, { color: Colors.success }]}>
                {departments.length - 1 - isolatedNodeIds.length}
              </Text>
              <Text style={styles.sheetMetricLbl}>Still reachable</Text>
            </View>
          </View>

          {isolatedNodeIds.length > 0 && (
            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionLabel}>UNREACHABLE NODES</Text>
              <View style={styles.sheetChipRow}>
                {isolatedNodeIds.slice(0, 6).map((id) => {
                  const name = departments.find((d) => d.id === id)?.name ?? id
                  return (
                    <View key={id} style={styles.sheetChip}>
                      <Text style={styles.sheetChipText}>{name}</Text>
                    </View>
                  )
                })}
                {isolatedNodeIds.length > 6 && (
                  <View style={styles.sheetChip}>
                    <Text style={styles.sheetChipText}>+{isolatedNodeIds.length - 6} more</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <Pressable
            style={styles.sheetDismissBtn}
            onPress={() => {
              clearFailureSim()
              setShowFailureSheet(false)
            }}
          >
            <Text style={styles.sheetDismissBtnText}>Clear Simulation</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  canvas: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
  },
  vizBanner: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: `${Colors.primary}15`,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vizDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.vizSettled,
  },
  vizBannerText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.primary,
  },
  resetPill: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: Colors.white,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.primary,
  },
  validationBadge: {
    position: 'absolute',
    top: 10,
    left: 12,
    zIndex: 10,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  validationBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  zoomControls: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    gap: 8,
    zIndex: 10,
  },
  zoomButton: {
    width: 44,
    height: 44,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreLink: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  exploreLinkText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
  explainToggle: {
    position: 'absolute',
    top: 10,
    right: 16,
    zIndex: 11,
  },
  hintBanner: {
    position: 'absolute',
    top: 52,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(30, 42, 60, 0.85)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hintBannerText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#E0EBFF',
  },

  // ── Failure simulation ──────────────────────────────────────────────────────
  failureBanner: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    zIndex: 12,
    backgroundColor: Colors.error,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  failureBannerText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.white,
  },
  warningBar: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: Colors.errorContainer,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.error,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  // Bottom sheet content
  sheetContent: {
    padding: 20,
    gap: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
  },
  sheetSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sheetMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetMetric: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  sheetMetricVal: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 28,
  },
  sheetMetricLbl: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  sheetSection: {
    gap: 8,
  },
  sheetSectionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  sheetChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sheetChip: {
    backgroundColor: Colors.errorContainer,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: `${Colors.error}25`,
  },
  sheetChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.error,
  },
  sheetDismissBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.errorContainer,
    borderWidth: 1,
    borderColor: `${Colors.error}30`,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  sheetDismissBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.error,
  },
})
