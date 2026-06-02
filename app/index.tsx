import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/useAuthStore'

import { ActivityIndicator, View } from 'react-native'
import { Colors } from '@/constants/colors'

export default function Index() {
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    )
  }

  if (session) {
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href="/(onboarding)" />
}
