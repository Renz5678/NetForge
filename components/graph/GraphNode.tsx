// GraphNode.tsx
// Renders a single network node on the Skia canvas.
//
// Layout (left → right inside the card):
//   [TYPE BADGE 32×32] [label 12px bold]
//                      [subnet · VLAN 8px mono]
//
// NO SVG icons — they cause viewBox scaling bugs in Skia on Android/web.
// Instead, each device type gets a colored pill badge with a 2-letter abbreviation.
//
// Skia Text y = baseline (not top), so all y values are computed as:
//   baseline = topOfNode + topPadding + fontSize

import React from 'react'
import {
  Group,
  RoundedRect,
  Rect,
  Text as SkiaText,
  matchFont,
} from '@shopify/react-native-skia'
import { Platform } from 'react-native'
import { Colors } from '@/constants/colors'
import type { GraphNode, NodeVizState } from '@/types'

// ── Node dimensions ────────────────────────────────────────────────────────
export const NODE_WIDTH  = 164
export const NODE_HEIGHT = 54
const RADIUS = 13

// ── Fonts ──────────────────────────────────────────────────────────────────
const labelFont = matchFont({
  fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  fontSize:   12,
  fontWeight: 'bold',
})

const subFont = matchFont({
  fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  fontSize:   8,
  fontWeight: 'normal',
})

const badgeFont = matchFont({
  fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  fontSize:   11,
  fontWeight: 'bold',
})

// ── Color maps ─────────────────────────────────────────────────────────────
const TYPE_FILL: Record<string, string> = {
  router:     '#1D4ED8',
  switch:     '#0F766E',
  firewall:   '#B45309',
  wan:        '#065F46',
  department: '#3B82F6',
}

const TYPE_BADGE_FILL: Record<string, string> = {
  router:     'rgba(255,255,255,0.22)',
  switch:     'rgba(255,255,255,0.22)',
  firewall:   'rgba(255,255,255,0.22)',
  wan:        'rgba(255,255,255,0.22)',
  department: 'rgba(255,255,255,0.22)',
}

const TYPE_ABBR: Record<string, string> = {
  router:     'RT',
  switch:     'SW',
  firewall:   'FW',
  wan:        'WAN',
  department: 'DEP',
}

const STATUS_FILL: Record<string, string> = {
  valid:    Colors.nodeValid,
  cycle:    Colors.nodeCycle,
  isolated: Colors.nodeIsolated,
}

const VIZ_FILL: Record<NodeVizState, string> = {
  unvisited:   Colors.vizUnvisited,
  inQueue:     Colors.vizInQueue,
  inStack:     Colors.vizInStack,
  settled:     Colors.vizSettled,
  cycle:       Colors.vizCycle,
  path:        Colors.vizPath,
  mstIncluded: Colors.vizSettled,
  mstFrontier: Colors.vizInQueue,
}

const GLOW_STATES = new Set<NodeVizState>(['inQueue','inStack','mstFrontier','path'])

// ── Layout constants ───────────────────────────────────────────────────────
const BADGE_W      = 34
const BADGE_H      = 34
const BADGE_LEFT   = 10
const BADGE_TOP    = (NODE_HEIGHT - BADGE_H) / 2   // = 10

const TEXT_LEFT    = BADGE_LEFT + BADGE_W + 10      // = 54

// Two-line block: 12 (label) + 5 (gap) + 8 (sub) = 25px
// Centered in NODE_HEIGHT=54 → top of block at (54-25)/2 = 14.5
const LABEL_TOP    = (NODE_HEIGHT - 25) / 2         // 14.5
const LABEL_BASE   = LABEL_TOP + 12                 // 26.5 → baseline of label
const SUB_BASE     = LABEL_TOP + 12 + 5 + 8         // 39.5 → baseline of subtext

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

type Props = {
  node: GraphNode
  selected?: boolean
  font: ReturnType<typeof matchFont>  // kept for API compat
  vizState?: NodeVizState
}

export function GraphNodeComponent({ node, selected, vizState }: Props) {
  const nx = node.x - NODE_WIDTH / 2
  const ny = node.y - NODE_HEIGHT / 2

  const typeKey = node.type ?? 'department'

  // Card fill
  const fill = vizState
    ? VIZ_FILL[vizState]
    : node.status !== 'valid'
      ? STATUS_FILL[node.status]
      : (TYPE_FILL[typeKey] ?? TYPE_FILL.department)

  const showGlow = vizState ? GLOW_STATES.has(vizState) : false

  // Badge abbreviation
  const abbr = TYPE_ABBR[typeKey] ?? 'DEP'

  // Label and subtext — measured and truncated
  const labelText = truncate(node.label, 14)
  const subtext   = node.subnet && node.subnet !== '—'
    ? truncate(`${node.subnet}  V${node.vlanId}`, 20)
    : typeKey.toUpperCase()

  // Badge font offset (center the abbreviation inside the badge)
  const abbrW   = badgeFont ? badgeFont.measureText(abbr).width : 0
  const abbrX   = nx + BADGE_LEFT + (BADGE_W - abbrW) / 2
  const abbrY   = ny + BADGE_TOP + (BADGE_H + 10) / 2  // vertically center baseline

  return (
    <Group>
      {/* Glow halo */}
      {showGlow && (
        <RoundedRect
          x={nx - 8} y={ny - 8}
          width={NODE_WIDTH + 16} height={NODE_HEIGHT + 16}
          r={RADIUS + 8}
          color={`${fill}30`}
        />
      )}

      {/* Selection ring */}
      {selected && (
        <RoundedRect
          x={nx - 4} y={ny - 4}
          width={NODE_WIDTH + 8} height={NODE_HEIGHT + 8}
          r={RADIUS + 4}
          color="rgba(255,255,255,0.30)"
        />
      )}

      {/* Card background */}
      <RoundedRect
        x={nx} y={ny}
        width={NODE_WIDTH} height={NODE_HEIGHT}
        r={RADIUS}
        color={fill}
      />

      {/* Left accent strip — stays within card thanks to Group clipping via RoundedRect */}
      <Rect
        x={nx}
        y={ny + RADIUS}
        width={4}
        height={NODE_HEIGHT - RADIUS * 2}
        color="rgba(255,255,255,0.28)"
      />

      {/* Badge pill */}
      <RoundedRect
        x={nx + BADGE_LEFT} y={ny + BADGE_TOP}
        width={BADGE_W} height={BADGE_H}
        r={8}
        color={TYPE_BADGE_FILL[typeKey] ?? 'rgba(255,255,255,0.20)'}
      />

      {/* Badge label */}
      {badgeFont && (
        <SkiaText
          x={abbrX}
          y={abbrY}
          text={abbr}
          font={badgeFont}
          color="rgba(255,255,255,0.95)"
        />
      )}

      {/* Node label */}
      {labelFont && (
        <SkiaText
          x={nx + TEXT_LEFT}
          y={ny + LABEL_BASE}
          text={labelText}
          font={labelFont}
          color="#FFFFFF"
        />
      )}

      {/* Subnet / VLAN subtext */}
      {subFont && (
        <SkiaText
          x={nx + TEXT_LEFT}
          y={ny + SUB_BASE}
          text={subtext}
          font={subFont}
          color="rgba(210,228,255,0.85)"
        />
      )}
    </Group>
  )
}
