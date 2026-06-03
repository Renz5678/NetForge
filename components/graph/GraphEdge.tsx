import React from 'react'
import { Path, Text as SkiaText, RoundedRect, matchFont } from '@shopify/react-native-skia'
import { Colors } from '@/constants/colors'
import type { GraphNode, GraphEdge, Department, EdgeVizState } from '@/types'
import { useVisualizationStore } from '@/stores/useVisualizationStore'

// ── Arrow constants ───────────────────────────────────────────────────────────
const ARROW_SIZE = 10

// Visualization edge color overrides
const VIZ_EDGE_COLORS: Partial<Record<EdgeVizState, string>> = {
  'back-edge': Colors.vizCycle,
  'path':      Colors.vizPath,
  'active':    Colors.vizInQueue,
  'mst':       Colors.vizMstEdge,
  'candidate': Colors.vizCandidate,
}

// Per source-type edge tint (default state only)
const TYPE_EDGE_COLOR: Record<string, string> = {
  router:     '#2563EB',  // blue
  switch:     '#059669',  // emerald
  firewall:   '#D97706',  // amber
  wan:        '#0D9488',  // teal
  department: '#3B82F6',  // sky blue
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

type GraphEdgeProps = {
  edge: GraphEdge
  nodes: GraphNode[]
  departments?: Department[]
  font?: ReturnType<typeof matchFont>
  highlighted?: boolean
  vizEdgeState?: EdgeVizState
  /** Index among parallel edges between same node pair (0 = straight, 1 = offset right, etc.) */
  parallelIndex?: number
  parallelTotal?: number
}

/**
 * Returns a quadratic bezier path string with a perpendicular control point offset.
 * When parallelIndex = 0 and parallelTotal = 1, offset = 0 (straight line).
 * For multiple parallel edges, each gets a different signed offset so they fan out.
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

  // Compute offset for this edge among parallel edges
  // 0 → straight; 1 of 2 → +40; 2 of 2 → -40; etc.
  let curveOffset = 0
  if (parallelTotal > 1) {
    const step = 38
    const range = step * (parallelTotal - 1)
    curveOffset = parallelIndex * step - range / 2
  }

  // Quadratic bezier control point
  const midX = (x1 + x2) / 2 + px * curveOffset
  const midY = (y1 + y2) / 2 + py * curveOffset

  // Compute border offsets: approximate start/end on node borders
  const getT = (uX: number, uY: number) => {
    const tX = uX !== 0 ? 86 / Math.abs(uX) : Infinity
    const tY = uY !== 0 ? 29 / Math.abs(uY) : Infinity
    return Math.min(tX, tY)
  }
  const tStart = getT(ux, uy)
  const tEnd   = getT(-ux, -uy)

  const startX = x1 + ux * tStart
  const startY = y1 + uy * tStart
  const endX   = x2 - ux * tEnd
  const endY   = y2 - uy * tEnd

  // Direction at end of bezier curve (tangent toward end point from control point)
  const tangentX = endX - midX
  const tangentY = endY - midY
  const tLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY)
  const tuX = tLen > 0 ? tangentX / tLen : ux
  const tuY = tLen > 0 ? tangentY / tLen : uy

  // Arrowhead at endX/endY
  const baseX = endX - tuX * ARROW_SIZE
  const baseY = endY - tuY * ARROW_SIZE
  const perpX = -tuY * ARROW_SIZE * 0.38
  const perpY =  tuX * ARROW_SIZE * 0.38

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
    parallelTotal
  )
  if (!geom) return null

  // Port names
  const sourceDept = departments?.find((d) => d.id === edge.source)
  const targetDept = departments?.find((d) => d.id === edge.target)

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

  // Edge color: default uses source type tint; viz overrides
  const sourceType = sourceDept?.type ?? source.type ?? 'department'
  const defaultColor = TYPE_EDGE_COLOR[sourceType] ?? '#475569'

  let edgeColor: string = highlighted ? Colors.primary : defaultColor
  let strokeWidth = highlighted ? 3.5 : 2.0

  if (vizEdgeState && vizEdgeState !== 'default') {
    edgeColor = VIZ_EDGE_COLORS[vizEdgeState] ?? defaultColor
    strokeWidth = vizEdgeState === 'back-edge' ? 4.5 : 3.0
  }

  // Glow beneath edge
  const glowColor =
    vizEdgeState && vizEdgeState !== 'default'
      ? `${edgeColor}30`
      : highlighted
        ? `${Colors.primary}30`
        : `${defaultColor}22`

  const vizActive = useVisualizationStore((s) => s.isActive)
  const vizAlgorithm = useVisualizationStore((s) => s.algorithm)
  const isWeightedAlgo = vizActive && (vizAlgorithm === 'dijkstra' || vizAlgorithm === 'aStar' || vizAlgorithm === 'prims')

  // Port label positions along the curve (~28% and ~72%)
  const srcLabelX = source.x + (geom.midX - source.x) * 0.56
  const srcLabelY = source.y + (geom.midY - source.y) * 0.56
  const tgtLabelX = target.x + (geom.midX - target.x) * 0.56
  const tgtLabelY = target.y + (geom.midY - target.y) * 0.56

  const PILL_PADDING_X = 4
  const PILL_PADDING_Y = 2
  const PILL_H = 13

  const srcW = portFont.measureText(sourcePortName).width
  const tgtW = portFont.measureText(targetPortName).width
  const weightText = '1'
  const weightW = weightFont.measureText(weightText).width

  return (
    <>
      {/* Glow halo beneath edge */}
      <Path
        path={geom.linePath}
        color={glowColor}
        style="stroke"
        strokeWidth={strokeWidth + 5}
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

      {/* Weight label (weighted algorithms only) */}
      {isWeightedAlgo && (
        <>
          <RoundedRect
            x={geom.midX - weightW / 2 - PILL_PADDING_X}
            y={geom.midY - PILL_H / 2 - PILL_PADDING_Y / 2}
            width={weightW + PILL_PADDING_X * 2}
            height={PILL_H + PILL_PADDING_Y}
            r={4}
            color="rgba(20,30,50,0.78)"
          />
          <SkiaText
            x={geom.midX - weightW / 2}
            y={geom.midY + PILL_H / 2 - 2}
            text={weightText}
            font={weightFont}
            color="#C8D8EE"
          />
        </>
      )}

      {/* Port labels */}
      {showPorts && (
        <>
          {sourcePortName && (
            <>
              <RoundedRect
                x={srcLabelX - srcW / 2 - PILL_PADDING_X}
                y={srcLabelY - PILL_H / 2 - PILL_PADDING_Y / 2}
                width={srcW + PILL_PADDING_X * 2}
                height={PILL_H + PILL_PADDING_Y}
                r={4}
                color="rgba(20,30,50,0.72)"
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
                x={tgtLabelX - tgtW / 2 - PILL_PADDING_X}
                y={tgtLabelY - PILL_H / 2 - PILL_PADDING_Y / 2}
                width={tgtW + PILL_PADDING_X * 2}
                height={PILL_H + PILL_PADDING_Y}
                r={4}
                color="rgba(20,30,50,0.72)"
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
