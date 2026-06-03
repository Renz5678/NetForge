// GraphNode.tsx — enhanced visual design
// Each device type has a distinct color palette, icon abbreviation, and shape treatment.
// Rendering order (back → front):
//   1. Drop shadow rect (depth)
//   2. Pulse ring (viz animation)
//   3. Glow halo (viz queue states)
//   4. Critical/failed rings
//   5. Selection ring
//   6. Card background (rounded rect)
//   7. Top accent bar (device-type tint)
//   8. Badge (pill with abbreviation)
//   9. Labels
//   10. Viz state label chip

import React from 'react'
import {
  Group,
  RoundedRect,
  Rect,
  Text as SkiaText,
  matchFont,
  Circle,
  Path,
  LinearGradient,
  vec,
} from '@shopify/react-native-skia'
import { Platform } from 'react-native'
import { Colors } from '@/constants/colors'
import type { GraphNode, NodeVizState } from '@/types'
import { useVisualizationStore } from '@/stores/useVisualizationStore'
import { useSharedValue, useDerivedValue, withRepeat, withTiming } from 'react-native-reanimated'

// ── Node dimensions ──────────────────────────────────────────────────────────
export const NODE_WIDTH  = 172
export const NODE_HEIGHT = 58
const RADIUS = 14

// ── Fonts ────────────────────────────────────────────────────────────────────
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
  fontSize:   10,
  fontWeight: 'bold',
})

const stateFont = matchFont({
  fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  fontSize:   9,
  fontWeight: 'bold',
})

// ── Per-type visual identity ─────────────────────────────────────────────────
// Each device type has: card fill, darker accent, badge fill, abbreviation
const TYPE_IDENTITY: Record<string, {
  fill: string
  accent: string     // top accent strip color (slightly lighter/contrasting)
  badgeBg: string
  abbr: string
}> = {
  router: {
    fill:    '#1E3A8A',   // deep navy blue
    accent:  '#3B82F6',   // bright blue
    badgeBg: 'rgba(59,130,246,0.40)',
    abbr:    'RT',
  },
  switch: {
    fill:    '#065F46',   // deep emerald
    accent:  '#10B981',   // emerald green
    badgeBg: 'rgba(16,185,129,0.40)',
    abbr:    'SW',
  },
  firewall: {
    fill:    '#7C2D12',   // deep rust
    accent:  '#F97316',   // orange
    badgeBg: 'rgba(249,115,22,0.40)',
    abbr:    'FW',
  },
  wan: {
    fill:    '#134E4A',   // dark teal
    accent:  '#2DD4BF',   // teal
    badgeBg: 'rgba(45,212,191,0.40)',
    abbr:    'WAN',
  },
  department: {
    fill:    '#1E40AF',   // rich blue
    accent:  '#60A5FA',   // light blue
    badgeBg: 'rgba(96,165,250,0.35)',
    abbr:    'DEP',
  },
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

// ── Layout constants ─────────────────────────────────────────────────────────
const BADGE_W      = 38
const BADGE_H      = 38
const BADGE_LEFT   = 10
const BADGE_TOP    = (NODE_HEIGHT - BADGE_H) / 2

const TEXT_LEFT    = BADGE_LEFT + BADGE_W + 10

// Two-line block: 12 (label) + 5 (gap) + 8 (sub) = 25px
const LABEL_TOP    = (NODE_HEIGHT - 25) / 2
const LABEL_BASE   = LABEL_TOP + 12
const SUB_BASE     = LABEL_TOP + 12 + 5 + 8

const ACCENT_H     = 4   // top accent stripe height

const CRITICAL_RING_INSET = 6
const FAILED_RING_INSET   = 5

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function getFriendlyVizState(state?: NodeVizState): string {
  switch (state) {
    case 'settled':    case 'mstIncluded': return 'Settled'
    case 'inQueue':   case 'mstFrontier': return 'In Queue'
    case 'inStack':   return 'In Stack'
    case 'cycle':     return 'Cycle'
    case 'path':      return 'On Path'
    default:          return 'Unvisited'
  }
}

function buildRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  return [
    `M ${x + r} ${y}`,
    `L ${x + w - r} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `Z`,
  ].join(' ')
}

type Props = {
  node: GraphNode
  selected?: boolean
  font: ReturnType<typeof matchFont>
  vizState?: NodeVizState
  isCritical?: boolean
  isFailed?: boolean
  isIsolated?: boolean
}

export function GraphNodeComponent({
  node,
  selected,
  vizState,
  isCritical = false,
  isFailed = false,
  isIsolated = false,
}: Props) {
  const nx = node.x - NODE_WIDTH / 2
  const ny = node.y - NODE_HEIGHT / 2

  const typeKey = node.type ?? 'department'
  const identity = TYPE_IDENTITY[typeKey] ?? TYPE_IDENTITY.department

  const vizActive = useVisualizationStore((s) => s.isActive)
  const showSteps = useVisualizationStore((s) => s.showSteps)
  const currentStep = useVisualizationStore((s) => s.currentStep)
  const isCurrentNode = vizActive && currentStep?.currentNode === node.id

  const pulse = useSharedValue(0)

  React.useEffect(() => {
    if (isCurrentNode) {
      pulse.value = withRepeat(withTiming(1, { duration: 1000 }), -1, false)
    } else {
      pulse.value = 0
    }
  }, [isCurrentNode])

  const animRadius = useDerivedValue(() => {
    return 21 + 8 * pulse.value
  })

  const animOpacity = useDerivedValue(() => 0.45 * (1 - pulse.value))

  // Card fill
  let fill: string
  if (isFailed) {
    fill = '#7F1D1D'  // deep red for failed
  } else if (isIsolated) {
    fill = '#78350F'  // amber-brown for isolated
  } else if (vizState) {
    fill = VIZ_FILL[vizState]
  } else if (node.status !== 'valid') {
    fill = STATUS_FILL[node.status]
  } else {
    fill = identity.fill
  }

  // Accent color (top strip) matches type even during viz
  const accentColor = (isFailed || isIsolated || vizState) ? 'rgba(255,255,255,0.22)' : identity.accent

  const showGlow = vizState ? GLOW_STATES.has(vizState) : false
  const abbr = identity.abbr

  const labelText = truncate(node.label, 14)
  const subtext   = node.subnet && node.subnet !== '—'
    ? truncate(`${node.subnet}  V${node.vlanId}`, 20)
    : typeKey.toUpperCase()

  const abbrW = badgeFont ? badgeFont.measureText(abbr).width : 0
  const abbrX = nx + BADGE_LEFT + (BADGE_W - abbrW) / 2
  const abbrY = ny + BADGE_TOP + (BADGE_H + 10) / 2

  const friendlyStateText = getFriendlyVizState(vizState)
  const stateTextW = stateFont.measureText(friendlyStateText).width

  const criticalRingX = nx - CRITICAL_RING_INSET
  const criticalRingY = ny - CRITICAL_RING_INSET
  const criticalRingW = NODE_WIDTH  + CRITICAL_RING_INSET * 2
  const criticalRingH = NODE_HEIGHT + CRITICAL_RING_INSET * 2
  const criticalPath  = buildRoundedRectPath(criticalRingX, criticalRingY, criticalRingW, criticalRingH, RADIUS + CRITICAL_RING_INSET)

  const failedRingX = nx - FAILED_RING_INSET
  const failedRingY = ny - FAILED_RING_INSET
  const failedRingW = NODE_WIDTH  + FAILED_RING_INSET * 2
  const failedRingH = NODE_HEIGHT + FAILED_RING_INSET * 2
  const failedPath  = buildRoundedRectPath(failedRingX, failedRingY, failedRingW, failedRingH, RADIUS + FAILED_RING_INSET)

  return (
    <Group>
      {/* 1. Drop shadow — slight offset rect for depth */}
      <RoundedRect
        x={nx + 2} y={ny + 3}
        width={NODE_WIDTH} height={NODE_HEIGHT}
        r={RADIUS}
        color="rgba(0,0,0,0.28)"
      />

      {/* 2. Animated pulse ring */}
      {isCurrentNode && (
        <Group opacity={animOpacity}>
          <Circle cx={node.x} cy={node.y} r={animRadius} color={fill} style="stroke" strokeWidth={2.5} />
        </Group>
      )}

      {/* 3. Glow halo */}
      {showGlow && (
        <RoundedRect
          x={nx - 10} y={ny - 10}
          width={NODE_WIDTH + 20} height={NODE_HEIGHT + 20}
          r={RADIUS + 10}
          color={`${fill}35`}
        />
      )}

      {/* 4a. Critical ring */}
      {isCritical && !isFailed && (
        <>
          <RoundedRect
            x={criticalRingX - 2} y={criticalRingY - 2}
            width={criticalRingW + 4} height={criticalRingH + 4}
            r={RADIUS + CRITICAL_RING_INSET + 2}
            color={`${Colors.warning}22`}
          />
          <Path path={criticalPath} color={Colors.warning} style="stroke" strokeWidth={2.5} />
        </>
      )}

      {/* 4b. Failed ring */}
      {isFailed && (
        <>
          <Path path={failedPath} color="rgba(239,68,68,0.35)" style="fill" />
          <Path path={failedPath} color="#EF4444" style="stroke" strokeWidth={3} />
        </>
      )}

      {/* 5. Selection ring — bright white with stronger visibility */}
      {selected && (
        <>
          <RoundedRect
            x={nx - 5} y={ny - 5}
            width={NODE_WIDTH + 10} height={NODE_HEIGHT + 10}
            r={RADIUS + 5}
            color="rgba(255,255,255,0.45)"
          />
          <RoundedRect
            x={nx - 5} y={ny - 5}
            width={NODE_WIDTH + 10} height={NODE_HEIGHT + 10}
            r={RADIUS + 5}
            color="rgba(255,255,255,0.0)"
            style="stroke"
            strokeWidth={2}
          />
        </>
      )}

      {/* 6. Card background */}
      <RoundedRect x={nx} y={ny} width={NODE_WIDTH} height={NODE_HEIGHT} r={RADIUS} color={fill} />

      {/* 7. Top accent strip — full width, rounded only at top-left/top-right corners */}
      <RoundedRect
        x={nx} y={ny}
        width={NODE_WIDTH} height={ACCENT_H + RADIUS}
        r={RADIUS}
        color={accentColor}
      />
      {/* Solid rect to square off the bottom half of the accent strip */}
      <Rect
        x={nx} y={ny + RADIUS}
        width={NODE_WIDTH} height={ACCENT_H}
        color={accentColor}
      />

      {/* Subtle inner highlight at very top for gloss effect */}
      <RoundedRect
        x={nx + 4} y={ny + ACCENT_H}
        width={NODE_WIDTH - 8} height={14}
        r={6}
        color="rgba(255,255,255,0.07)"
      />

      {/* 8a. Badge background — rounded square with device-specific tint */}
      <RoundedRect
        x={nx + BADGE_LEFT} y={ny + BADGE_TOP}
        width={BADGE_W} height={BADGE_H}
        r={10}
        color={identity.badgeBg}
      />
      {/* Badge inner border for definition */}
      <RoundedRect
        x={nx + BADGE_LEFT} y={ny + BADGE_TOP}
        width={BADGE_W} height={BADGE_H}
        r={10}
        color="rgba(255,255,255,0.18)"
        style="stroke"
        strokeWidth={1}
      />

      {/* 8b. Badge label */}
      {badgeFont && (
        <SkiaText x={abbrX} y={abbrY} text={abbr} font={badgeFont} color="rgba(255,255,255,0.96)" />
      )}

      {/* 8c. Node label */}
      {labelFont && (
        <SkiaText
          x={nx + TEXT_LEFT}
          y={ny + LABEL_BASE}
          text={labelText}
          font={labelFont}
          color="#FFFFFF"
        />
      )}

      {/* 8d. Subnet / VLAN subtext */}
      {subFont && (
        <SkiaText
          x={nx + TEXT_LEFT}
          y={ny + SUB_BASE}
          text={subtext}
          font={subFont}
          color="rgba(200,220,255,0.80)"
        />
      )}

      {/* 9. Friendly vizState label */}
      {vizActive && showSteps && vizState && (
        <>
          <RoundedRect
            x={node.x - stateTextW / 2 - 6}
            y={ny + NODE_HEIGHT + 4}
            width={stateTextW + 12}
            height={14}
            r={4}
            color="rgba(20, 30, 50, 0.82)"
          />
          <SkiaText
            x={node.x - stateTextW / 2}
            y={ny + NODE_HEIGHT + 4 + 10}
            text={friendlyStateText}
            font={stateFont}
            color="rgba(255, 255, 255, 0.88)"
          />
        </>
      )}
    </Group>
  )
}
