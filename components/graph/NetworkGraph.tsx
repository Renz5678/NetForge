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
import { useVisualizationStore } from '@/stores/useVisualizationStore'
import { GraphNodeComponent, NODE_WIDTH, NODE_HEIGHT } from './GraphNode'
import { GraphEdgeComponent } from './GraphEdge'
import { PathOverlay } from './PathOverlay'
import { MSTOverlay } from './MSTOverlay'
import { VizLegend } from './VizLegend'
import { AlgorithmToast, type ToastData } from '@/components/ui/AlgorithmToast'
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  CornersOut,
  ArrowCounterClockwise,
  BookOpen,
  Lightning,
  Play,
} from 'phosphor-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { CoachMark } from '@/components/ui/CoachMark'
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
  onVisualize?: () => void // callback to open AlgorithmSelector (now "Explore Algorithms")
  // Validation summary for the live badge
  validationWarnings?: number
  validationPassed?: boolean
}

export function NetworkGraph({
  departments,
  onPathFound,
  onVisualize,
  validationWarnings = 0,
  validationPassed,
}: NetworkGraphProps) {
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [pathResult, setPathResult] = useState<PathResult | null>(null)
  const [showLegend, setShowLegend] = useState(true)
  const [toast, setToast] = useState<ToastData | null>(null)

  const [showCoachMark, setShowCoachMark] = useState(false)
  const dismissAlgoHintRef = useRef(false)
  const [sessionHasSelectedTwoNodes, setSessionHasSelectedTwoNodes] = useState(false)

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
  const { startVisualization, stopVisualization, setShowSteps, setIsExpanded } =
    useVisualizationStore()

  useEffect(() => {
    if (vizActive) {
      dismissAlgoHintRef.current = true
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
        dismissAlgoHintRef.current = true
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
                ? `${srcName} \u2192 ${tgtName} \u00b7 Dijkstra \u00b7 ${hops} hop${hops !== 1 ? 's' : ''}`
                : `No path found \u00b7 Dijkstra`
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

  const composedGesture = Gesture.Exclusive(
    Gesture.Simultaneous(panGesture, pinchGesture),
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

      {/* Reset selection pill (only when not in viz mode) */}
      {!vizActive && selectedNodes.length > 0 && (
        <Pressable style={styles.resetPill} onPress={handleReset}>
          <ArrowCounterClockwise size={14} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.resetText}>Reset selection</Text>
        </Pressable>
      )}

      {/* Algorithm result toast — appears after auto-Dijkstra / auto-Prim's */}
      <AlgorithmToast toast={toast} onDismiss={() => setToast(null)} />

      {/* Live validation badge */}
      {hasBadge && !vizActive && selectedNodes.length === 0 && (
        <View style={[styles.validationBadge, { backgroundColor: badgeBg, borderColor: `${badgeColor}40` }]}>
          <Text style={[styles.validationBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        </View>
      )}

      {/* Shortest path / Algorithm Hint Banner */}
      {!vizActive && departments.length >= 2 && !sessionHasSelectedTwoNodes && !dismissAlgoHintRef.current && (
        <View style={styles.hintBanner}>
          <Text style={styles.hintBannerText}>
            Tap two nodes to find the shortest path, or run a full algorithm.
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
            {edges.map((edge, i) => (
              <GraphEdgeComponent
                key={`edge-${i}`}
                edge={edge}
                nodes={nodes}
                departments={departments}
                font={systemFont}
                vizEdgeState={getEdgeVizState(edge.source, edge.target)}
              />
            ))}

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

      {/* "Run Algorithm" — primary action at bottom-left */}
      {!vizActive && departments.length >= 2 && onVisualize && (
        <Pressable
          style={({ pressed }) => [styles.exploreLink, pressed && { opacity: 0.85 }]}
          onPress={() => {
            setShowLegend(true)
            dismissAlgoHintRef.current = true
            setSessionHasSelectedTwoNodes(true)
            onVisualize()
          }}
          accessibilityRole="button"
          accessibilityLabel="Run Algorithm"
        >
          <Play size={18} color={Colors.white} weight="fill" />
          <Text style={styles.exploreLinkText}>Run Algorithm</Text>
        </Pressable>
      )}

      <CoachMark
        visible={showCoachMark}
        text="Tap to explore Dijkstra, A*, Prim's, and more on this topology."
        onDismiss={handleDismissCoachMark}
      />
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
    right: 68,
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
})
