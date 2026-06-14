// NetForge Color Tokens — Single source of truth for all colors
// Every color reference in the app must import from this file.
// Zero hardcoded hex strings anywhere else.

export const Colors = {
  // Primary palette
  primary: '#2563EB',
  medium: '#5B8DEF',
  soft: '#89ABEF',
  pale: '#AABFEF',
  ice: '#D6E4F7',

  // Neutrals
  white: '#FFFFFF',
  background: '#F1F5FF',

  // Semantic
  error: '#EF4444',
  errorContainer: '#FEF2F2',
  warning: '#F59E0B',
  warningContainer: '#FFFBEB',
  success: '#10B981',
  successContainer: '#D1FAE5',

  // Text
  textPrimary: '#001A41',
  textSecondary: '#434655',
  textMuted: '#737686',

  // Structural
  border: '#D6E4F7',
  borderFocus: '#2563EB',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3FF',

  // ── Auth / Onboarding Gradient ──────────────────────────────────────────────
  // Deep navy → cobalt used as full-bleed background on auth & onboarding screens
  authDeep:   '#081428',   // darkest — status bar area
  authMid:    '#0F2456',   // mid gradient
  authCobalt: '#1D4ED8',   // brand cobalt
  authLight:  '#4F86EF',   // lighter cobalt — bottom of hero gradient

  // ── Glass Morphism ──────────────────────────────────────────────────────────
  // Semi-transparent white for form cards floating on gradients
  glass:       'rgba(255,255,255,0.95)',
  glassBorder: 'rgba(255,255,255,0.55)',
  glassOnDark: 'rgba(255,255,255,0.09)',  // for panels sitting on the dark hero

  // ── Tab Bar ─────────────────────────────────────────────────────────────────
  // Pill background shown behind the active tab icon
  tabActive: '#EEF2FF',    // very light indigo — readable, non-distracting

  // Graph node states
  nodeValid: '#2563EB',
  nodeCycle: '#EF4444',
  nodeIsolated: '#F59E0B',

  // ── Algorithm Visualization Color Language ─────────────────────────────────
  // These are canvas-only overlay colors, applied via Skia during viz mode.
  // Blue     → unvisited / default
  // Yellow   → in priority queue / BFS queue / MST frontier
  // Orange   → in current DFS stack (Cycle Detection)
  // Green    → settled / finalized / in MST
  // Red      → cycle detected / back-edge
  // Cyan     → final path highlight
  // Green dashed → MST accepted edge
  vizUnvisited:  '#93C5FD',  // light blue (readable on dark canvas background)
  vizInQueue:    '#FCD34D',  // amber yellow
  vizInStack:    '#FB923C',  // orange
  vizSettled:    '#34D399',  // emerald green
  vizCycle:      '#F87171',  // soft red
  vizPath:       '#22D3EE',  // cyan
  vizMstEdge:    '#4ADE80',  // bright green for MST overlay edges
  vizCandidate:  '#FCD34D',  // yellow for candidate edges

  // ── Graph Edge ─────────────────────────────────────────────────────────────
  // Dark navy for default edges — high contrast on #F1F3FF canvas background
  edgeDefault:   '#1E3A5F',

  // ── Dark Canvas ────────────────────────────────────────────────────────────
  // Professional dark background matching network design tool aesthetics
  canvasBg:      '#0D1117',
  canvasGrid:    'rgba(139,156,255,0.07)',  // subtle blue-tinted grid dots

  // ── Topology Zone Tints ────────────────────────────────────────────────────
  // Very low-opacity shading applied behind each network tier
  zoneWan:       'rgba(45,212,191,0.06)',   // teal — WAN / Internet edge
  zoneCore:      'rgba(59,130,246,0.05)',   // blue  — Core routing layer
  zoneAccess:    'rgba(16,185,129,0.04)',   // green — Access / endpoint layer

  // ── Traffic Load Indicators ────────────────────────────────────────────────
  trafficLow:    '#34D399',   // emerald — <40% utilisation
  trafficMed:    '#FCD34D',   // amber   — 40-75% utilisation
  trafficHigh:   '#F87171',   // rose    — >75% utilisation

  // ── Peer Highlight ─────────────────────────────────────────────────────────
  // Soft ring shown on nodes directly adjacent to the currently selected node
  peerRing:      'rgba(96,165,250,0.70)',
  peerRingFill:  'rgba(96,165,250,0.08)',
} as const

export type ColorKey = keyof typeof Colors
