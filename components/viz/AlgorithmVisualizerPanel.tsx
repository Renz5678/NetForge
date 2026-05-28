// AlgorithmVisualizerPanel.tsx
// The main algorithm visualization panel — a bottom sheet showing:
//   1. Plain-English explanation of the current step
//   2. Internal data structure state (priority queue / DFS stack / etc.)
//   3. Playback controls: Step Back | Play/Pause | Step Forward
//   4. Progress scrubber
//   5. Speed selector
// Subscribes to useVisualizationStore for all state.
// The panel is ~65% of screen height so the graph canvas remains visible above.

import React, { useEffect, useRef } from 'react'
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
import type { Department } from '@/types'

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.45 // Reduced from 0.62 to be less intrusive
const COLLAPSED_HEIGHT = 220 // Slightly more compact

type AlgorithmVisualizerPanelProps = {
  departments: Department[]
}

function getAlgorithmLabel(algorithm: string): string {
  switch (algorithm) {
    case 'dijkstra': return "Dijkstra's Shortest Path"
    case 'aStar': return 'A* Guided Search'
    case 'cycleDetection': return 'Cycle Detection'
    case 'topologicalSort': return 'Topological Sort'
    case 'prims': return 'Optimal Wiring (Prim\'s MST)'
    default: return algorithm
  }
}

function getExplanationColor(explanation: string): string {
  if (explanation.includes('cycle') || explanation.includes('Cycle') || explanation.includes('Back-edge')) {
    return Colors.vizCycle
  }
  if (explanation.includes('complete') || explanation.includes('Complete') || explanation.includes('done') || explanation.includes('found')) {
    return Colors.vizSettled
  }
  return Colors.textPrimary
}

export function AlgorithmVisualizerPanel({ departments }: AlgorithmVisualizerPanelProps) {
  const insets = useSafeAreaInsets()
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current

  const isActive = useVisualizationStore((s) => s.isActive)
  const algorithm = useVisualizationStore((s) => s.algorithm)
  const steps = useVisualizationStore((s) => s.steps)
  const currentStepIndex = useVisualizationStore((s) => s.currentStepIndex)
  const isPlaying = useVisualizationStore((s) => s.isPlaying)
  const speed = useVisualizationStore((s) => s.speed)
  const isExpanded = useVisualizationStore((s) => s.isExpanded)
  const showSteps = useVisualizationStore((s) => s.showSteps)

  const { stopVisualization, play, pause, stepForward, stepBack, setStep, setSpeed, setIsExpanded, setShowSteps, _advanceStep } =
    useVisualizationStore()

  const currentStep = steps[currentStepIndex] ?? null
  const totalSteps = steps.length

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
    const currentPanelHeight = showSteps ? (isExpanded ? PANEL_HEIGHT : COLLAPSED_HEIGHT) : 72
    if (isActive) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 12,
      }).start()
    } else {
      Animated.timing(translateY, {
        toValue: currentPanelHeight,
        duration: 240,
        useNativeDriver: true,
      }).start()
    }
  }, [isActive, isExpanded, showSteps, translateY])

  if (!isActive || !algorithm || !currentStep) return null

  const progress = totalSteps > 1 ? currentStepIndex / (totalSteps - 1) : 0
  const explanationColor = getExplanationColor(currentStep.explanation)
  const currentPanelHeight = showSteps ? (isExpanded ? PANEL_HEIGHT : COLLAPSED_HEIGHT) : 72

  const deptList = departments.map((d) => ({ id: d.id, name: d.name }))

  const handleToggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setIsExpanded(!isExpanded)
  }

  // Render a minimal floating bar if showSteps is disabled
  if (!showSteps) {
    return (
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
              Step {currentStepIndex + 1} of {totalSteps} • {Math.round(progress * 100)}%
            </Text>
          </View>

          <View style={styles.miniActions}>
            {/* Play/Pause */}
            <Pressable
              onPress={isPlaying ? pause : play}
              style={styles.miniActionBtn}
              hitSlop={8}
            >
              <Text style={styles.miniActionIcon}>{isPlaying ? '⏸' : '▶'}</Text>
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
              <Text style={styles.miniCloseText}>✕</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    )
  }

  return (
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
            <Text style={styles.algoBadgeText}>ALGO</Text>
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
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      {/* Step counter + progress bar */}
      <View style={styles.progressRow}>
        <Text style={styles.stepCounter}>
          Step {currentStepIndex + 1} of {totalSteps}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.stepCounter}>{Math.round(progress * 100)}%</Text>
      </View>

      {/* Explanation card */}
      <View style={[styles.explanationCard, { borderLeftColor: explanationColor }]}>
        <Text style={[styles.explanationText, { color: explanationColor }]} numberOfLines={isExpanded ? undefined : 2}>
          {currentStep.explanation}
        </Text>
      </View>

      {/* Data structure display */}
      {isExpanded && (
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
          <Text style={styles.controlIcon}>⏮</Text>
        </Pressable>

        {/* Play / Pause */}
        <Pressable
          onPress={isPlaying ? pause : play}
          style={[styles.controlBtn, styles.controlBtnPlay]}
        >
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </Pressable>

        {/* Step forward */}
        <Pressable
          onPress={() => stepForward()}
          style={[styles.controlBtn, currentStepIndex === totalSteps - 1 && styles.controlBtnDisabled]}
          disabled={currentStepIndex === totalSteps - 1}
        >
          <Text style={styles.controlIcon}>⏭</Text>
        </Pressable>
      </View>

      {/* Speed selector */}
      {isExpanded && (
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
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 24, // Float above bottom edge
    left: 16,
    right: 16,
    backgroundColor: Colors.white,
    borderRadius: 24, // Round all corners for floating effect
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
  closeText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  stepCounter: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    minWidth: 70,
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
  controlIcon: {
    fontSize: 18,
    color: Colors.textPrimary,
  },
  playIcon: {
    fontSize: 22,
    color: Colors.white,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 2,
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
  miniActionIcon: {
    fontSize: 12,
    color: Colors.primary,
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
  miniCloseText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
})
