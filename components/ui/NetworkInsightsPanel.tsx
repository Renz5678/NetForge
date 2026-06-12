// NetworkInsightsPanel.tsx  (Topology Performance Dashboard)
//
// Replaces the original insight-feed panel with a horizontally-scrollable
// metrics dashboard for the active network configuration.
//
// Metrics displayed (all derived from the active config's departments array):
//   • Nodes          — total NetworkNode count
//   • Links          — unique undirected edge count
//   • Avg Degree     — (2 × edges) / nodes
//   • Density        — (2 × edges) / (nodes × (nodes - 1))  [0..100%]
//   • Subnets        — count of departments with an allocated subnet
//   • ACL Rules      — total aclRules across all firewall-type nodes
//   • Redundancy     — (non-AP nodes / total nodes) × 100  [requires AP data from store]
//   • Topology Health — composite derived from validation results
//
// The panel is scroll-only (no collapse). It renders as a horizontal FlatList
// of MetricTile cards, each optionally showing an icon, progress bar, or
// custom value color.

import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import {
  Graph,
  Link,
  CircleHalf,
  Shield,
  WifiHigh,
  ListNumbers,
  Pulse,
  ArrowsOut,
} from 'phosphor-react-native'
import { Colors } from '@/constants/colors'
import { useConfigStore } from '@/stores/useConfigStore'
import { useVisualizationStore } from '@/stores/useVisualizationStore'
import { MetricTile } from '@/components/ui/MetricTile'

type NetworkInsightsPanelProps = {
  /** Legacy prop — kept for backward compat with any existing callers. No-op in this implementation. */
  onRunAlgorithm?: (algorithmKey: string) => void
}

export function NetworkInsightsPanel({ onRunAlgorithm: _onRunAlgorithm }: NetworkInsightsPanelProps) {
  const activeConfig = useConfigStore((s) => s.activeConfig)
  const criticalNodeIds = useVisualizationStore((s) => s.criticalNodeIds)

  const metrics = useMemo(() => {
    const depts = activeConfig?.departments ?? []
    const nodeCount = depts.length

    if (nodeCount === 0) {
      return null
    }

    // Edge count: sum all dept.peers / 2 (each edge appears in both endpoints)
    // We deduplicate to handle the case where peers[] might not be perfectly symmetric
    const edgeSet = new Set<string>()
    for (const dept of depts) {
      for (const peerId of dept.peers) {
        const key = [dept.id, peerId].sort().join('→')
        edgeSet.add(key)
      }
    }
    const edgeCount = edgeSet.size

    // Average degree = 2E / V  (sum of all degrees / nodeCount)
    const avgDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0

    // Network density = 2E / (V × (V-1))  — percentage of possible edges that exist
    const maxPossibleEdges = nodeCount > 1 ? (nodeCount * (nodeCount - 1)) / 2 : 0
    const density = maxPossibleEdges > 0 ? (edgeCount / maxPossibleEdges) * 100 : 0

    // Subnets allocated
    const subnetCount = depts.filter((d) => d.subnet !== undefined).length

    // ACL rules on firewall nodes
    const aclRuleCount = depts
      .filter((d) => d.type === 'firewall')
      .reduce((sum, d) => sum + (d.aclRules?.length ?? 0), 0)

    // Redundancy score:
    //   If AP detection has run (criticalNodeIds has data), use real AP count.
    //   Otherwise, approximate: a fully-connected mesh has no single points of failure.
    //   Formula: ((nodeCount - apCount) / nodeCount) × 100
    const apCount = criticalNodeIds.length
    const redundancyScore = nodeCount > 0
      ? Math.round(((nodeCount - apCount) / nodeCount) * 100)
      : 100

    // Topology health composite:
    //   - Good (success): density > 0.3 AND no APs
    //   - Fair (warning): density > 0.1 OR apCount === 0
    //   - Poor (error):   density <= 0.1 AND apCount > 0
    const densityRatio = density / 100
    let healthLabel = 'Good'
    let healthColor: string = Colors.success
    if (densityRatio <= 0.1 && apCount > 0) {
      healthLabel = 'Poor'
      healthColor = Colors.error
    } else if (densityRatio <= 0.3 || apCount > 0) {
      healthLabel = 'Fair'
      healthColor = Colors.warning
    }

    return {
      nodeCount,
      edgeCount,
      avgDegree: avgDegree.toFixed(1),
      density: Math.round(density),
      subnetCount,
      aclRuleCount,
      redundancyScore,
      healthLabel,
      healthColor,
    }
  }, [activeConfig?.departments, criticalNodeIds])

  if (!activeConfig || !metrics) {
    return null
  }

  const tiles = [
    {
      id: 'nodes',
      label: 'Nodes',
      value: metrics.nodeCount,
      icon: <Graph size={16} color={Colors.primary} weight="duotone" />,
    },
    {
      id: 'links',
      label: 'Links',
      value: metrics.edgeCount,
      icon: <Link size={16} color={Colors.medium} weight="duotone" />,
      valueColor: Colors.medium,
    },
    {
      id: 'density',
      label: 'Density',
      value: `${metrics.density}%`,
      icon: <ArrowsOut size={16} color={Colors.primary} weight="duotone" />,
      progressValue: metrics.density,
    },
    {
      id: 'avgdeg',
      label: 'Avg Degree',
      value: metrics.avgDegree,
      icon: <CircleHalf size={16} color={Colors.medium} weight="duotone" />,
      valueColor: Colors.medium,
    },
    {
      id: 'subnets',
      label: 'Subnets',
      value: metrics.subnetCount,
      icon: <WifiHigh size={16} color={Colors.primary} weight="duotone" />,
    },
    {
      id: 'acl',
      label: 'ACL Rules',
      value: metrics.aclRuleCount,
      icon: <Shield size={16} color={Colors.warning} weight="duotone" />,
      valueColor: metrics.aclRuleCount > 0 ? Colors.warning : Colors.textMuted,
    },
    {
      id: 'redundancy',
      label: 'Redundancy',
      value: `${metrics.redundancyScore}%`,
      icon: <ListNumbers size={16} color={metrics.redundancyScore >= 80 ? Colors.success : Colors.warning} weight="duotone" />,
      valueColor: metrics.redundancyScore >= 80 ? Colors.success : Colors.warning,
      progressValue: metrics.redundancyScore,
    },
    {
      id: 'health',
      label: 'Health',
      value: metrics.healthLabel,
      icon: <Pulse size={16} color={metrics.healthColor} weight="duotone" />,
      valueColor: metrics.healthColor,
    },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>TOPOLOGY METRICS</Text>
        <Text style={styles.configLabel} numberOfLines={1}>{activeConfig.name}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tilesRow}
        decelerationRate="fast"
        snapToInterval={106}  // tile width (90) + gap (16)
      >
        {tiles.map((tile) => (
          <MetricTile
            key={tile.id}
            label={tile.label}
            value={tile.value}
            icon={tile.icon}
            progressValue={tile.progressValue}
            valueColor={tile.valueColor}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    color: Colors.textMuted,
  },
  configLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    maxWidth: 160,
  },
  tilesRow: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
  },
})
