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
} as const

export type ColorKey = keyof typeof Colors
