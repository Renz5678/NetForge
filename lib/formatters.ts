// formatters.ts — Utility functions for display formatting
// Pure functions — no side effects, no state.

/**
 * Format a date string/timestamp into a human-readable relative time.
 * e.g. "2 hours ago", "3 days ago", "just now"
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

/**
 * Extract initials from a full name.
 * "John Doe" → "JD", "Alice" → "A", "" → "U"
 */
export function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/)
  if (words.length === 0 || words[0] === '') return 'U'
  if (words.length === 1) return words[0][0].toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * Format an IP address with CIDR prefix.
 * e.g. formatIpWithCidr("10.0.0.0", 24) → "10.0.0.0/24"
 */
export function formatIpWithCidr(ip: string, prefix: number): string {
  return `${ip}/${prefix}`
}

/**
 * Get a time-of-day greeting.
 * "Good morning" / "Good afternoon" / "Good evening"
 */
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Format a date as a readable timestamp for activity feed.
 * e.g. "Today, 4:20 PM", "Yesterday, 4:20 PM", "May 22, 4:20 PM"
 */
export function formatActivityTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  if (isToday) return `Today, ${timeStr}`
  if (isYesterday) return `Yesterday, ${timeStr}`
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`
}

/**
 * Pluralize a word based on count.
 * e.g. pluralize(1, 'department') → '1 department'
 *      pluralize(3, 'department') → '3 departments'
 */
export function pluralize(count: number, word: string): string {
  return `${count} ${word}${count !== 1 ? 's' : ''}`
}
