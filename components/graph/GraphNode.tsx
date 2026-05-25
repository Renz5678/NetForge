// GraphNode.tsx
// Renders a single network node on the Skia canvas.
// Rounded rectangle, color by status, white label.

import React from 'react'
import { Group, RoundedRect, Text as SkiaText, matchFont, vec, ImageSVG, useSVG } from '@shopify/react-native-skia'
import { Colors } from '@/constants/colors'
import type { GraphNode } from '@/types'

const NODE_WIDTH = 136 // Slightly wider to fit icon + text comfortably
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

  // Load SVG assets inside component using Skia's useSVG hook
  // We use relative paths for Metro bundler resolution
  const routerSvg = useSVG(require('../../assets/icons/router.svg'))
  const switchSvg = useSVG(require('../../assets/icons/switch.svg'))
  const firewallSvg = useSVG(require('../../assets/icons/firewall.svg'))
  const wanSvg = useSVG(require('../../assets/icons/wan.svg'))
  const departmentSvg = useSVG(require('../../assets/icons/department.svg'))

  const getSvg = () => {
    switch (node.type) {
      case 'router':
        return routerSvg
      case 'switch':
        return switchSvg
      case 'firewall':
        return firewallSvg
      case 'wan':
        return wanSvg
      default:
        return departmentSvg
    }
  }

  const svg = getSvg()

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
      
      {/* Render SVG Icon if successfully loaded, otherwise fallback to unicode character prefix */}
      {svg ? (
        <Group>
          <ImageSVG
            svg={svg}
            x={x + 10}
            y={y + (NODE_HEIGHT - 28) / 2}
            width={28}
            height={28}
          />
          {font && (
            <SkiaText
              x={x + 46}
              y={node.y + 5}
              text={node.label.length > 10 ? `${node.label.substring(0, 9)}…` : node.label}
              font={font}
              color={Colors.white}
            />
          )}
        </Group>
      ) : (
        font && (
          <SkiaText
            x={node.x - (font.measureText(getLabelWithPrefix().substring(0, 14)).width / 2)}
            y={node.y + 5}
            text={getLabelWithPrefix().length > 14 ? `${getLabelWithPrefix().substring(0, 13)}…` : getLabelWithPrefix()}
            font={font}
            color={Colors.white}
          />
        )
      )}
    </Group>
  )
}

export { NODE_WIDTH, NODE_HEIGHT }
