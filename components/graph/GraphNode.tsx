// GraphNode.tsx
// Renders a single network node on the Skia canvas.
// Rounded rectangle, color by status, white label.

import React from 'react'
import { Group, RoundedRect, Text as SkiaText, matchFont, vec } from '@shopify/react-native-skia'
import { Colors } from '@/constants/colors'
import type { GraphNode } from '@/types'

const NODE_WIDTH = 120
const NODE_HEIGHT = 52
const NODE_RADIUS = 12

const STATUS_COLORS: Record<GraphNode['status'], string> = {
  valid: Colors.nodeValid,
  cycle: Colors.nodeCycle,
  isolated: Colors.nodeIsolated,
}

const TYPE_COLORS: Record<NonNullable<GraphNode['type']>, string> = {
  router: '#1E3A8A',     // Deep Navy Blue
  switch: '#0D9488',     // Teal
  firewall: '#C2410C',   // Rust Orange
  wan: '#047857',        // Forest Green
  department: Colors.nodeValid,
}

type GraphNodeProps = {
  node: GraphNode
  selected?: boolean
  font: ReturnType<typeof matchFont>
}

export function GraphNodeComponent({ node, selected, font }: GraphNodeProps) {
  const x = node.x - NODE_WIDTH / 2
  const y = node.y - NODE_HEIGHT / 2
  
  // Prioritize cycle or isolated status coloring; otherwise use role-specific coloring
  const fillColor = node.status !== 'valid' 
    ? STATUS_COLORS[node.status] 
    : (TYPE_COLORS[node.type ?? 'department'] ?? Colors.nodeValid)

  const getLabelWithPrefix = () => {
    switch (node.type) {
      case 'router':
        return `🖧 ${node.label}`
      case 'switch':
        return `🔀 ${node.label}`
      case 'firewall':
        return `🧱 ${node.label}`
      case 'wan':
        return `☁️ ${node.label}`
      default:
        return `🏢 ${node.label}`
    }
  }

  const labelText = getLabelWithPrefix()

  return (
    <Group>
      {/* Selection ring */}
      {selected && (
        <RoundedRect
          x={x - 4}
          y={y - 4}
          width={NODE_WIDTH + 8}
          height={NODE_HEIGHT + 8}
          r={NODE_RADIUS + 4}
          color={`${fillColor}40`}
        />
      )}
      {/* Node rectangle */}
      <RoundedRect
        x={x}
        y={y}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        r={NODE_RADIUS}
        color={fillColor}
      />
      {/* Node label */}
      {font && (
        <SkiaText
          x={node.x - (font.measureText(labelText.substring(0, 14)).width / 2)}
          y={node.y + 5}
          text={labelText.length > 14 ? `${labelText.substring(0, 13)}…` : labelText}
          font={font}
          color={Colors.white}
        />
      )}
    </Group>
  )
}

export { NODE_WIDTH, NODE_HEIGHT }
