/**
 * Secure ID generation using the platform's built-in PRNG.
 * Works on Hermes (RN ≥ 0.71) and all modern JS engines — no external package needed.
 */
export function generateId(): string {
  return crypto.randomUUID()
}
