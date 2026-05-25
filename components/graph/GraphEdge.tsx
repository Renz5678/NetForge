import React from 'react'
import { Path, Text as SkiaText, matchFont } from '@shopify/react-native-skia'
import { Colors } from '@/constants/colors'
import type { GraphNode, GraphEdge, Department } from '@/types'

const ARROW_SIZE = 10

type GraphEdgeProps = {
  edge: GraphEdge
  nodes: GraphNode[]
  departments?: Department[]
  font?: ReturnType<typeof matchFont>
  highlighted?: boolean
}

function getArrowPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  nodeRadius: number
): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)
  if (length === 0) return ''

  const ux = dx / length
  const uy = dy / length

  // Start point: offset from source center (edge of node rectangle ~136px wide, half is 68px)
  const startX = x1 + ux * 68
  const startY = y1 + uy * 26

  // End point: offset from target center (stop before the node edge)
  const endX = x2 - ux * (68 + ARROW_SIZE)
  const endY = y2 - uy * (26 + ARROW_SIZE)

  // Perpendicular vectors for arrowhead
  const perpX = -uy * ARROW_SIZE * 0.5
  const perpY = ux * ARROW_SIZE * 0.5

  // Arrowhead triangle tip
  const tipX = x2 - ux * 68
  const tipY = y2 - uy * 26

  return [
    `M ${startX} ${startY}`,
    `L ${endX} ${endY}`,
    `M ${endX + perpX} ${endY + perpY}`,
    `L ${tipX} ${tipY}`,
    `L ${endX - perpX} ${endY - perpY}`,
    'Z',
  ].join(' ')
}

export function GraphEdgeComponent({
  edge,
  nodes,
  departments,
  font,
  highlighted = false,
}: GraphEdgeProps) {
  const source = nodes.find((n) => n.id === edge.source)
  const target = nodes.find((n) => n.id === edge.target)

  if (!source || !target) return null

  const pathData = getArrowPath(source.x, source.y, target.x, target.y, 68)
  if (!pathData) return null

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

  const dx = target.x - source.x
  const dy = target.y - source.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const ux = length > 0 ? dx / length : 0
  const uy = length > 0 ? dy / length : 0

  const showPorts = font && (sourcePortName || targetPortName)

  return (
    <>
      <Path
        path={pathData}
        color={highlighted ? Colors.primary : Colors.medium}
        style="stroke"
        strokeWidth={highlighted ? 2.5 : 1.5}
      />
      {showPorts && (
        <>
          {sourcePortName && (
            <SkiaText
              x={source.x + ux * 83 - font.measureText(sourcePortName).width / 2}
              y={source.y + uy * 36 + 4}
              text={sourcePortName}
              font={font}
              color={Colors.textSecondary}
            />
          )}
          {targetPortName && (
            <SkiaText
              x={target.x - ux * 93 - font.measureText(targetPortName).width / 2}
              y={target.y - uy * 36 + 4}
              text={targetPortName}
              font={font}
              color={Colors.textSecondary}
            />
          )}
        </>
      )}
    </>
  )
}
