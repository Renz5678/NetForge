import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import Toast from 'react-native-toast-message'
import { useAuthStore } from '@/stores/useAuthStore'
import { Colors } from '@/constants/colors'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function RootLayoutNav() {
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)
  const restoreSession = useAuthStore((s) => s.restoreSession)
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    let isCancelled = false
    let unsubscribe: (() => void) | undefined
    restoreSession()
      .then((unsub) => {
        if (isCancelled) {
          unsub()
        } else {
          unsubscribe = unsub
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          Toast.show({
            type: 'error',
            text1: 'Authentication Error',
            text2: err instanceof Error ? err.message : 'Failed to restore session',
          })
        }
      })
    return () => {
      isCancelled = true
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inOnboarding = segments[0] === '(onboarding)'

    if (!session && !inAuthGroup && !inOnboarding) {
      router.replace('/(onboarding)')
    } else if (session && (inAuthGroup || inOnboarding)) {
      router.replace('/(tabs)')
    }
  }, [session, loading, segments, router])

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="config/[id]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  )
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  })

  if (!fontsLoaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    )
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <RootLayoutNav />
          <StatusBar style="dark" />
          <Toast />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
})
