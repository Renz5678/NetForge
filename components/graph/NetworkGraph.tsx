// NetworkGraph.tsx
// Full canvas graph renderer using @shopify/react-native-skia.
// Pan + pinch zoom via GestureDetector.
// Node tap: single = tooltip, two nodes = Dijkstra path.
// Visualization mode: subscribes to useVisualizationStore and applies
// viz color overlays to nodes and edges via the vizState/vizEdgeState props.

import React, { useState, useCallback } from 'react'
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
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  CornersOut,
  ArrowCounterClockwise,
  Lightning,
} from 'phosphor-react-native'
import type { Department, PathResult } from '@/types'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const CANVAS_HEIGHT = SCREEN_HEIGHT - 200

const systemFont = matchFont({
  fontFamily: Platform.OS === 'ios' ? 'Helvetica' : 'sans-serif',
  fontSize: 13,
  fontWeight: 'bold',
})

type NetworkGraphProps = {
  departments: Department[]
  onPathFound?: (result: PathResult | null, nodeIds: string[]) => void
  onVisualize?: () => void // callback to open AlgorithmSelector
}

export function NetworkGraph({ departments, onPathFound, onVisualize }: NetworkGraphProps) {
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [pathResult, setPathResult] = useState<PathResult | null>(null)
  const [showLegend, setShowLegend] = useState(true)

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
  const vizSteps = useVisualizationStore((s) => s.steps)
  const vizStepIndex = useVisualizationStore((s) => s.currentStepIndex)
  const currentStep = vizSteps[vizStepIndex] ?? null
  const isExpanded = useVisualizationStore((s) => s.isExpanded)

  // Auto-center camera offset when visualization is active/expanded
  React.useEffect(() => {
    if (vizActive) {
      if (isExpanded) {
        // Shift graph up by 140px and zoom out slightly to prevent occlusion by the tall details sheet
        translateY.value = withSpring(-140)
        scale.value = withSpring(0.78)
      } else {
        // Shift graph up slightly (40px) to clear the small collapsed controls sheet
        translateY.value = withSpring(-40)
        scale.value = withSpring(0.9)
      }
    } else {
      // Restore standard camera position
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

      if (!tappedId) {
        setSelectedNodes([])
        setPathResult(null)
        onPathFound?.(null, [])
        return
      }

      setSelectedNodes((prev) => {
        if (prev.length === 0) {
          return [tappedId]
        } else if (prev.length === 1) {
          if (prev[0] === tappedId) return prev
          const newSelected = [prev[0], tappedId]
          const result = findShortestPath(departments, prev[0], tappedId)
          setPathResult(result)
          onPathFound?.(result, newSelected)
          return newSelected
        } else {
          return [tappedId]
        }
      })
    },
    [hitTestNode, departments, onPathFound, vizActive]
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

  return (
    <View style={styles.container}>
      {/* Viz mode banner */}
      {vizActive && (
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

      <GestureDetector gesture={composedGesture}>
        <Canvas style={styles.canvas}>
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

      {/* Viz legend overlay */}
      {vizActive && vizAlgorithm && showLegend && (
        <VizLegend algorithm={vizAlgorithm} onDismiss={() => setShowLegend(false)} />
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

      {/* Visualize FAB — only shown in graph view with 2+ nodes */}
      {!vizActive && departments.length >= 2 && onVisualize && (
        <Pressable style={styles.vizFab} onPress={() => {
          setShowLegend(true)
          onVisualize()
        }}>
          <Lightning size={16} color={Colors.white} weight="fill" />
          <Text style={styles.vizFabText}>Visualize</Text>
        </Pressable>
      )}
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
  zoomText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    color: Colors.textPrimary,
  },
  vizFab: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    zIndex: 10,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  vizFabText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.white,
  },
})
