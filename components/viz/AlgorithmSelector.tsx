// AlgorithmSelector.tsx
// Bottom sheet that lets the user choose which algorithm to visualize.
// For path-finding algorithms (Dijkstra, A*), shows a two-step flow:
//   1. Choose algorithm
//   2. Select source + target node from the topology
// For Cycle Detection and Topological Sort: runs immediately (no node selection needed).
// For Prim's (Optimal Wiring): requires a root node selection.

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native'
import {
  Compass,
  Target,
  ArrowsClockwise,
  ListNumbers,
  ShareNetwork,
} from 'phosphor-react-native'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { Colors } from '@/constants/colors'
import type { AlgorithmType, Department } from '@/types'

type AlgorithmCard = {
  type: AlgorithmType
  title: string
  subtitle: string
  description: string
  requiresSource: boolean
  requiresTarget: boolean
  requiresRoot: boolean
}

const ALGORITHMS: AlgorithmCard[] = [
  {
    type: 'dijkstra',
    title: 'Find Best Route',
    subtitle: 'Select the lowest-cost path between two devices',
    description: 'NetForge will trace the optimal path between two points on your network, counting hops and evaluating link costs. This is the same logic OSPF routers use when selecting next-hops.',
    requiresSource: true,
    requiresTarget: true,
    requiresRoot: false,
  },
  {
    type: 'aStar',
    title: 'Guided Path Search',
    subtitle: 'Faster route analysis with spatial awareness',
    description: 'Uses distance-to-target estimates to find a route more efficiently. Compare side-by-side with the standard route analysis to see which nodes were explored.',
    requiresSource: true,
    requiresTarget: true,
    requiresRoot: false,
  },
  {
    type: 'cycleDetection',
    title: 'Check for Routing Loops',
    subtitle: 'Detect circular paths that cause traffic storms',
    description: 'Scans your topology for routing loops — cyclic dependencies that would cause packets to loop indefinitely instead of reaching their destination. Essential before deploying a configuration.',
    requiresSource: false,
    requiresTarget: false,
    requiresRoot: false,
  },
  {
    type: 'topologicalSort',
    title: 'Deployment Order Analysis',
    subtitle: 'Determine safe device startup sequence',
    description: 'Analyzes your topology to determine the correct order for bringing devices online, ensuring upstream dependencies are ready before downstream devices activate.',
    requiresSource: false,
    requiresTarget: false,
    requiresRoot: false,
  },
  {
    type: 'prims',
    title: 'Optimal Cabling Plan',
    subtitle: 'Find the minimum links needed for full connectivity',
    description: "Identifies redundant links in your topology and shows the minimum set of connections needed to keep all devices reachable. Useful for cost optimization in campus and data center designs.",
    requiresSource: false,
    requiresTarget: false,
    requiresRoot: true,
  },
]

type AlgorithmSelectorProps = {
  visible: boolean
  onClose: () => void
  departments: Department[]
  onStart: (config: {
    algorithm: AlgorithmType
    sourceId?: string
    targetId?: string
    rootId?: string
    showSteps?: boolean
  }) => void
}

function getAlgoIcon(type: AlgorithmType, color: string, size: number) {
  switch (type) {
    case 'dijkstra':
      return <Compass size={size} color={color} weight="duotone" />
    case 'aStar':
      return <Target size={size} color={color} weight="duotone" />
    case 'cycleDetection':
      return <ArrowsClockwise size={size} color={color} weight="duotone" />
    case 'topologicalSort':
      return <ListNumbers size={size} color={color} weight="duotone" />
    case 'prims':
      return <ShareNetwork size={size} color={color} weight="duotone" />
    default:
      return null
  }
}

export function AlgorithmSelector({
  visible,
  onClose,
  departments,
  onStart,
}: AlgorithmSelectorProps) {
  const [step, setStep] = useState<'choose' | 'configure'>('choose')
  const [selected, setSelected] = useState<AlgorithmCard | null>(null)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [rootId, setRootId] = useState<string | null>(null)
  const [showSteps, setShowSteps] = useState(false)

  useEffect(() => {
    if (visible) {
      setStep('choose')
      setSelected(null)
      setSourceId(null)
      setTargetId(null)
      setRootId(null)
      setShowSteps(false)
    }
  }, [visible])

  const handleSelect = (algo: AlgorithmCard) => {
    setSelected(algo)
    setStep('configure')
  }

  const handleStart = () => {
    if (!selected) return
    onStart({
      algorithm: selected.type,
      sourceId: sourceId ?? undefined,
      targetId: targetId ?? undefined,
      rootId: rootId ?? undefined,
      showSteps,
    })
    onClose()
  }

  const canStart = !selected
    ? false
    : selected.requiresSource && !sourceId
    ? false
    : selected.requiresTarget && !targetId
    ? false
    : selected.requiresRoot && !rootId
    ? false
    : true

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={540}>
      {step === 'choose' ? (
        <>
          <Text style={s.title}>Analyze Network</Text>
          <Text style={s.subtitle}>Choose an analysis to run on your current topology</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            <View style={s.cards}>
              {ALGORITHMS.map((algo) => (
                <Pressable
                  key={algo.type}
                  style={s.algoCard}
                  onPress={() => handleSelect(algo)}
                >
                  <View style={s.cardLeft}>
                    <View style={s.iconContainer}>
                      {getAlgoIcon(algo.type, Colors.primary, 22)}
                    </View>
                    <View style={s.cardText}>
                      <Text style={s.algoTitle}>{algo.title}</Text>
                      <Text style={s.algoSubtitle}>{algo.subtitle}</Text>
                    </View>
                  </View>
                  <Text style={s.caret}>›</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </>
      ) : (
        <>
          <Pressable onPress={() => setStep('choose')} style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
          <Text style={s.title}>{selected?.title}</Text>
          <Text style={s.description}>{selected?.description}</Text>

          {/* Source node selection */}
          {selected?.requiresSource && (
            <View style={s.nodeSection}>
              <Text style={s.nodeLabel}>Source Node</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.nodeChips}>
                  {departments.map((dept) => (
                    <Pressable
                      key={dept.id}
                      style={[
                        s.nodeChip,
                        sourceId === dept.id && s.nodeChipActive,
                        targetId === dept.id && s.nodeChipDisabled,
                      ]}
                      onPress={() => {
                        if (targetId !== dept.id) setSourceId(dept.id)
                      }}
                    >
                      <Text style={[s.nodeChipText, sourceId === dept.id && s.nodeChipTextActive]}>
                        {dept.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Target node selection */}
          {selected?.requiresTarget && (
            <View style={s.nodeSection}>
              <Text style={s.nodeLabel}>Target Node</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.nodeChips}>
                  {departments.map((dept) => (
                    <Pressable
                      key={dept.id}
                      style={[
                        s.nodeChip,
                        targetId === dept.id && s.nodeChipActiveGreen,
                        sourceId === dept.id && s.nodeChipDisabled,
                      ]}
                      onPress={() => {
                        if (sourceId !== dept.id) setTargetId(dept.id)
                      }}
                    >
                      <Text style={[s.nodeChipText, targetId === dept.id && s.nodeChipTextActiveGreen]}>
                        {dept.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Root node selection (Prim's) */}
          {selected?.requiresRoot && (
            <View style={s.nodeSection}>
              <Text style={s.nodeLabel}>Start From Node</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.nodeChips}>
                  {departments.map((dept) => (
                    <Pressable
                      key={dept.id}
                      style={[s.nodeChip, rootId === dept.id && s.nodeChipActive]}
                      onPress={() => setRootId(dept.id)}
                    >
                      <Text style={[s.nodeChipText, rootId === dept.id && s.nodeChipTextActive]}>
                        {dept.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Toggle showSteps details */}
          <Pressable
            style={s.toggleRow}
            onPress={() => setShowSteps(!showSteps)}
          >
            <View style={s.toggleLeft}>
              <Text style={s.toggleTitle}>Show Step-by-Step Analysis</Text>
              <Text style={s.toggleSubtitle}>
                Reveal how NetForge arrived at this result, with a running breakdown of each decision.
              </Text>
            </View>
            <View
              style={[s.switchTrack, showSteps ? s.switchTrackActive : s.switchTrackInactive]}
            >
              <View style={[s.switchThumb, showSteps ? s.switchThumbActive : s.switchThumbInactive]} />
            </View>
          </Pressable>

          <View style={{ marginTop: 8 }}>
            <Button
              label="Run Analysis"
              variant="primary"
              fullWidth
              disabled={!canStart}
              onPress={handleStart}
            />
          </View>
        </>
      )}
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 16,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  cards: { gap: 10 },
  algoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: `${Colors.primary}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  algoTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  algoSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  caret: {
    fontSize: 20,
    color: Colors.pale,
    fontFamily: 'Inter_400Regular',
  },
  backBtn: { marginBottom: 12 },
  backText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.primary,
  },
  nodeSection: { marginBottom: 12 },
  nodeLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  nodeChips: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  nodeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nodeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  nodeChipActiveGreen: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  nodeChipDisabled: { opacity: 0.35 },
  nodeChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textPrimary,
  },
  nodeChipTextActive: { color: Colors.white },
  nodeChipTextActiveGreen: { color: Colors.white },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleLeft: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
  },
  toggleSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: Colors.primary,
  },
  switchTrackInactive: {
    backgroundColor: Colors.border,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  switchThumbInactive: {
    alignSelf: 'flex-start',
  },
})
