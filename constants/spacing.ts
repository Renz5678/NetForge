// NetForge Spacing — 4px base unit system
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  gutter: 16,
} as const

export type SpacingKey = keyof typeof Spacing
