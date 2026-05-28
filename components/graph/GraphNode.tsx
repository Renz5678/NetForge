// GraphNode.tsx
// Renders a single network node on the Skia canvas.
// Rounded rectangle, color by status, white label.
// When vizState is provided (during algorithm visualization), the node's fill
// color is overridden using the visualization color language.

import React from 'react'
import { Platform } from 'react-native'
import { Group, RoundedRect, Text as SkiaText, matchFont, vec, ImageSVG, useSVG } from '@shopify/react-native-skia'
import { Colors } from '@/constants/colors'
import type { GraphNode, NodeVizState } from '@/types'

const subFont = matchFont({
  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  fontSize: 8.5,
  fontWeight: 'normal',
})

const NODE_WIDTH = 148 // Slightly wider to fit icon + text comfortably
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

// Visualization color overrides — applied when vizState prop is set
const VIZ_COLORS: Record<NodeVizState, string> = {
  unvisited:   Colors.vizUnvisited,
  inQueue:     Colors.vizInQueue,
  inStack:     Colors.vizInStack,
  settled:     Colors.vizSettled,
  cycle:       Colors.vizCycle,
  path:        Colors.vizPath,
  mstIncluded: Colors.vizSettled,
  mstFrontier: Colors.vizInQueue,
}

// States that should show a glow ring (actively being processed)
const GLOW_STATES: Set<NodeVizState> = new Set(['inQueue', 'inStack', 'mstFrontier', 'path'])

type GraphNodeProps = {
  node: GraphNode
  selected?: boolean
  font: ReturnType<typeof matchFont>
  vizState?: NodeVizState  // when set, overrides normal status coloring
}

export function GraphNodeComponent({ node, selected, font, vizState }: GraphNodeProps) {
  const x = node.x - NODE_WIDTH / 2
  const y = node.y - NODE_HEIGHT / 2

  // If in visualization mode, use the viz color language.
  // Otherwise fall back to normal status/type coloring.
  const fillColor = vizState
    ? VIZ_COLORS[vizState]
    : node.status !== 'valid'
      ? STATUS_COLORS[node.status]
      : (TYPE_COLORS[node.type ?? 'department'] ?? Colors.nodeValid)

  const showGlow = vizState ? GLOW_STATES.has(vizState) : false

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

  const subtext = node.subnet && node.subnet !== '—'
    ? `${node.subnet} · V:${node.vlanId}`
    : node.type ? `${node.type.toUpperCase()}` : ''

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
      {/* Visualization glow ring (pulsing halo for active states) */}
      {showGlow && (
        <RoundedRect
          x={x - 6}
          y={y - 6}
          width={NODE_WIDTH + 12}
          height={NODE_HEIGHT + 12}
          r={NODE_RADIUS + 6}
          color={`${fillColor}30`}
        />
      )}
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
            <>
              <SkiaText
                x={x + 44}
                y={node.y - 2}
                text={node.label.length > 15 ? `${node.label.substring(0, 14)}…` : node.label}
                font={font}
                color={Colors.white}
              />
              {subFont && (
                <SkiaText
                  x={x + 44}
                  y={node.y + 13}
                  text={subtext}
                  font={subFont}
                  color="#E2E8F0"
                />
              )}
            </>
          )}
        </Group>
      ) : (
        font && (
          <>
            <SkiaText
              x={node.x - (font.measureText(getLabelWithPrefix().substring(0, 14)).width / 2)}
              y={node.y - 2}
              text={getLabelWithPrefix().length > 14 ? `${getLabelWithPrefix().substring(0, 13)}…` : getLabelWithPrefix()}
              font={font}
              color={Colors.white}
            />
            {subFont && (
              <SkiaText
                x={node.x - (subFont.measureText(subtext).width / 2)}
                y={node.y + 13}
                text={subtext}
                font={subFont}
                color="#E2E8F0"
              />
            )}
          </>
        )
      )}
    </Group>
  )
}

export { NODE_WIDTH, NODE_HEIGHT }
