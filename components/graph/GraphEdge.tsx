import React from 'react'
import { Path, Text as SkiaText, RoundedRect, matchFont } from '@shopify/react-native-skia'
import { Colors } from '@/constants/colors'
import type { GraphNode, GraphEdge, Department, EdgeVizState } from '@/types'
import { useVisualizationStore } from '@/stores/useVisualizationStore'

const ARROW_SIZE = 8

// Edge color mappings for visualization mode
const VIZ_EDGE_COLORS: Partial<Record<EdgeVizState, string>> = {
  'back-edge': Colors.vizCycle,
  'path':      Colors.vizPath,
  'active':    Colors.vizInQueue,
  'mst':       Colors.vizMstEdge,
  'candidate': Colors.vizCandidate,
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
  vizEdgeState?: EdgeVizState  // when set, overrides highlighted/default coloring
}

/**
 * Calculates the exact line and arrowhead geometry using ray-box intersection.
 * This guarantees the line starts exactly at the border of the source node (160x56)
 * and ends exactly at the border of the target node at any angle.
 */
function getEdgeGeometry(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  arrowSize = 8
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)
  if (length === 0) return null

  const ux = dx / length
  const uy = dy / length

  // Bounding box intersection for node (160 wide x 56 tall)
  // We want to find the scale factor t such that (ux*t, uy*t) is on the boundary
  const getT = (uX: number, uY: number) => {
    const tX = uX !== 0 ? 80 / Math.abs(uX) : Infinity
    const tY = uY !== 0 ? 28 / Math.abs(uY) : Infinity
    return Math.min(tX, tY)
  }

  const tStart = getT(ux, uy)
  const tEnd = getT(-ux, -uy)

  const startX = x1 + ux * tStart
  const startY = y1 + uy * tStart

  const tipX = x2 - ux * tEnd
  const tipY = y2 - uy * tEnd

  // Calculate base and corners of the solid-filled arrowhead
  const baseX = tipX - ux * arrowSize
  const baseY = tipY - uy * arrowSize

  const perpX = -uy * arrowSize * 0.4
  const perpY =  ux * arrowSize * 0.4

  const leftX = baseX + perpX
  const leftY = baseY + perpY
  const rightX = baseX - perpX
  const rightY = baseY - perpY

  const linePath = `M ${startX} ${startY} L ${baseX} ${baseY}`
  const arrowPath = `M ${tipX} ${tipY} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`

  return { linePath, arrowPath }
}

export function GraphEdgeComponent({
  edge,
  nodes,
  departments,
  font,
  highlighted = false,
  vizEdgeState,
}: GraphEdgeProps) {
  const source = nodes.find((n) => n.id === edge.source)
  const target = nodes.find((n) => n.id === edge.target)

  if (!source || !target) return null

  const geom = getEdgeGeometry(source.x, source.y, target.x, target.y, ARROW_SIZE)
  if (!geom) return null

  // Resolve port bindings if departments list is provided
  const sourceDept = departments?.find((d) => d.id === edge.source)
  const targetDept = departments?.find((d) => d.id === edge.target)

  let sourcePortName = ''
  let targetPortName = ''

  if (sourceDept && targetDept && sourceDept.ports) {
    const port = sourceDept.ports.find((p) => p.connectedToNodeId === targetDept.id)
    if (port) {
      const shorten = (name: string) =>
        name
          .replace('GigabitEthernet', 'g')
          .replace('FastEthernet', 'f')
          .replace('Ethernet', 'e')
          .replace('Port', 'p')
      
      sourcePortName = shorten(port.name)
      if (port.connectedToPortId && targetDept.ports) {
        const tPort = targetDept.ports.find((p) => p.id === port.connectedToPortId)
        if (tPort) {
          targetPortName = shorten(tPort.name)
        }
      }
    }
  }

  const showPorts = (sourcePortName || targetPortName) && !vizEdgeState

  // Determine edge color and width based on viz state or highlight
  // Default color is high-contrast Slate-600 (#475569) instead of low-contrast light blue.
  let edgeColor: string = highlighted ? Colors.primary : '#475569'
  let strokeWidth = highlighted ? 3.5 : 2.0 // Increased thickness for sharper definition

  if (vizEdgeState && vizEdgeState !== 'default') {
    edgeColor = VIZ_EDGE_COLORS[vizEdgeState] ?? '#475569'
    strokeWidth = vizEdgeState === 'back-edge' ? 4.0 : 3.0
  }

  const vizActive = useVisualizationStore((s) => s.isActive)
  const vizAlgorithm = useVisualizationStore((s) => s.algorithm)
  const isWeightedAlgo = vizActive && (vizAlgorithm === 'dijkstra' || vizAlgorithm === 'aStar' || vizAlgorithm === 'prims')

  // Port label positions: 1/3 and 2/3 along the edge
  const t1 = 0.28  // source-side label
  const t2 = 0.72  // target-side label
  const srcLabelX = source.x + (target.x - source.x) * t1
  const srcLabelY = source.y + (target.y - source.y) * t1
  const tgtLabelX = source.x + (target.x - source.x) * t2
  const tgtLabelY = source.y + (target.y - source.y) * t2

  // Center position for edge weight
  const midX = source.x + (target.x - source.x) * 0.5
  const midY = source.y + (target.y - source.y) * 0.5

  const PILL_PADDING_X = 5
  const PILL_PADDING_Y = 3
  const PILL_H = 14

  const srcW = portFont.measureText(sourcePortName).width
  const tgtW = portFont.measureText(targetPortName).width
  const weightText = "1"
  const weightW = weightFont.measureText(weightText).width

  return (
    <>
      {/* The main connection line (stops exactly at the flat base of the arrowhead) */}
      <Path
        path={geom.linePath}
        color={edgeColor}
        style="stroke"
        strokeWidth={strokeWidth}
      />
      {/* Solid filled arrowhead pointing precisely at the node card boundary */}
      <Path
        path={geom.arrowPath}
        color={edgeColor}
        style="fill"
      />

      {isWeightedAlgo && (
        <>
          <RoundedRect
            x={midX - weightW / 2 - PILL_PADDING_X}
            y={midY - PILL_H / 2 - PILL_PADDING_Y / 2}
            width={weightW + PILL_PADDING_X * 2}
            height={PILL_H + PILL_PADDING_Y}
            r={4}
            color="rgba(30,42,60,0.72)"
          />
          <SkiaText
            x={midX - weightW / 2}
            y={midY + PILL_H / 2 - 2}
            text={weightText}
            font={weightFont}
            color="#C8D8EE"
          />
        </>
      )}

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
                color="rgba(30,42,60,0.72)"
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
                color="rgba(30,42,60,0.72)"
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
