import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/useAuthStore'

export default function Index() {
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)

  if (loading) return null

  if (session) {
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href="/(onboarding)" />
}
