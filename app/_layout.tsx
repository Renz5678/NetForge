import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { useFonts, Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native'
import Toast from 'react-native-toast-message'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePreferencesStore } from '@/stores/usePreferencesStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppSplashScreen } from '@/components/ui/AppSplashScreen'

function RootLayoutNav() {
  const session = useAuthStore((s) => s.session)
  const loading = useAuthStore((s) => s.loading)
  const restoreSession = useAuthStore((s) => s.restoreSession)
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences)
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    let isCancelled = false
    let unsubscribe: (() => void) | undefined
    
    // Load local preferences
    loadPreferences()

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

    const inAuthGroup  = segments[0] === '(auth)'
    const inOnboarding = segments[0] === '(onboarding)'

    // A guest session uses a .local / .guest email and is local-only.
    // Guests must be allowed to navigate to auth routes so they can sign up or log in.
    const userEmail = session?.user?.email ?? ''
    const isGuest =
      userEmail.endsWith('.local') ||
      userEmail.endsWith('.guest') ||
      userEmail === 'guest@netforge.com'
    const hasRealSession = !!session && !isGuest

    if (!session && !inAuthGroup && !inOnboarding) {
      // No session at all → send to onboarding
      router.replace('/(onboarding)')
    } else if (hasRealSession && (inAuthGroup || inOnboarding)) {
      // Fully authenticated → skip auth/onboarding screens
      router.replace('/(tabs)')
    }
    // Guests in auth group: allow through so they can create a real account
  }, [session, loading, segments, router])

  if (loading) {
    return <AppSplashScreen />
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
    Inter_400Regular: Outfit_400Regular,
    Inter_500Medium: Outfit_500Medium,
    Inter_600SemiBold: Outfit_600SemiBold,
    // Outfit doesn't have a 700-weight variant in the expo package;
    // mapping to 600SemiBold is the closest available weight.
    Inter_700Bold: Outfit_600SemiBold,
    // Named Outfit variants (used by MetricTile, HomeSkeleton, etc.)
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  })

  if (!fontsLoaded) {
    return <AppSplashScreen />
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
})
