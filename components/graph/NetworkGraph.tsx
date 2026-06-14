// NetworkGraph.tsx — v2
// Full canvas graph renderer using @shopify/react-native-skia.
// Pan + pinch zoom via GestureDetector.
//
// What's new in v2:
//   - Dark canvas background (#0D1117) — professional network-diagram aesthetic
//   - Circuit-board dot grid (dimmer, tinted dots on dark bg)
//   - Topology zone shading (WAN / Core / Access tier tints)
//   - Peer highlight rings: on first node tap, all adjacent nodes get a blue ring
//   - NodeTooltip: floating info card on single-node selection
//   - Speed dial: ×0.5 / ×1 / ×2 chip group in viz banner
//   - Floating pill zoom controls (horizontal layout, glass styling)
//   - peerCount + isPeerHighlighted passed to every GraphNodeComponent

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Dimensions,
  Platform,
  Animated as RNAnimated,
} from 'react-native'
import {
  Canvas,
  Group,
  matchFont,
  Circle,
  Rect,
} from '@shopify/react-native-skia'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import {
  useSharedValue,
  withSpring,
  useDerivedValue,
} from 'react-native-reanimated'
import { Colors } from '@/constants/colors'
import { useGraphLayout } from '@/hooks/useGraphLayout'
import { findShortestPath } from '@/lib/algorithms/dijkstra'
import { validateConnectivity } from '@/lib/algorithms/bfsValidator'
import { detectCycles } from '@/lib/algorithms/cycleDetection'
import { useVisualizationStore } from '@/stores/useVisualizationStore'
import { useConfigStore } from '@/stores/useConfigStore'
import { GraphNodeComponent, NODE_WIDTH, NODE_HEIGHT } from './GraphNode'
import { GraphEdgeComponent } from './GraphEdge'
import { PathOverlay } from './PathOverlay'
import { MSTOverlay } from './MSTOverlay'
import { VizLegend } from './VizLegend'
import { NodeTooltip } from './NodeTooltip'
import { AlgorithmToast, type ToastData } from '@/components/ui/AlgorithmToast'
import { BottomSheet } from '@/components/ui/BottomSheet'
import {
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  CornersOut,
  ArrowCounterClockwise,
  Warning,
  X,
  ChartBar,
  TreeStructure,
} from 'phosphor-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { CoachMark } from '@/components/ui/CoachMark'

import type { NetworkNode, PathResult, ValidationResult } from '@/types'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const CANVAS_HEIGHT = SCREEN_HEIGHT - 200

// ── Empty canvas overlay ─────────────────────────────────────────────────────
function EmptyCanvasOverlay() {
  const fadeAnim  = React.useRef(new RNAnimated.Value(0)).current
  const slideAnim = React.useRef(new RNAnimated.Value(16)).current

  React.useEffect(() => {
    const timer = setTimeout(() => {
      RNAnimated.parallel([
        RNAnimated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
        RNAnimated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start()
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  return (
    <RNAnimated.View
      style={[emptyStyles.overlay, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      pointerEvents="none"
    >
      <View style={emptyStyles.iconRing}>
        <TreeStructure size={32} color="rgba(99,132,255,0.7)" weight="duotone" />
      </View>
      <Text style={emptyStyles.title}>No devices yet</Text>
      <Text style={emptyStyles.subtitle}>
        Tap{' '}
        <Text style={emptyStyles.highlight}>+</Text>
        {' '}in the tab bar to create your first network
      </Text>
      <View style={emptyStyles.hintRow}>
        <View style={emptyStyles.hintDot} />
        <Text style={emptyStyles.hintText}>Tap a node to inspect it</Text>
      </View>
      <View style={emptyStyles.hintRow}>
        <View style={emptyStyles.hintDot} />
        <Text style={emptyStyles.hintText}>Tap two nodes to find the shortest path</Text>
      </View>
      <View style={emptyStyles.hintRow}>
        <View style={emptyStyles.hintDot} />
        <Text style={emptyStyles.hintText}>Long-press a node to simulate failure</Text>
      </View>
    </RNAnimated.View>
  )
}

const emptyStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
    zIndex: 5,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(99,132,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(99,132,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 20,
    color: 'rgba(226,232,240,0.90)',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(147,197,253,0.65)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 6,
  },
  highlight: {
    fontFamily: 'Inter_700Bold',
    color: 'rgba(147,197,253,0.90)',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  hintDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(99,132,255,0.50)',
  },
  hintText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(147,197,253,0.50)',
  },
})

const systemFont = matchFont({
  fontFamily: Platform.OS === 'ios' ? 'Helvetica' : 'sans-serif',
  fontSize: 13,
  fontWeight: 'bold',
})

// Grid constants
const GRID_SPACING   = 28
const GRID_DOT_R     = 1.2

// Tier type sets for zone shading
const WAN_TYPES      = new Set(['wan'])
const CORE_TYPES     = new Set(['firewall', 'router'])
const ACCESS_TYPES   = new Set(['switch', 'NetworkNode'])

type NetworkGraphProps = {
  departments: NetworkNode[]
  onPathFound?:       (result: PathResult | null, nodeIds: string[]) => void
  onVisualize?:       () => void
  onWarningPress?:    () => void
  validationWarnings?: number
  validationPassed?:  boolean
  validationResult?:  ValidationResult   // full validation — drives auto-diagnostic
}

export function NetworkGraph({
  departments,
  onPathFound,
  onVisualize,
  onWarningPress,
  validationWarnings = 0,
  validationPassed,
  validationResult,
}: NetworkGraphProps) {
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [pathResult, setPathResult] = useState<PathResult | null>(null)

  const [toast, setToast] = useState<ToastData | null>(null)
  const [showFailureSheet, setShowFailureSheet] = useState(false)
  const [tooltipNodeId, setTooltipNodeId] = useState<string | null>(null)
  // Screen-space position captured at tap time (reading .value during render is not allowed)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; nodeH: number } | null>(null)

  // Passive algorithm outputs from config store
  const activeMstEdges   = useConfigStore((s) => s.activeMstEdges)
  const activeMstCost    = useConfigStore((s) => s.activeMstCost)
  const activeHasCycle   = useConfigStore((s) => s.activeHasCycle)

  // Persist last Dijkstra result for status bar replay
  const lastPathHopsRef  = useRef<number | null>(null)
  const lastPathNodesRef = useRef<[string, string] | null>(null)

  const [showCoachMark, setShowCoachMark] = useState(false)
  const [showAlgoHint, setShowAlgoHint] = useState(true)


  useEffect(() => {
    if (showAlgoHint) {
      const timer = setTimeout(() => setShowAlgoHint(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [showAlgoHint])

  useEffect(() => {
    const checkHint = async () => {
      try {
        const hasSeen = await AsyncStorage.getItem('hasSeenAlgorithmHint')
        if (!hasSeen) setShowCoachMark(true)
      } catch (err) {
        console.warn('AsyncStorage error:', err)
      }
    }
    checkHint()
  }, [])

  const handleDismissCoachMark = async () => {
    setShowCoachMark(false)
    try {
      await AsyncStorage.setItem('hasSeenAlgorithmHint', 'true')
    } catch (err) {
      console.warn('AsyncStorage error:', err)
    }
  }

  const selectedNodesRef = useRef<string[]>([])

  // Pan & zoom
  const translateX      = useSharedValue(0)
  const translateY      = useSharedValue(0)
  const scale           = useSharedValue(1)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)
  const savedScale      = useSharedValue(1)

  const { nodes, edges } = useGraphLayout(departments, SCREEN_WIDTH, CANVAS_HEIGHT)

  // Viz store
  const vizActive       = useVisualizationStore((s) => s.isActive)
  const vizAlgorithm    = useVisualizationStore((s) => s.algorithm)
  const currentStep     = useVisualizationStore((s) => s.currentStep)
  const isExpanded      = useVisualizationStore((s) => s.isExpanded)
  const isPlaying       = useVisualizationStore((s) => s.isPlaying)
  const criticalNodeIds = useVisualizationStore((s) => s.criticalNodeIds)
  const failedNodeId    = useVisualizationStore((s) => s.failedNodeId)
  const failureSimResult = useVisualizationStore((s) => s.failureSimResult)
  const vizSpeed        = useVisualizationStore((s) => s.speed)
  const {
    startVisualization, stopVisualization, setShowSteps, setIsExpanded,
    setFailedNodeId, setFailureSimResult, clearFailureSim, setSpeed,
  } = useVisualizationStore()

  useEffect(() => {
    if (vizActive) setShowAlgoHint(false)
  }, [vizActive])

  // Cleanup: stop any active viz when the user leaves the graph tab
  const stopVizRef = useRef(stopVisualization)
  const clearFailRef = useRef(clearFailureSim)
  useEffect(() => { stopVizRef.current = stopVisualization }, [stopVisualization])
  useEffect(() => { clearFailRef.current = clearFailureSim }, [clearFailureSim])
  useEffect(() => {
    return () => {
      stopVizRef.current()
      clearFailRef.current()
    }
  }, [])

  const autoVizRef     = useRef(false)
  const prevIsPlaying  = useRef(isPlaying)
  // Track whether we've already fired the auto-diagnostic for this mount
  const autoDiagFiredRef = useRef(false)

  React.useEffect(() => {
    if (autoVizRef.current && prevIsPlaying.current && !isPlaying && vizActive) {
      stopVisualization()
      autoVizRef.current = false
    }
    prevIsPlaying.current = isPlaying
  }, [isPlaying, vizActive])

  // ── Auto-diagnostic: runs once on mount when the topology is invalid ─────
  // Priority: cycle > isolated nodes > (subnet/VLAN: static, no step-by-step)
  React.useEffect(() => {
    if (
      validationPassed !== false ||
      vizActive ||
      autoDiagFiredRef.current ||
      departments.length < 2
    ) return

    autoDiagFiredRef.current = true

    // Small delay so the canvas layout settles before the viz kicks in
    const timer = setTimeout(() => {
      // 1. Cycle detected
      if (validationResult && !validationResult.cycleCheck.passed) {
        import('@/lib/algorithms/cycleDetectionVisualizer').then(
          ({ buildCycleDetectionSteps }) => {
            const result = buildCycleDetectionSteps(departments)
            autoVizRef.current = true
            startVisualization('cycleDetection', result.steps, {
              showSteps: true,
            })
            setIsExpanded(true)
            setShowSteps(true)
            setSpeed('normal')
            setToast({
              label: `Routing loop detected — watch the cycle unfold`,
              success: false,
              insight: validationResult.cycleCheck.message,
              replayLabel: 'Replay ›',
              onReplay: () => {
                const r2 = buildCycleDetectionSteps(departments)
                startVisualization('cycleDetection', r2.steps, { showSteps: true })
                setIsExpanded(true)
                setShowSteps(true)
                setToast(null)
              },
            })
          }
        )
        return
      }

      // 2. Isolated / unreachable nodes
      if (validationResult && !validationResult.connectivityCheck.passed) {
        import('@/lib/algorithms/isolationVisualizer').then(
          ({ buildIsolationSteps }) => {
            const result = buildIsolationSteps(departments)
            autoVizRef.current = true
            startVisualization('cycleDetection', result.steps, {
              showSteps: true,
            })
            setIsExpanded(true)
            setShowSteps(true)
            setSpeed('normal')
            setToast({
              label: `Isolated node${result.isolatedNodeIds.length !== 1 ? 's' : ''} detected — watch the BFS sweep`,
              success: false,
              insight: validationResult.connectivityCheck.message,
              replayLabel: 'Replay ›',
              onReplay: () => {
                const r2 = buildIsolationSteps(departments)
                startVisualization('cycleDetection', r2.steps, { showSteps: true })
                setIsExpanded(true)
                setShowSteps(true)
                setToast(null)
              },
            })
          }
        )
        return
      }

      // 3. Subnet / VLAN conflict — no step-by-step, just a toast
      const failedCheck =
        !validationResult?.allocationCheck.passed ? validationResult?.allocationCheck
        : !validationResult?.vlanCheck.passed     ? validationResult?.vlanCheck
        : null
      if (failedCheck) {
        setToast({
          label: 'Configuration conflict detected',
          success: false,
          insight: failedCheck.message,
        })
      }
    }, 600)

    return () => clearTimeout(timer)
  // We intentionally only run on mount (graph tab open). deps = stable refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Camera auto-adjust during viz
  React.useEffect(() => {
    if (vizActive) {
      if (isExpanded) {
        translateY.value = withSpring(-140, { damping: 20, stiffness: 90 })
        scale.value      = withSpring(0.78, { damping: 20, stiffness: 90 })
      } else {
        translateY.value = withSpring(-40, { damping: 20, stiffness: 90 })
        scale.value      = withSpring(0.9, { damping: 20, stiffness: 90 })
      }
    } else {
      translateY.value = withSpring(0, { damping: 20, stiffness: 90 })
      scale.value      = withSpring(1, { damping: 20, stiffness: 90 })
      translateX.value = withSpring(0, { damping: 20, stiffness: 90 })
    }
  }, [vizActive, isExpanded, translateY, translateX, scale])

  // ── Peer count map ────────────────────────────────────────────────────────
  const peerCountMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const edge of edges) {
      map.set(edge.source, (map.get(edge.source) ?? 0) + 1)
      map.set(edge.target, (map.get(edge.target) ?? 0) + 1)
    }
    return map
  }, [edges])

  // ── Peer node IDs of the currently selected node ──────────────────────────
  const peerNodeIds = useMemo(() => {
    if (selectedNodes.length !== 1) return new Set<string>()
    const selId = selectedNodes[0]
    const peers = new Set<string>()
    for (const edge of edges) {
      if (edge.source === selId) peers.add(edge.target)
      else if (edge.target === selId) peers.add(edge.source)
    }
    return peers
  }, [selectedNodes, edges])

  // ── Tooltip: selected dept lookup ─────────────────────────────────────────
  const tooltipDept = tooltipNodeId
    ? departments.find((d) => d.id === tooltipNodeId) ?? null
    : null

  // tooltipPos is set inside handleTap at tap time (reading .value in an event
  // handler is permitted by Reanimated; render-time reads are not)

  // ── Hit test ──────────────────────────────────────────────────────────────
  const hitTestNode = useCallback(
    (touchX: number, touchY: number): string | null => {
      const canvasX = (touchX - translateX.value) / scale.value
      const canvasY = (touchY - translateY.value) / scale.value
      for (const node of nodes) {
        const nx = node.x - NODE_WIDTH  / 2
        const ny = node.y - NODE_HEIGHT / 2
        if (
          canvasX >= nx && canvasX <= nx + NODE_WIDTH &&
          canvasY >= ny && canvasY <= ny + NODE_HEIGHT
        ) {
          return node.id
        }
      }
      return null
    },
    [nodes, translateX, translateY, scale],
  )

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleTap = useCallback(
    (touchX: number, touchY: number) => {
      if (vizActive) return

      const tappedId = hitTestNode(touchX, touchY)
      const prev     = selectedNodesRef.current

      if (!tappedId) {
        selectedNodesRef.current = []
        setSelectedNodes([])
        setPathResult(null)
        setToast(null)
        setTooltipNodeId(null)
        setTooltipPos(null)
        onPathFound?.(null, [])
        return
      }

      if (prev.length === 0) {
        // Single tap — show tooltip + peer rings
        // Capture screen-space position now (reading .value is OK inside a callback)
        const tappedNodeData = nodes.find((n) => n.id === tappedId)
        const posX  = tappedNodeData ? tappedNodeData.x * scale.value + translateX.value : 0
        const posY  = tappedNodeData ? tappedNodeData.y * scale.value + translateY.value : 0
        const posNH = tappedNodeData ? NODE_HEIGHT * scale.value : NODE_HEIGHT
        selectedNodesRef.current = [tappedId]
        setSelectedNodes([tappedId])
        setTooltipNodeId(tappedId)
        setTooltipPos({ x: posX, y: posY, nodeH: posNH })
        return
      }

      if (prev.length === 1) {
        // Tap same node → dismiss tooltip
        if (prev[0] === tappedId) {
          setTooltipNodeId(null)
          return
        }

        const srcId       = prev[0]
        const tgtId       = tappedId
        const newSelected = [srcId, tgtId]
        selectedNodesRef.current = newSelected
        setSelectedNodes(newSelected)
        setTooltipNodeId(null)
        setTooltipPos(null)
        setShowAlgoHint(false)

        // ── Cycle gate: if a loop exists, Dijkstra cannot safely route ────────
        // DFS cycle detection is cheap (O(V+E)) and runs synchronously here.
        const cycleCheck = detectCycles(departments)
        if (cycleCheck.hasCycle) {
          setPathResult(null)
          onPathFound?.(null, newSelected)
          setToast({
            label: "Can't route — routing loop detected. Tap to see where.",
            success: false,
            insight: 'Loops cause broadcast storms — packets circulate endlessly and can overload every device in the loop.',
            replayLabel: 'via DFS ›',
            onReplay: () => {
              import('@/lib/algorithms/cycleDetectionVisualizer').then(
                ({ buildCycleDetectionSteps }) => {
                  const vizResult = buildCycleDetectionSteps(departments)
                  startVisualization('cycleDetection', vizResult.steps, { showSteps: true })
                  setIsExpanded(true)
                  setShowSteps(true)
                  setToast(null)
                }
              )
            },
          })
          return
        }

        const pathFindResult = findShortestPath(departments, srcId, tgtId)
        setPathResult(pathFindResult)
        onPathFound?.(pathFindResult, newSelected)

        // Persist for status bar
        if (pathFindResult) {
          lastPathHopsRef.current  = pathFindResult.hops
          lastPathNodesRef.current = [srcId, tgtId]
        }

        // Auto-trigger Dijkstra viz
        import('@/lib/algorithms/dijkstraVisualizer').then(({ buildDijkstraSteps }) => {
          const vizResult = buildDijkstraSteps(departments, srcId, tgtId)
          const steps     = vizResult.steps
          if (steps.length > 0) {
            autoVizRef.current = true
            setToast(null)
            startVisualization('dijkstra', steps, {
              sourceId: srcId,
              targetId: tgtId,
              showSteps: false,
            })

            const hops    = pathFindResult?.hops ?? 0
            const srcName = departments.find((d) => d.id === srcId)?.name ?? srcId
            const tgtName = departments.find((d) => d.id === tgtId)?.name ?? tgtId
            setTimeout(() => {
              // Change 3: results-first copy, algorithm as attribution not headline
              const toastLabel = pathFindResult
                ? `${hops} hop${hops !== 1 ? 's' : ''}: ${srcName} → ${tgtName}`
                : `No route — ${srcName} and ${tgtName} are not connected`
              const toastInsight = pathFindResult
                ? `Each hop is a device that processes your traffic. Fewer hops = lower latency.`
                : `These two devices have no path between them. Check that all intermediate devices are peered correctly.`
              setToast({
                label: toastLabel,
                success: !!pathFindResult,
                insight: toastInsight,
                replayLabel: 'via Dijkstra ›',
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

      // 3rd+ tap → reset to new single selection
      const tappedNodeData = nodes.find((n) => n.id === tappedId)
      const posX  = tappedNodeData ? tappedNodeData.x * scale.value + translateX.value : 0
      const posY  = tappedNodeData ? tappedNodeData.y * scale.value + translateY.value : 0
      const posNH = tappedNodeData ? NODE_HEIGHT * scale.value : NODE_HEIGHT
      selectedNodesRef.current = [tappedId]
      setSelectedNodes([tappedId])
      setTooltipNodeId(tappedId)
      setTooltipPos({ x: posX, y: posY, nodeH: posNH })
      setPathResult(null)
      setToast(null)
      onPathFound?.(null, [])
    },
    [hitTestNode, departments, onPathFound, vizActive, startVisualization, setIsExpanded, setShowSteps],
  )

  // ── Long-press failure simulation ─────────────────────────────────────────
  const handleLongPress = useCallback(
    (touchX: number, touchY: number) => {
      if (vizActive) return

      const pressedId = hitTestNode(touchX, touchY)
      if (!pressedId) return

      if (failedNodeId === pressedId) {
        clearFailureSim()
        setShowFailureSheet(false)
        return
      }

      const filteredDepts = departments.filter((d) => d.id !== pressedId)
      const { isolated: isolatedNames } = validateConnectivity(filteredDepts)
      const nameToId    = new Map(departments.map((d) => [d.name, d.id]))
      const isolatedIds = isolatedNames.map((name) => nameToId.get(name) ?? '').filter(Boolean)

      const brokenPaths: [string, string][] = []
      const filteredIds = filteredDepts.map((d) => d.id)
      for (let i = 0; i < filteredIds.length; i++) {
        for (let j = i + 1; j < filteredIds.length; j++) {
          const path = findShortestPath(filteredDepts, filteredIds[i], filteredIds[j])
          if (!path) brokenPaths.push([filteredIds[i], filteredIds[j]])
        }
      }

      setFailedNodeId(pressedId)
      setFailureSimResult({ isolatedNodes: isolatedIds, brokenPaths })
      setShowFailureSheet(true)
      setTooltipNodeId(null)

      selectedNodesRef.current = []
      setSelectedNodes([])
      setPathResult(null)
      setToast(null)
      onPathFound?.(null, [])
    },
    [hitTestNode, vizActive, departments, failedNodeId, clearFailureSim,
     setFailedNodeId, setFailureSimResult, onPathFound],
  )

  // ── Gestures ──────────────────────────────────────────────────────────────
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
    .onBegin(() => { savedScale.value = scale.value })
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.3), 5)
    })

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => { handleTap(e.x, e.y) })

  const longPressGesture = Gesture.LongPress()
    .minDuration(600)
    .runOnJS(true)
    .onStart((e) => { handleLongPress(e.x, e.y) })

  const composedGesture = Gesture.Exclusive(
    Gesture.Simultaneous(panGesture, pinchGesture),
    longPressGesture,
    tapGesture,
  )

  const handleReset = () => {
    setSelectedNodes([])
    setPathResult(null)
    setToast(null)
    setTooltipNodeId(null)
    setTooltipPos(null)
    onPathFound?.(null, [])
  }



  // ── Viz state resolvers ───────────────────────────────────────────────────
  const getNodeVizState = (nodeId: string) => {
    if (!vizActive || !currentStep) return undefined
    return currentStep.nodeStates[nodeId]
  }

  const getEdgeVizState = (srcId: string, tgtId: string) => {
    if (!vizActive || !currentStep?.edgeStates) return undefined
    const key     = `${srcId}→${tgtId}`
    const revKey  = `${tgtId}→${srcId}`
    return currentStep.edgeStates[key] ?? currentStep.edgeStates[revKey]
  }

  const mstEdges      = vizActive && vizAlgorithm === 'prims' ? (currentStep?.mstEdges ?? []) : []
  const candidateEdge = vizActive && vizAlgorithm === 'prims' ? currentStep?.currentEdge : null

  // Passive MST edge lookup — for always-on backbone highlight
  const mstEdgeSet = useMemo(() => {
    const s = new Set<string>()
    for (const e of activeMstEdges) {
      s.add([e.source, e.target].sort().join('|'))
    }
    return s
  }, [activeMstEdges])

  // Status bar tap handlers
  const handleCycleStatusTap = useCallback(() => {
    if (vizActive) return
    import('@/lib/algorithms/cycleDetectionVisualizer').then(
      ({ buildCycleDetectionSteps }) => {
        const vizResult = buildCycleDetectionSteps(departments)
        startVisualization('cycleDetection', vizResult.steps, { showSteps: true })
        setIsExpanded(true)
        setShowSteps(true)
      }
    )
  }, [vizActive, departments, startVisualization, setIsExpanded, setShowSteps])

  const handleMstStatusTap = useCallback(() => {
    if (vizActive || activeMstEdges.length === 0) return
    setToast({
      label: `Backbone: ${activeMstEdges.length} cables, cost ${activeMstCost}`,
      success: true,
      insight: `This is the minimum cabling needed to keep all devices connected. Any extra cable is redundant for basic connectivity.`,
      replayLabel: "via Prim's ›",
      onReplay: () => {
        import('@/lib/algorithms/primsVisualizer').then(({ buildPrimsSteps }) => {
          const rootNode =
            departments.find((d) => d.type === 'wan') ??
            departments.find((d) => d.type === 'router') ??
            departments[0]
          if (!rootNode) return
          const vizResult = buildPrimsSteps(departments, rootNode.id)
          startVisualization('prims', vizResult.steps, { rootId: rootNode.id, showSteps: true })
          setIsExpanded(true)
          setShowSteps(true)
          setToast(null)
        })
      },
    })
  }, [vizActive, activeMstEdges, activeMstCost, departments, startVisualization, setIsExpanded, setShowSteps, setToast])

  const handlePathStatusTap = useCallback(() => {
    const nodes = lastPathNodesRef.current
    if (vizActive || !nodes) return
    const [srcId, tgtId] = nodes
    import('@/lib/algorithms/dijkstraVisualizer').then(({ buildDijkstraSteps }) => {
      const vizResult = buildDijkstraSteps(departments, srcId, tgtId)
      if (vizResult.steps.length > 0) {
        startVisualization('dijkstra', vizResult.steps, { sourceId: srcId, targetId: tgtId, showSteps: true })
        setIsExpanded(true)
        setShowSteps(true)
      }
    })
  }, [vizActive, departments, startVisualization, setIsExpanded, setShowSteps])

  const failedNode      = failedNodeId ? departments.find((d) => d.id === failedNodeId) : null
  const isolatedNodeIds = failureSimResult?.isolatedNodes ?? []
  const brokenPathCount = failureSimResult?.brokenPaths.length ?? 0

  const skiaTransform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ])

  // ── Dot grid (static, computed once) ─────────────────────────────────────
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

  // ── Zone shading rectangles ───────────────────────────────────────────────
  // Compute y-range per tier type from node positions
  const zoneRects = useMemo(() => {
    const wanNodes  = nodes.filter((n) => WAN_TYPES.has(n.type   ?? ''))
    const coreNodes = nodes.filter((n) => CORE_TYPES.has(n.type  ?? ''))
    const accNodes  = nodes.filter((n) => ACCESS_TYPES.has(n.type ?? ''))

    const rect = (ns: typeof nodes, color: string) => {
      if (ns.length === 0) return null
      const minY = Math.min(...ns.map((n) => n.y)) - NODE_HEIGHT / 2 - 20
      const maxY = Math.max(...ns.map((n) => n.y)) + NODE_HEIGHT / 2 + 20
      return { y: minY, h: maxY - minY, color }
    }

    return [
      rect(wanNodes,  Colors.zoneWan),
      rect(coreNodes, Colors.zoneCore),
      rect(accNodes,  Colors.zoneAccess),
    ].filter(Boolean) as { y: number; h: number; color: string }[]
  }, [nodes])

  // ── Validation badge ──────────────────────────────────────────────────────
  const hasBadge   = departments.length > 0 && validationPassed !== undefined
  const badgeColor = validationPassed ? Colors.success : Colors.warning

  const badgeLabel = validationPassed
    ? '✓ Valid'
    : `⚠ ${validationWarnings} warning${validationWarnings !== 1 ? 's' : ''}`

  // ── Parallel edge index ───────────────────────────────────────────────────
  const { edgeParallelInfo } = useMemo(() => {
    const pc = new Map<string, number>()
    for (const e of edges) {
      const key = [e.source, e.target].sort().join('|')
      pc.set(key, (pc.get(key) ?? 0) + 1)
    }
    const ri = new Map<string, number>()
    const info = edges.map((edge) => {
      const key   = [edge.source, edge.target].sort().join('|')
      const total = pc.get(key) ?? 1
      const idx   = ri.get(key) ?? 0
      ri.set(key, idx + 1)
      return { idx, total }
    })
    return { edgeParallelInfo: info }
  }, [edges])

  return (
    <View style={styles.container}>
      {/* Empty canvas onboarding overlay */}
      {departments.length === 0 && <EmptyCanvasOverlay />}

      {/* Viz mode banner + speed dial */}
      {vizActive && !autoVizRef.current && (
        <View style={styles.vizBanner}>
          <View style={styles.vizDot} />
          <Text style={styles.vizBannerText}>Visualization Mode</Text>
          {/* Speed dial */}
          <View style={styles.speedDial}>
            {(['slow', 'normal', 'fast'] as const).map((sp) => (
              <Pressable
                key={sp}
                style={[styles.speedBtn, vizSpeed === sp && styles.speedBtnActive]}
                onPress={() => setSpeed(sp)}
              >
                <Text style={[styles.speedBtnText, vizSpeed === sp && styles.speedBtnTextActive]}>
                  {sp === 'slow' ? '×½' : sp === 'normal' ? '×1' : '×2'}
                </Text>
              </Pressable>
            ))}
          </View>
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
            onPress={() => { clearFailureSim(); setShowFailureSheet(false) }}
            hitSlop={8}
            style={{ marginLeft: 8 }}
          >
            <X size={14} color={Colors.white} />
          </Pressable>
        </View>
      )}

      {/* Reset selection pill */}
      {!vizActive && selectedNodes.length > 0 && (
        <Pressable style={styles.resetPill} onPress={handleReset}>
          <ArrowCounterClockwise size={14} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.resetText}>Reset selection</Text>
        </Pressable>
      )}

      {/* Algorithm toast */}
      <AlgorithmToast toast={toast} onDismiss={() => setToast(null)} />

      {/* Merged validation + algorithm status pill */}
      {!vizActive && departments.length > 0 && selectedNodes.length === 0 && (
        <View style={styles.statusPill}>
          {hasBadge && (
            <Pressable onPress={validationPassed ? undefined : onWarningPress} hitSlop={4}>
              <Text style={[styles.statusPillBadge, { color: badgeColor }]}>{badgeLabel}</Text>
            </Pressable>
          )}
          {departments.length >= 2 && (
            <>
              {hasBadge && <View style={styles.statusPillDivider} />}
              <Pressable onPress={handleCycleStatusTap} hitSlop={4}>
                <Text style={[
                  styles.statusPillItem,
                  activeHasCycle ? styles.statusItemWarn : styles.statusItemOk,
                ]}>
                  {activeHasCycle ? '⚠ Loop' : '● Acyclic'}
                </Text>
              </Pressable>
              <Text style={styles.statusDot}>·</Text>
              <Pressable onPress={handleMstStatusTap} hitSlop={4}>
                <Text style={styles.statusPillItem}>
                  {activeMstEdges.length > 0 ? `MST ${activeMstCost}` : 'MST —'}
                </Text>
              </Pressable>
              {lastPathHopsRef.current != null && (
                <>
                  <Text style={styles.statusDot}>·</Text>
                  <Pressable onPress={handlePathStatusTap} hitSlop={4}>
                    <Text style={styles.statusPillItem}>
                      {lastPathHopsRef.current} hop{lastPathHopsRef.current !== 1 ? 's' : ''}
                    </Text>
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>
      )}


      {/* Canvas */}
      <GestureDetector gesture={composedGesture}>
        <Canvas style={styles.canvas}>
          {/* Fixed dot grid — outside zoom group */}
          {dotGridPoints.map((pt, i) => (
            <Circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={GRID_DOT_R}
              color="rgba(99,132,255,0.18)"
            />
          ))}

          <Group transform={skiaTransform}>
            {/* Zone shading — behind everything */}
            {zoneRects.map((zone, i) => (
              <Rect
                key={`zone-${i}`}
                x={0}
                y={zone.y}
                width={SCREEN_WIDTH * 4}  // wide enough for any layout
                height={zone.h}
                color={zone.color}
              />
            ))}

            {/* Edges */}
            {edges.map((edge, i) => {
              const { idx, total } = edgeParallelInfo[i] ?? { idx: 0, total: 1 }
              const edgeKey = [edge.source, edge.target].sort().join('|')
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
                  isMstEdge={!vizActive && mstEdgeSet.has(edgeKey)}
                />
              )
            })}

            {/* MST overlay (Prim's only) */}
            {vizActive && vizAlgorithm === 'prims' && (
              <MSTOverlay
                mstEdges={mstEdges}
                nodes={nodes}
                candidateEdge={candidateEdge}
              />
            )}

            {/* Path overlay (non-viz Dijkstra) */}
            {!vizActive && pathResult && (
              <PathOverlay path={pathResult.path} nodes={nodes} edges={edges} />
            )}

            {/* Nodes */}
            {nodes.map((node) => (
              <GraphNodeComponent
                key={node.id}
                node={node}
                selected={!vizActive && selectedNodes.includes(node.id)}
                isPeerHighlighted={!vizActive && selectedNodes.length === 1 && peerNodeIds.has(node.id)}
                peerCount={peerCountMap.get(node.id)}
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

      {/* Viz legend */}
      {vizActive && vizAlgorithm && (
        <VizLegend algorithm={vizAlgorithm} onDismiss={() => {}} hideClose={true} />
      )}

      {/* Node tooltip */}
      {tooltipDept && tooltipPos && !vizActive && selectedNodes.length === 1 && (
        <NodeTooltip
          dept={tooltipDept}
          screenX={tooltipPos.x}
          screenY={tooltipPos.y}
          peerCount={peerCountMap.get(tooltipNodeId!) ?? 0}
          nodeHeight={tooltipPos.nodeH}
          onClose={() => {
            setTooltipNodeId(null)
            setTooltipPos(null)
            setSelectedNodes([])
            selectedNodesRef.current = []
          }}
          onAnalyze={() => {
            setTooltipNodeId(null)
            setTooltipPos(null)
            setShowAlgoHint(false)
            onVisualize?.()
          }}
          onSimFailure={() => {
            if (tooltipNodeId) handleLongPress(
              tooltipPos.x,
              tooltipPos.y,
            )
          }}
        />
      )}

      {/* Bottom controls — zoom + analyze, grouped bottom-right */}
      <View style={styles.bottomControls}>
        {!vizActive && onVisualize && (
          <Pressable
            style={styles.analyzeCompact}
            onPress={() => {
              setShowAlgoHint(false)
              onVisualize()
            }}
          >
            <ChartBar size={15} color={Colors.white} weight="fill" />
            <Text style={styles.analyzeCompactText}>Analyze</Text>
          </Pressable>
        )}
        <View style={styles.zoomControls}>
          <Pressable
            style={styles.zoomButton}
            onPress={() => { scale.value = withSpring(Math.min(scale.value * 1.3, 5)) }}
          >
            <MagnifyingGlassPlus size={18} color="#E2E8F0" />
          </Pressable>
          <View style={styles.zoomDivider} />
          <Pressable
            style={styles.zoomButton}
            onPress={() => { scale.value = withSpring(Math.max(scale.value / 1.3, 0.3)) }}
          >
            <MagnifyingGlassMinus size={18} color="#E2E8F0" />
          </Pressable>
          <View style={styles.zoomDivider} />
          <Pressable
            style={styles.zoomButton}
            onPress={() => {
              scale.value      = withSpring(1)
              translateX.value = withSpring(0)
              translateY.value = withSpring(0)
            }}
          >
            <CornersOut size={18} color="#E2E8F0" />
          </Pressable>
        </View>
      </View>

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
            onPress={() => { clearFailureSim(); setShowFailureSheet(false) }}
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

  // ── Viz banner + speed dial ────────────────────────────────────────────────
  vizBanner: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(30,40,60,0.88)',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(99,132,255,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
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
    color: '#93C5FD',
  },
  speedDial: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    overflow: 'hidden',
    gap: 0,
  },
  speedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  speedBtnActive: {
    backgroundColor: Colors.primary,
  },
  speedBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  speedBtnTextActive: {
    color: Colors.white,
  },

  // ── Failure banner ─────────────────────────────────────────────────────────
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
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  failureBannerText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.white,
  },

  // ── Reset pill ─────────────────────────────────────────────────────────────
  resetPill: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(13,17,23,0.88)',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(99,132,255,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#93C5FD',
  },

  // ── Merged validation + algorithm status pill ──────────────────────────────
  statusPill: {
    position: 'absolute',
    top: 10,
    left: 12,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,17,23,0.80)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(99,132,255,0.15)',
  },
  statusPillBadge: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  statusPillDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(99,132,255,0.25)',
    marginHorizontal: 2,
  },
  statusPillItem: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: 'rgba(147,197,253,0.75)',
  },
  statusItemOk: {
    color: 'rgba(52,211,153,0.85)',
  },
  statusItemWarn: {
    color: 'rgba(245,158,11,0.9)',
  },
  statusDot: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: 'rgba(99,132,255,0.4)',
    marginHorizontal: 1,
  },

  // ── Bottom controls row (analyze + zoom) ──────────────────────────────────
  bottomControls: {
    position: 'absolute',
    bottom: 28,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  analyzeCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  analyzeCompactText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.white,
  },

  // ── Zoom controls pill ─────────────────────────────────────────────────────
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,17,23,0.88)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(99,132,255,0.18)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  zoomButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(99,132,255,0.18)',
  },

  // ── Explain toggle ─────────────────────────────────────────────────────────
  explainToggle: {
    position: 'absolute',
    top: 10,
    right: 16,
    zIndex: 11,
  },

  // ── Bottom sheet ───────────────────────────────────────────────────────────
  sheetContent:     { padding: 20, gap: 14 },
  sheetHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetTitle:       { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: Colors.textPrimary },
  sheetSubtitle:    { fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  sheetMetricsRow:  { flexDirection: 'row', gap: 10 },
  sheetMetric:      { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, gap: 4 },
  sheetMetricVal:   { fontFamily: 'Inter_600SemiBold', fontSize: 28 },
  sheetMetricLbl:   { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  sheetSection:     { gap: 8 },
  sheetSectionLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8, color: Colors.textMuted },
  sheetChipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sheetChip:        { backgroundColor: Colors.errorContainer, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: `${Colors.error}25` },
  sheetChipText:    { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.error },
  sheetDismissBtn:  { height: 48, borderRadius: 12, backgroundColor: Colors.errorContainer, borderWidth: 1, borderColor: `${Colors.error}30`, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  sheetDismissBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.error },
})
