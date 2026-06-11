// GraphNode.tsx — v3: Simplified card, same viz fidelity
//
// Rendering order (back → front):
//   1.  Drop shadow
//   2.  Animated pulse ring (current viz node)
//   3.  Glow halo (viz queue states)
//   4.  Critical ring / Failed ring
//   5.  Peer highlight ring (nodes adjacent to selected node)
//   6.  Selection ring
//   7.  Card background (LinearGradient per type)
//   8.  Device icon (type-specific Skia primitives, direct on card)
//   9.  Node name label
//  10.  Device type label (replaces subnet subtext — already shown in tooltip)
//  11.  Status dot (top-right corner)
//  12.  Viz state label (below node, viz mode only)

import React from 'react'
import {
  Group,
  RoundedRect,
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
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

// ── Node dimensions ───────────────────────────────────────────────────────────
export const NODE_WIDTH  = 124
export const NODE_HEIGHT = 56
const RADIUS = 11

// ── Fonts ─────────────────────────────────────────────────────────────────────
const labelFont = matchFont({
  fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  fontSize:   11,
  fontWeight: 'bold',
})

const typeFont = matchFont({
  fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  fontSize:   8,
  fontWeight: 'normal',
})

const stateFont = matchFont({
  fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
  fontSize:   9,
  fontWeight: 'bold',
})

// ── Per-type gradient identity ────────────────────────────────────────────────
const TYPE_IDENTITY: Record<string, {
  gradTop:   string
  gradBot:   string
  accent:    string
  iconColor: string
}> = {
  router: {
    gradTop:   '#1e40af',
    gradBot:   '#1e3a8a',
    accent:    '#3B82F6',
    iconColor: '#93C5FD',
  },
  switch: {
    gradTop:   '#065F46',
    gradBot:   '#064e3b',
    accent:    '#10B981',
    iconColor: '#6EE7B7',
  },
  firewall: {
    gradTop:   '#92400E',
    gradBot:   '#7c2d12',
    accent:    '#F97316',
    iconColor: '#FDBA74',
  },
  wan: {
    gradTop:   '#134E4A',
    gradBot:   '#0f3b38',
    accent:    '#2DD4BF',
    iconColor: '#5EEAD4',
  },
  department: {
    gradTop:   '#1E3A5F',
    gradBot:   '#172d4a',
    accent:    '#60A5FA',
    iconColor: '#BAE6FD',
  },
}

const VIZ_GRAD: Record<NodeVizState, [string, string]> = {
  unvisited:   ['#1d4ed8', '#1e3a8a'],
  inQueue:     ['#d97706', '#92400e'],
  inStack:     ['#c2410c', '#7c2d12'],
  settled:     ['#059669', '#065f46'],
  cycle:       ['#dc2626', '#7f1d1d'],
  path:        ['#0891b2', '#155e75'],
  mstIncluded: ['#059669', '#065f46'],
  mstFrontier: ['#d97706', '#92400e'],
}

const GLOW_STATES = new Set<NodeVizState>(['inQueue', 'inStack', 'mstFrontier', 'path'])

// ── Layout constants ──────────────────────────────────────────────────────────
// Icon sits in the left quarter of the card, no badge frame
const ICON_CX_OFFSET = 22      // center of icon from card left edge
const ICON_SIZE      = 22      // rendering size (design grid is 24×24)
const TEXT_LEFT      = 42      // text column starts here from card left

// Two-line text block: 11 + 5 + 8 = 24 px
const LABEL_TOP  = (NODE_HEIGHT - 24) / 2   // = 16
const LABEL_BASE = LABEL_TOP + 11           // = 27
const TYPE_BASE  = LABEL_TOP + 11 + 5 + 8  // = 40

const STATUS_DOT_R = 3.5

const CRITICAL_INSET = 5
const FAILED_INSET   = 4

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function buildRoundedRectPath(x: number, y: number, w: number, h: number, r: number) {
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

// ── Device Icon Components ────────────────────────────────────────────────────
// All icons designed on a 24×24 grid. Stroke-first for clarity at small sizes.

function RouterIcon({ cx, cy, size, color }: {
  cx: number; cy: number; size: number; color: string
}) {
  const s  = size / 24
  const r  = 9.5 * s
  const ag = 3.5 * s
  const ar = 8.5 * s
  const ah = 1.8 * s
  const ad = 2.8 * s
  const sw = 1.5 * s

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={r} color={color} style="stroke" strokeWidth={sw} />
      <Circle cx={cx} cy={cy} r={2.2 * s} color={color} style="fill" />
      <Path path={`M${cx} ${cy - ag} L${cx} ${cy - ar}`} color={color} style="stroke" strokeWidth={sw} strokeCap="round" />
      <Path path={`M${cx - ah} ${cy - ar + ad} L${cx} ${cy - ar} L${cx + ah} ${cy - ar + ad}`} color={color} style="stroke" strokeWidth={sw} strokeCap="round" strokeJoin="round" />
      <Path path={`M${cx} ${cy + ag} L${cx} ${cy + ar}`} color={color} style="stroke" strokeWidth={sw} strokeCap="round" />
      <Path path={`M${cx - ah} ${cy + ar - ad} L${cx} ${cy + ar} L${cx + ah} ${cy + ar - ad}`} color={color} style="stroke" strokeWidth={sw} strokeCap="round" strokeJoin="round" />
      <Path path={`M${cx - ag} ${cy} L${cx - ar} ${cy}`} color={color} style="stroke" strokeWidth={sw} strokeCap="round" />
      <Path path={`M${cx - ar + ad} ${cy - ah} L${cx - ar} ${cy} L${cx - ar + ad} ${cy + ah}`} color={color} style="stroke" strokeWidth={sw} strokeCap="round" strokeJoin="round" />
      <Path path={`M${cx + ag} ${cy} L${cx + ar} ${cy}`} color={color} style="stroke" strokeWidth={sw} strokeCap="round" />
      <Path path={`M${cx + ar - ad} ${cy - ah} L${cx + ar} ${cy} L${cx + ar - ad} ${cy + ah}`} color={color} style="stroke" strokeWidth={sw} strokeCap="round" strokeJoin="round" />
    </Group>
  )
}

function SwitchIcon({ cx, cy, size, color }: {
  cx: number; cy: number; size: number; color: string
}) {
  const s  = size / 24
  const bw = 19 * s
  const bh = 9 * s
  const bx = cx - bw / 2
  const by = cy - bh / 2
  const br = 2 * s
  const sw = 1.5 * s

  const portXs = [bx + 3*s, bx + 6.5*s, bx + 10*s, bx + 13.5*s]
  const portY  = by + bh * 0.62
  const portR  = 1.5 * s
  const uplinkX = bx + bw - 3 * s

  return (
    <Group>
      <RoundedRect x={bx} y={by} width={bw} height={bh} r={br} color={color} style="stroke" strokeWidth={sw} />
      <RoundedRect x={bx + 2*s} y={by + 1.5*s} width={bw - 4*s} height={1.8*s} r={0.9*s} color={`${color}50`} style="fill" />
      {portXs.map((px, i) => (
        <Circle key={i} cx={px} cy={portY} r={portR} color={color} style="fill" />
      ))}
      <RoundedRect x={uplinkX - portR} y={portY - portR} width={portR*2} height={portR*2} r={portR*0.5} color={color} style="fill" />
    </Group>
  )
}

function FirewallIcon({ cx, cy, size, color }: {
  cx: number; cy: number; size: number; color: string
}) {
  const s  = size / 24
  const sw = 1.5 * s

  const ox = cx - 12 * s
  const oy = cy - 12 * s
  const S  = s

  const shieldPath = [
    `M${ox + 12*S} ${oy + 2*S}`,
    `L${ox + 4.5*S} ${oy + 5*S}`,
    `L${ox + 4.5*S} ${oy + 12.5*S}`,
    `C${ox + 4.5*S} ${oy + 17*S} ${ox + 8*S} ${oy + 20.5*S} ${ox + 12*S} ${oy + 22*S}`,
    `C${ox + 16*S} ${oy + 20.5*S} ${ox + 19.5*S} ${oy + 17*S} ${ox + 19.5*S} ${oy + 12.5*S}`,
    `L${ox + 19.5*S} ${oy + 5*S}`,
    `Z`,
  ].join(' ')

  const lx = cx - 3 * s, lw = 6 * s, lh = 4.5 * s
  const ly = cy + 0.5 * s

  return (
    <Group>
      <Path path={shieldPath} color={`${color}28`} style="fill" />
      <Path path={shieldPath} color={color} style="stroke" strokeWidth={sw} strokeJoin="round" />
      <Path
        path={`M${cx - 2.5*s} ${cy} C${cx - 2.5*s} ${cy - 3.5*s} ${cx + 2.5*s} ${cy - 3.5*s} ${cx + 2.5*s} ${cy}`}
        color={color} style="stroke" strokeWidth={sw} strokeCap="round"
      />
      <RoundedRect x={lx} y={ly} width={lw} height={lh} r={1*s} color={color} style="fill" />
      <Circle cx={cx} cy={ly + lh * 0.45} r={0.9*s} color={`${color}55`} style="fill" />
    </Group>
  )
}

function WanIcon({ cx, cy, size, color }: {
  cx: number; cy: number; size: number; color: string
}) {
  const s  = size / 24
  const r  = 9.5 * s
  const sw = 1.4 * s

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={r} color={color} style="stroke" strokeWidth={sw} />
      <Path path={`M${cx - r} ${cy} Q${cx} ${cy - 2.5*s} ${cx + r} ${cy}`} color={color} style="stroke" strokeWidth={sw * 0.85} />
      <Path
        path={`M${cx - r*0.75} ${cy - 3.5*s} Q${cx} ${cy - 5*s} ${cx + r*0.75} ${cy - 3.5*s}`}
        color={color} style="stroke" strokeWidth={sw * 0.7}
      />
      <Path
        path={`M${cx - r*0.75} ${cy + 3.5*s} Q${cx} ${cy + 5*s} ${cx + r*0.75} ${cy + 3.5*s}`}
        color={color} style="stroke" strokeWidth={sw * 0.7}
      />
      <Path
        path={`M${cx} ${cy - r} C${cx - 5.5*s} ${cy - r*0.5} ${cx - 5.5*s} ${cy + r*0.5} ${cx} ${cy + r}`}
        color={color} style="stroke" strokeWidth={sw * 0.85}
      />
      <Path
        path={`M${cx} ${cy - r} C${cx + 5.5*s} ${cy - r*0.5} ${cx + 5.5*s} ${cy + r*0.5} ${cx} ${cy + r}`}
        color={color} style="stroke" strokeWidth={sw * 0.85}
      />
    </Group>
  )
}

function DepartmentIcon({ cx, cy, size, color }: {
  cx: number; cy: number; size: number; color: string
}) {
  const s  = size / 24
  const sw = 1.5 * s

  const mw = 18 * s, mh = 12.5 * s
  const mx = cx - mw / 2
  const my = cy - mh / 2 - 1.5 * s

  return (
    <Group>
      <RoundedRect x={mx} y={my} width={mw} height={mh} r={2*s} color={color} style="stroke" strokeWidth={sw} />
      <Path path={`M${mx+2.5*s} ${my+3*s}   L${mx+mw-2.5*s} ${my+3*s}`}   color={color} style="stroke" strokeWidth={s}     strokeCap="round" />
      <Path path={`M${mx+2.5*s} ${my+5.5*s} L${mx+mw-5*s}   ${my+5.5*s}`} color={color} style="stroke" strokeWidth={s}     strokeCap="round" />
      <Path path={`M${mx+2.5*s} ${my+8*s}   L${mx+mw-7*s}   ${my+8*s}`}   color={color} style="stroke" strokeWidth={s * 0.8} strokeCap="round" />
      <Path path={`M${cx} ${my+mh} L${cx} ${my+mh+3*s}`} color={color} style="stroke" strokeWidth={sw} strokeCap="round" />
      <Path path={`M${cx-4*s} ${my+mh+3*s} L${cx+4*s} ${my+mh+3*s}`} color={color} style="stroke" strokeWidth={sw} strokeCap="round" />
    </Group>
  )
}

function DeviceIcon({ type, cx, cy, size, color }: {
  type: string; cx: number; cy: number; size: number; color: string
}) {
  switch (type) {
    case 'router':     return <RouterIcon     cx={cx} cy={cy} size={size} color={color} />
    case 'switch':     return <SwitchIcon     cx={cx} cy={cy} size={size} color={color} />
    case 'firewall':   return <FirewallIcon   cx={cx} cy={cy} size={size} color={color} />
    case 'wan':        return <WanIcon        cx={cx} cy={cy} size={size} color={color} />
    default:           return <DepartmentIcon cx={cx} cy={cy} size={size} color={color} />
  }
}

// ── Type label map ────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  router:     'ROUTER',
  switch:     'SWITCH',
  firewall:   'FIREWALL',
  wan:        'WAN',
  department: 'HOST',
}

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  node:               GraphNode
  selected?:          boolean
  isPeerHighlighted?: boolean
  peerCount?:         number   // kept in props for API compat but no longer rendered on card
  font:               ReturnType<typeof matchFont>
  vizState?:          NodeVizState
  isCritical?:        boolean
  isFailed?:          boolean
  isIsolated?:        boolean
}

// ── Main component ────────────────────────────────────────────────────────────
export function GraphNodeComponent({
  node,
  selected,
  isPeerHighlighted = false,
  vizState,
  isCritical = false,
  isFailed   = false,
  isIsolated = false,
}: Props) {
  const nx = node.x - NODE_WIDTH  / 2
  const ny = node.y - NODE_HEIGHT / 2

  const typeKey  = node.type ?? 'department'
  const identity = TYPE_IDENTITY[typeKey] ?? TYPE_IDENTITY.department

  const vizActive     = useVisualizationStore((s) => s.isActive)
  const showSteps     = useVisualizationStore((s) => s.showSteps)
  const currentStep   = useVisualizationStore((s) => s.currentStep)
  const isCurrentNode = vizActive && currentStep?.currentNode === node.id

  // Animated pulse for current viz node
  const pulse = useSharedValue(0)
  React.useEffect(() => {
    if (isCurrentNode) {
      pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, false)
    } else {
      pulse.value = 0
    }
  }, [isCurrentNode])
  const animRadius  = useDerivedValue(() => 20 + 9 * pulse.value)
  const animOpacity = useDerivedValue(() => 0.5 * (1 - pulse.value))

  // ── Card fill ──────────────────────────────────────────────────────────────
  let gradTop = identity.gradTop
  let gradBot = identity.gradBot
  let useFlat = false
  let flatColor = ''

  if (isFailed) {
    useFlat = true; flatColor = '#7F1D1D'
  } else if (isIsolated) {
    useFlat = true; flatColor = '#78350F'
  } else if (vizState) {
    const [vt, vb] = VIZ_GRAD[vizState]
    gradTop = vt; gradBot = vb
  }

  const showGlow = vizState ? GLOW_STATES.has(vizState) : false

  // ── Text ───────────────────────────────────────────────────────────────────
  const labelText = truncate(node.label, 11)
  const typeLabel = TYPE_LABELS[typeKey] ?? typeKey.toUpperCase()

  // ── Viz state chip ─────────────────────────────────────────────────────────
  const friendlyState = getFriendlyVizState(vizState)
  const stateTextW    = stateFont ? stateFont.measureText(friendlyState).width : 0

  // ── Critical / failed ring paths ──────────────────────────────────────────
  const critRingX = nx - CRITICAL_INSET
  const critRingY = ny - CRITICAL_INSET
  const critRingW = NODE_WIDTH  + CRITICAL_INSET * 2
  const critRingH = NODE_HEIGHT + CRITICAL_INSET * 2
  const critPath  = buildRoundedRectPath(critRingX, critRingY, critRingW, critRingH, RADIUS + CRITICAL_INSET)

  const failRingX = nx - FAILED_INSET
  const failRingY = ny - FAILED_INSET
  const failRingW = NODE_WIDTH  + FAILED_INSET * 2
  const failRingH = NODE_HEIGHT + FAILED_INSET * 2
  const failPath  = buildRoundedRectPath(failRingX, failRingY, failRingW, failRingH, RADIUS + FAILED_INSET)

  // ── Icon position ──────────────────────────────────────────────────────────
  const iconCx = nx + ICON_CX_OFFSET
  const iconCy = ny + NODE_HEIGHT / 2

  // ── Status dot colour ──────────────────────────────────────────────────────
  const statusColor = isFailed    ? Colors.error
                    : isIsolated  ? Colors.warning
                    : vizState    ? (VIZ_GRAD[vizState][0])
                    : Colors.success

  return (
    <Group>
      {/* 1. Drop shadow */}
      <RoundedRect
        x={nx + 2} y={ny + 3}
        width={NODE_WIDTH} height={NODE_HEIGHT}
        r={RADIUS}
        color="rgba(0,0,0,0.38)"
      />

      {/* 2. Animated pulse ring */}
      {isCurrentNode && (
        <Group opacity={animOpacity}>
          <Circle cx={node.x} cy={node.y} r={animRadius} color={gradTop} style="stroke" strokeWidth={2.5} />
        </Group>
      )}

      {/* 3. Glow halo */}
      {showGlow && (
        <RoundedRect
          x={nx - 10} y={ny - 10}
          width={NODE_WIDTH + 20} height={NODE_HEIGHT + 20}
          r={RADIUS + 10}
          color={`${gradTop}2E`}
        />
      )}

      {/* 4a. Critical ring */}
      {isCritical && !isFailed && (
        <>
          <RoundedRect
            x={critRingX - 2} y={critRingY - 2}
            width={critRingW + 4} height={critRingH + 4}
            r={RADIUS + CRITICAL_INSET + 2}
            color={`${Colors.warning}20`}
          />
          <Path path={critPath} color={Colors.warning} style="stroke" strokeWidth={2.5} />
        </>
      )}

      {/* 4b. Failed ring */}
      {isFailed && (
        <>
          <Path path={failPath} color="rgba(239,68,68,0.25)" style="fill" />
          <Path path={failPath} color="#EF4444" style="stroke" strokeWidth={3} />
        </>
      )}

      {/* 5. Peer highlight ring */}
      {isPeerHighlighted && !selected && (
        <>
          <RoundedRect
            x={nx - 5} y={ny - 5}
            width={NODE_WIDTH + 10} height={NODE_HEIGHT + 10}
            r={RADIUS + 5}
            color={Colors.peerRingFill}
          />
          <RoundedRect
            x={nx - 5} y={ny - 5}
            width={NODE_WIDTH + 10} height={NODE_HEIGHT + 10}
            r={RADIUS + 5}
            color={Colors.peerRing}
            style="stroke"
            strokeWidth={1.8}
          />
        </>
      )}

      {/* 6. Selection ring */}
      {selected && (
        <>
          <RoundedRect
            x={nx - 5} y={ny - 5}
            width={NODE_WIDTH + 10} height={NODE_HEIGHT + 10}
            r={RADIUS + 5}
            color="rgba(255,255,255,0.30)"
          />
          <RoundedRect
            x={nx - 5} y={ny - 5}
            width={NODE_WIDTH + 10} height={NODE_HEIGHT + 10}
            r={RADIUS + 5}
            color="rgba(255,255,255,0.85)"
            style="stroke"
            strokeWidth={2}
          />
        </>
      )}

      {/* 7. Card background */}
      {useFlat ? (
        <RoundedRect x={nx} y={ny} width={NODE_WIDTH} height={NODE_HEIGHT} r={RADIUS} color={flatColor} />
      ) : (
        <RoundedRect x={nx} y={ny} width={NODE_WIDTH} height={NODE_HEIGHT} r={RADIUS} color={gradBot}>
          <LinearGradient
            start={vec(nx, ny)}
            end={vec(nx, ny + NODE_HEIGHT)}
            colors={[gradTop, gradBot]}
          />
        </RoundedRect>
      )}

      {/* Subtle left-edge color stripe: 3px wide, clipped to card interior */}
      <RoundedRect
        x={nx} y={ny}
        width={3} height={NODE_HEIGHT}
        r={RADIUS}
        color={identity.accent + '60'}
      />

      {/* 8. Device icon — directly on card, no badge frame */}
      <DeviceIcon
        type={typeKey}
        cx={iconCx}
        cy={iconCy}
        size={ICON_SIZE}
        color={identity.iconColor}
      />

      {/* Faint vertical divider between icon zone and text zone */}
      <Path
        path={`M${nx + 37} ${ny + 10} L${nx + 37} ${ny + NODE_HEIGHT - 10}`}
        color="rgba(255,255,255,0.10)"
        style="stroke"
        strokeWidth={1}
      />

      {/* 9. Node name */}
      {labelFont && (
        <SkiaText
          x={nx + TEXT_LEFT}
          y={ny + LABEL_BASE}
          text={labelText}
          font={labelFont}
          color="#FFFFFF"
        />
      )}

      {/* 10. Device type label */}
      {typeFont && (
        <SkiaText
          x={nx + TEXT_LEFT}
          y={ny + TYPE_BASE}
          text={typeLabel}
          font={typeFont}
          color="rgba(180,210,255,0.60)"
        />
      )}

      {/* 11. Status dot — top-right corner */}
      <Circle
        cx={nx + NODE_WIDTH - STATUS_DOT_R - 7}
        cy={ny + STATUS_DOT_R + 6}
        r={STATUS_DOT_R}
        color={statusColor}
      />
      <Circle
        cx={nx + NODE_WIDTH - STATUS_DOT_R - 7}
        cy={ny + STATUS_DOT_R + 6}
        r={STATUS_DOT_R}
        color="rgba(0,0,0,0.22)"
        style="stroke"
        strokeWidth={0.8}
      />

      {/* 12. Viz state chip — below card */}
      {vizActive && showSteps && vizState && (
        <>
          <RoundedRect
            x={node.x - stateTextW / 2 - 7}
            y={ny + NODE_HEIGHT + 5}
            width={stateTextW + 14}
            height={15}
            r={4}
            color="rgba(13,17,23,0.88)"
          />
          <SkiaText
            x={node.x - stateTextW / 2}
            y={ny + NODE_HEIGHT + 5 + 11}
            text={friendlyState}
            font={stateFont}
            color="rgba(255,255,255,0.90)"
          />
        </>
      )}
    </Group>
  )
}
