// NetworkGraph.tsx
// Full canvas graph renderer using @shopify/react-native-skia.
// Pan + pinch zoom via GestureDetector.
// Node tap: single = tooltip, two nodes = Dijkstra path.

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
} from 'react-native-reanimated'
import { Colors } from '@/constants/colors'
import { useGraphLayout } from '@/hooks/useGraphLayout'
import { findShortestPath } from '@/lib/algorithms/dijkstra'
import { GraphNodeComponent, NODE_WIDTH, NODE_HEIGHT } from './GraphNode'
import { GraphEdgeComponent } from './GraphEdge'
import { PathOverlay } from './PathOverlay'
import type { Department, PathResult } from '@/types'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const CANVAS_HEIGHT = SCREEN_HEIGHT - 200

const systemFont = matchFont({
  fontFamily: Platform.OS === 'ios' ? 'Helvetica' : 'sans-serif',
  fontSize: 12,
  fontWeight: 'bold',
})

type NetworkGraphProps = {
  departments: Department[]
  onPathFound?: (result: PathResult | null, nodeIds: string[]) => void
}

export function NetworkGraph({ departments, onPathFound }: NetworkGraphProps) {
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [pathResult, setPathResult] = useState<PathResult | null>(null)

  // Pan & zoom
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const scale = useSharedValue(1)
  const savedTranslateX = useSharedValue(0)
  const savedTranslateY = useSharedValue(0)
  const savedScale = useSharedValue(1)

  const { nodes, edges } = useGraphLayout(departments, SCREEN_WIDTH, CANVAS_HEIGHT)

  const hitTestNode = useCallback(
    (touchX: number, touchY: number): string | null => {
      // Convert screen touch to canvas coordinates
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
      const tappedId = hitTestNode(touchX, touchY)

      if (!tappedId) {
        // Tapped empty space — clear selection
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
          // Run Dijkstra
          const result = findShortestPath(departments, prev[0], tappedId)
          setPathResult(result)
          onPathFound?.(result, newSelected)
          return newSelected
        } else {
          return [tappedId]
        }
      })
    },
    [hitTestNode, departments, onPathFound]
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

  return (
    <View style={styles.container}>
      {/* Reset selection pill */}
      {selectedNodes.length > 0 && (
        <Pressable style={styles.resetPill} onPress={handleReset}>
          <Text style={styles.resetText}>↺ Reset selection</Text>
        </Pressable>
      )}

      <GestureDetector gesture={composedGesture}>
        <Canvas style={styles.canvas}>
          <Group transform={[
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
          ]}>
            {/* Render edges first (behind nodes) */}
            {edges.map((edge, i) => (
              <GraphEdgeComponent
                key={`edge-${i}`}
                edge={edge}
                nodes={nodes}
                departments={departments}
                font={systemFont}
              />
            ))}

            {/* Path overlay */}
            {pathResult && (
              <PathOverlay path={pathResult.path} nodes={nodes} edges={edges} />
            )}

            {/* Render nodes */}
            {nodes.map((node) => (
              <GraphNodeComponent
                key={node.id}
                node={node}
                selected={selectedNodes.includes(node.id)}
                font={systemFont}
              />
            ))}
          </Group>
        </Canvas>
      </GestureDetector>

      {/* Zoom controls */}
      <View style={styles.zoomControls}>
        <Pressable
          style={styles.zoomButton}
          onPress={() => {
            scale.value = withSpring(Math.min(scale.value * 1.3, 5))
          }}
        >
          <Text style={styles.zoomText}>+</Text>
        </Pressable>
        <Pressable
          style={styles.zoomButton}
          onPress={() => {
            scale.value = withSpring(Math.max(scale.value / 1.3, 0.3))
          }}
        >
          <Text style={styles.zoomText}>−</Text>
        </Pressable>
        <Pressable
          style={styles.zoomButton}
          onPress={() => {
            scale.value = withSpring(1)
            translateX.value = withSpring(0)
            translateY.value = withSpring(0)
          }}
        >
          <Text style={styles.zoomText}>⊡</Text>
        </Pressable>
      </View>
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
})
