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
} as const

export type ColorKey = keyof typeof Colors
