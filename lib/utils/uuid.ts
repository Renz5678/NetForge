/**
 * Pure-JS UUID v4 generator — no native modules required.
 *
 * React Native's Hermes / JSC engines do NOT expose the Web Crypto API
 * (globalThis.crypto / crypto.randomUUID), so we use a Math.random()
 * implementation that is RFC 4122 compliant and works everywhere.
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
