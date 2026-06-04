// GraphEdge.tsx — v2: Weight-based stroke width + link type labels
//
// Link type → visual encoding (professional network diagram conventions):
//   wan     → thickest stroke (4.0), amber/teal tint
//   routed  → thick stroke (3.0), type-derived colour
//   trunk   → medium (2.5), brighter variant
//   access  → thin (2.0), muted, type-derived colour
//
// Viz mode overrides colour/width with algorithm state colours.
// Weight pill shows actual cost during weighted algorithm runs.

import React from 'react'
import { Path, Text as SkiaText, RoundedRect, matchFont } from '@shopify/react-native-skia'
import { Colors } from '@/constants/colors'
import type { GraphNode, GraphEdge, Department, EdgeVizState } from '@/types'
import { useVisualizationStore } from '@/stores/useVisualizationStore'

// ── Arrow constants ───────────────────────────────────────────────────────────
const ARROW_SIZE = 9

// ── Viz state colour overrides ────────────────────────────────────────────────
const VIZ_EDGE_COLORS: Partial<Record<EdgeVizState, string>> = {
  'back-edge': Colors.vizCycle,
  'path':      Colors.vizPath,
  'active':    Colors.vizInQueue,
  'mst':       Colors.vizMstEdge,
  'candidate': Colors.vizCandidate,
}

// ── Per-type default edge tints ───────────────────────────────────────────────
const TYPE_EDGE_COLOR: Record<string, string> = {
  router:     '#3B82F6',   // blue
  switch:     '#10B981',   // emerald
  firewall:   '#F97316',   // orange
  wan:        '#2DD4BF',   // teal
  department: '#60A5FA',   // sky blue
}

// ── Link type → stroke width ──────────────────────────────────────────────────
const LINK_STROKE: Record<string, number> = {
  wan:     4.0,
  routed:  3.0,
  trunk:   2.5,
  access:  1.8,
}

// ── Link type → dash pattern label ────────────────────────────────────────────
const LINK_LABEL: Record<string, string> = {
  wan:    'WAN',
  routed: 'L3',
  trunk:  'Trunk',
  access: 'Access',
}

const portFont = matchFont({
  fontFamily: 'monospace',
  fontSize: 8,
  fontWeight: 'normal',
})

const weightFont = matchFont({
  fontFamily: 'monospace',
  fontSize: 9,
  fontWeight: 'normal',
})

const linkTypeFont = matchFont({
  fontFamily: 'monospace',
  fontSize: 7,
  fontWeight: 'normal',
})

type GraphEdgeProps = {
  edge: GraphEdge
  nodes: GraphNode[]
  departments?: Department[]
  font?: ReturnType<typeof matchFont>
  highlighted?: boolean
  vizEdgeState?: EdgeVizState
  parallelIndex?: number
  parallelTotal?: number
}

/**
 * Quadratic bezier path with perpendicular control-point offset for parallel edges.
 * parallelIndex=0 + parallelTotal=1 → straight line.
 */
function buildCurvedEdgePath(
  x1: number, y1: number,
  x2: number, y2: number,
  parallelIndex: number,
  parallelTotal: number,
): { linePath: string; arrowPath: string; midX: number; midY: number } | null {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)
  if (length === 0) return null

  const ux = dx / length
  const uy = dy / length

  // Perpendicular direction
  const px = -uy
  const py =  ux

  // Fan out parallel edges
  let curveOffset = 0
  if (parallelTotal > 1) {
    const step = 38
    const range = step * (parallelTotal - 1)
    curveOffset = parallelIndex * step - range / 2
  }

  // Quadratic bezier control point
  const midX = (x1 + x2) / 2 + px * curveOffset
  const midY = (y1 + y2) / 2 + py * curveOffset

  // Clip to node border (approximate half-extents)
  const getT = (uX: number, uY: number) => {
    const tX = uX !== 0 ? 86 / Math.abs(uX) : Infinity
    const tY = uY !== 0 ? 36 / Math.abs(uY) : Infinity  // updated for taller nodes
    return Math.min(tX, tY)
  }
  const tStart = getT(ux, uy)
  const tEnd   = getT(-ux, -uy)

  const startX = x1 + ux * tStart
  const startY = y1 + uy * tStart
  const endX   = x2 - ux * tEnd
  const endY   = y2 - uy * tEnd

  // Tangent at end for arrowhead direction
  const tangentX = endX - midX
  const tangentY = endY - midY
  const tLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY)
  const tuX  = tLen > 0 ? tangentX / tLen : ux
  const tuY  = tLen > 0 ? tangentY / tLen : uy

  const baseX = endX - tuX * ARROW_SIZE
  const baseY = endY - tuY * ARROW_SIZE
  const perpX = -tuY * ARROW_SIZE * 0.36
  const perpY =  tuX * ARROW_SIZE * 0.36

  const leftX  = baseX + perpX
  const leftY  = baseY + perpY
  const rightX = baseX - perpX
  const rightY = baseY - perpY

  const linePath  = `M ${startX} ${startY} Q ${midX} ${midY} ${baseX} ${baseY}`
  const arrowPath = `M ${endX} ${endY} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`

  return { linePath, arrowPath, midX, midY }
}

export function GraphEdgeComponent({
  edge,
  nodes,
  departments,
  highlighted = false,
  vizEdgeState,
  parallelIndex = 0,
  parallelTotal = 1,
}: GraphEdgeProps) {
  const source = nodes.find((n) => n.id === edge.source)
  const target = nodes.find((n) => n.id === edge.target)
  if (!source || !target) return null

  const geom = buildCurvedEdgePath(
    source.x, source.y,
    target.x, target.y,
    parallelIndex,
    parallelTotal,
  )
  if (!geom) return null

  // ── Source / target department lookup ────────────────────────────────────
  const sourceDept = departments?.find((d) => d.id === edge.source)
  const targetDept = departments?.find((d) => d.id === edge.target)

  // ── Port names ───────────────────────────────────────────────────────────
  let sourcePortName = ''
  let targetPortName = ''
  if (sourceDept && targetDept && sourceDept.ports) {
    const port = sourceDept.ports.find((p) => p.connectedToNodeId === targetDept.id)
    if (port) {
      const shorten = (name: string) =>
        name
          .replace('GigabitEthernet', 'Gi')
          .replace('FastEthernet', 'Fa')
          .replace('Ethernet', 'Et')
          .replace('Serial', 'Se')
      sourcePortName = shorten(port.name)
      if (port.connectedToPortId && targetDept.ports) {
        const tPort = targetDept.ports.find((p) => p.id === port.connectedToPortId)
        if (tPort) targetPortName = shorten(tPort.name)
      }
    }
  }
  const showPorts = (sourcePortName || targetPortName) && !vizEdgeState

  // ── Link type + base colour ───────────────────────────────────────────────
  const linkType   = edge.linkType ?? 'access'
  const edgeWeight = edge.weight ?? 1
  const sourceType = sourceDept?.type ?? source.type ?? 'department'
  const defaultColor = TYPE_EDGE_COLOR[sourceType] ?? '#475569'

  // ── Visual state resolution ───────────────────────────────────────────────
  let edgeColor: string
  let strokeWidth: number

  if (highlighted) {
    edgeColor   = Colors.vizPath
    strokeWidth = 4.0
  } else if (vizEdgeState && vizEdgeState !== 'default') {
    edgeColor   = VIZ_EDGE_COLORS[vizEdgeState] ?? defaultColor
    strokeWidth = vizEdgeState === 'back-edge' ? 4.5 : 3.2
  } else {
    edgeColor   = defaultColor
    strokeWidth = LINK_STROKE[linkType] ?? 2.0
  }

  // Glow beneath edge — wider, semi-transparent
  const glowColor =
    highlighted
      ? `${Colors.vizPath}38`
      : vizEdgeState && vizEdgeState !== 'default'
        ? `${edgeColor}30`
        : `${defaultColor}20`

  const vizActive     = useVisualizationStore((s) => s.isActive)
  const vizAlgorithm  = useVisualizationStore((s) => s.algorithm)
  const isWeightedAlgo = vizActive && (
    vizAlgorithm === 'dijkstra' ||
    vizAlgorithm === 'aStar'    ||
    vizAlgorithm === 'prims'
  )

  // ── Label positions (~30% and ~70% along the curve) ──────────────────────
  const srcLabelX = source.x + (geom.midX - source.x) * 0.58
  const srcLabelY = source.y + (geom.midY - source.y) * 0.58
  const tgtLabelX = target.x + (geom.midX - target.x) * 0.58
  const tgtLabelY = target.y + (geom.midY - target.y) * 0.58

  const PILL_PX = 4
  const PILL_PY = 2
  const PILL_H  = 13

  const srcW    = portFont.measureText(sourcePortName).width
  const tgtW    = portFont.measureText(targetPortName).width
  const weightText = String(edgeWeight)
  const weightW    = weightFont.measureText(weightText).width

  // Link type label (shown when NOT in viz mode and NOT showing port labels)
  const showLinkLabel = !vizActive && !showPorts && linkType !== 'access'
  const linkLabelText = LINK_LABEL[linkType] ?? ''
  const linkLabelW    = linkTypeFont ? linkTypeFont.measureText(linkLabelText).width : 0

  return (
    <>
      {/* Glow halo beneath edge */}
      <Path
        path={geom.linePath}
        color={glowColor}
        style="stroke"
        strokeWidth={strokeWidth + 6}
      />

      {/* Main edge line */}
      <Path
        path={geom.linePath}
        color={edgeColor}
        style="stroke"
        strokeWidth={strokeWidth}
      />

      {/* Arrowhead */}
      <Path path={geom.arrowPath} color={edgeColor} style="fill" />

      {/* Weight label (weighted algorithm viz only) */}
      {isWeightedAlgo && (
        <>
          <RoundedRect
            x={geom.midX - weightW / 2 - PILL_PX}
            y={geom.midY - PILL_H / 2 - PILL_PY / 2}
            width={weightW + PILL_PX * 2}
            height={PILL_H + PILL_PY}
            r={4}
            color="rgba(13,17,23,0.85)"
          />
          <SkiaText
            x={geom.midX - weightW / 2}
            y={geom.midY + PILL_H / 2 - 2}
            text={weightText}
            font={weightFont}
            color={edgeColor}
          />
        </>
      )}

      {/* Link type label (non-viz, non-port mode, WAN / L3 / Trunk only) */}
      {showLinkLabel && linkTypeFont && (
        <>
          <RoundedRect
            x={geom.midX - linkLabelW / 2 - 4}
            y={geom.midY - 7}
            width={linkLabelW + 8}
            height={13}
            r={3}
            color="rgba(13,17,23,0.70)"
          />
          <SkiaText
            x={geom.midX - linkLabelW / 2}
            y={geom.midY + 4}
            text={linkLabelText}
            font={linkTypeFont}
            color={`${edgeColor}CC`}
          />
        </>
      )}

      {/* Port name pills */}
      {showPorts && (
        <>
          {sourcePortName && (
            <>
              <RoundedRect
                x={srcLabelX - srcW / 2 - PILL_PX}
                y={srcLabelY - PILL_H / 2 - PILL_PY / 2}
                width={srcW + PILL_PX * 2}
                height={PILL_H + PILL_PY}
                r={4}
                color="rgba(13,17,23,0.72)"
              />
              <SkiaText
                x={srcLabelX - srcW / 2}
                y={srcLabelY + PILL_H / 2 - 2}
                text={sourcePortName}
                font={portFont}
                color="#C8D8EE"
              />
            </>
          )}
          {targetPortName && (
            <>
              <RoundedRect
                x={tgtLabelX - tgtW / 2 - PILL_PX}
                y={tgtLabelY - PILL_H / 2 - PILL_PY / 2}
                width={tgtW + PILL_PX * 2}
                height={PILL_H + PILL_PY}
                r={4}
                color="rgba(13,17,23,0.72)"
              />
              <SkiaText
                x={tgtLabelX - tgtW / 2}
                y={tgtLabelY + PILL_H / 2 - 2}
                text={targetPortName}
                font={portFont}
                color="#C8D8EE"
              />
            </>
          )}
        </>
      )}
    </>
  )
}
