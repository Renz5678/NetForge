// useAuth.ts — Convenience wrapper around useAuthStore
import { useAuthStore } from '@/stores/useAuthStore'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)
  const signUp = useAuthStore((s) => s.signUp)
  const signIn = useAuthStore((s) => s.signIn)
  const signOut = useAuthStore((s) => s.signOut)
  const restoreSession = useAuthStore((s) => s.restoreSession)

  return { user, session, loading, signUp, signIn, signOut, restoreSession }
}
