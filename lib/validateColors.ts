/**
 * lib/validateColors.ts
 *
 * Shared severity helpers for the Validate Pass UI.
 * Imported by validate.tsx and FindingRow.tsx — single source of truth.
 */

import { Colors } from '@/constants/colors'
import type { FindingSeverity } from '@/lib/validatePass'

/** Maps a FindingSeverity to its foreground colour token. */
export function severityColor(s: FindingSeverity): string {
  switch (s) {
    case 'red':    return Colors.error
    case 'yellow': return Colors.warning
    case 'blue':   return Colors.primary
    case 'tip':    return Colors.warning
    default:       return Colors.pale
  }
}

/** Maps a FindingSeverity to its card background colour token. */
export function severityBgColor(s: FindingSeverity): string {
  switch (s) {
    case 'red':    return Colors.errorContainer
    case 'yellow': return Colors.warningContainer
    case 'blue':   return `${Colors.primary}10`
    case 'tip':    return Colors.warningContainer
    default:       return Colors.surfaceAlt
  }
}

/** Maps a FindingSeverity to a human-readable label. */
export function severityLabel(s: FindingSeverity): string {
  switch (s) {
    case 'red':    return 'Critical'
    case 'yellow': return 'Warning'
    case 'blue':   return 'Info'
    case 'tip':    return 'Tips'
    default:       return ''
  }
}
