// NetworkInsightsPanel.tsx
// A persistent slide-up panel that surfaces auto-detected network findings.
// Each insight shows severity, explanation, suggested action, and an optional
// "Learn More" button that reveals the algorithm behind the finding.
//
// Philosophy: Insights are presented as networking problems first.
// The algorithm is revealed only when the user taps "Learn More".

import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  LayoutAnimation,
} from 'react-native'
import {
  Warning,
  Info,
  XCircle,
  CheckCircle,
  CaretDown,
  CaretUp,
  X,
  Lightbulb,
  ArrowRight,
} from 'phosphor-react-native'
import { Colors } from '@/constants/colors'
import { useConfigStore } from '@/stores/useConfigStore'
import type { NetworkInsight, InsightSeverity } from '@/types'

type NetworkInsightsPanelProps = {
  onRunAlgorithm?: (algorithmKey: string) => void
}

function getSeverityConfig(severity: InsightSeverity) {
  switch (severity) {
    case 'error':
      return {
        icon: <XCircle size={16} color={Colors.error} weight="fill" />,
        color: Colors.error,
        bg: Colors.errorContainer,
        border: `${Colors.error}30`,
        label: 'CRITICAL',
      }
    case 'warning':
      return {
        icon: <Warning size={16} color={Colors.warning} weight="fill" />,
        color: Colors.warning,
        bg: Colors.warningContainer,
        border: `${Colors.warning}30`,
        label: 'WARNING',
      }
    case 'info':
    default:
      return {
        icon: <Info size={16} color={Colors.primary} weight="fill" />,
        color: Colors.primary,
        bg: Colors.ice,
        border: `${Colors.primary}30`,
        label: 'INFO',
      }
  }
}

type InsightCardProps = {
  insight: NetworkInsight
  onDismiss: (id: string) => void
  onRunAlgorithm?: (algorithmKey: string) => void
}

function InsightCard({ insight, onDismiss, onRunAlgorithm }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showAlgo, setShowAlgo] = useState(false)
  const sev = getSeverityConfig(insight.severity)

  const handleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded(!expanded)
  }

  return (
    <View style={[styles.card, { borderLeftColor: sev.color, borderLeftWidth: 3 }]}>
      <Pressable onPress={handleExpand} style={styles.cardHeader}>
        <View style={[styles.severityBadge, { backgroundColor: sev.bg }]}>
          {sev.icon}
        </View>
        <View style={styles.cardTitleArea}>
          <Text style={[styles.cardTitle, { color: Colors.textPrimary }]} numberOfLines={2}>
            {insight.title}
          </Text>
          <Text style={[styles.severityLabel, { color: sev.color }]}>{sev.label}</Text>
        </View>
        <View style={styles.cardActions}>
          <Pressable
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
              onDismiss(insight.id)
            }}
            hitSlop={8}
          >
            <X size={14} color={Colors.textMuted} />
          </Pressable>
          {expanded ? (
            <CaretUp size={14} color={Colors.textMuted} />
          ) : (
            <CaretDown size={14} color={Colors.textMuted} />
          )}
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.cardBody}>
          {/* Explanation */}
          <Text style={styles.cardExplanation}>{insight.explanation}</Text>

          {/* Suggested Action */}
          <View style={styles.actionRow}>
            <Lightbulb size={13} color={Colors.primary} weight="fill" />
            <Text style={styles.actionText}>{insight.suggestedAction}</Text>
          </View>

          {/* Learn More / Algorithm reveal */}
          {insight.algorithmRef && (
            <View style={styles.algoSection}>
              <Pressable
                style={styles.learnMoreBtn}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                  setShowAlgo(!showAlgo)
                }}
              >
                <Info size={13} color={Colors.primary} />
                <Text style={styles.learnMoreText}>
                  {showAlgo ? 'Hide technical details' : 'Learn more'}
                </Text>
              </Pressable>

              {showAlgo && (
                <View style={styles.algoReveal}>
                  <Text style={styles.algoRevealText}>
                    This finding was calculated using{' '}
                    <Text style={styles.algoName}>{insight.algorithmRef}</Text>.
                  </Text>
                  {insight.algorithmKey && onRunAlgorithm && (
                    <Pressable
                      style={styles.runAlgoBtn}
                      onPress={() => onRunAlgorithm(insight.algorithmKey!)}
                    >
                      <Text style={styles.runAlgoBtnText}>Visualize this analysis</Text>
                      <ArrowRight size={12} color={Colors.primary} />
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  )
}

export function NetworkInsightsPanel({ onRunAlgorithm }: NetworkInsightsPanelProps) {
  const insights = useConfigStore((s) => s.insights)
  const removeInsight = useConfigStore((s) => s.removeInsight)
  const clearInsights = useConfigStore((s) => s.clearInsights)

  const [collapsed, setCollapsed] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current

  const hasInsights = insights.length > 0
  const errorCount = insights.filter((i) => i.severity === 'error').length
  const warningCount = insights.filter((i) => i.severity === 'warning').length

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: hasInsights ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start()
  }, [hasInsights, slideAnim])

  if (!hasInsights) return null

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setCollapsed(!collapsed)
  }

  return (
    <View style={styles.container}>
      {/* Panel Header */}
      <Pressable onPress={handleToggle} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconRow}>
            {errorCount > 0 && (
              <View style={[styles.countBadge, { backgroundColor: Colors.error }]}>
                <Text style={styles.countBadgeText}>{errorCount}</Text>
              </View>
            )}
            {warningCount > 0 && (
              <View style={[styles.countBadge, { backgroundColor: Colors.warning }]}>
                <Text style={styles.countBadgeText}>{warningCount}</Text>
              </View>
            )}
            {errorCount === 0 && warningCount === 0 && (
              <CheckCircle size={14} color={Colors.success} weight="fill" />
            )}
          </View>
          <Text style={styles.headerTitle}>
            Network Insights
          </Text>
          <Text style={styles.headerCount}>
            {insights.length}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {!collapsed && (
            <Pressable
              onPress={clearInsights}
              style={styles.clearBtn}
              hitSlop={8}
            >
              <Text style={styles.clearBtnText}>Clear all</Text>
            </Pressable>
          )}
          {collapsed ? (
            <CaretUp size={14} color={Colors.textMuted} />
          ) : (
            <CaretDown size={14} color={Colors.textMuted} />
          )}
        </View>
      </Pressable>

      {/* Insight Cards */}
      {!collapsed && (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
          nestedScrollEnabled
        >
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onDismiss={removeInsight}
              onRunAlgorithm={onRunAlgorithm}
            />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  countBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.white,
  },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
  },
  headerCount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
    backgroundColor: Colors.ice,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
  },
  list: {
    maxHeight: 280,
  },
  listContent: {
    padding: 10,
    gap: 8,
  },

  // Card styles
  card: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  severityBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitleArea: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  severityLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  cardBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  cardExplanation: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: `${Colors.primary}08`,
    borderRadius: 8,
    padding: 10,
  },
  actionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.primary,
    flex: 1,
    lineHeight: 17,
  },
  algoSection: {
    gap: 6,
  },
  learnMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  learnMoreText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },
  algoReveal: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    gap: 8,
  },
  algoRevealText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  algoName: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textPrimary,
  },
  runAlgoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  runAlgoBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },
})
