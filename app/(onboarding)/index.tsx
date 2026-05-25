import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Button } from '@/components/ui/Button'
import { Colors } from '@/constants/colors'
import { useAuthStore } from '@/stores/useAuthStore'

const { width } = Dimensions.get('window')

// Network diamond illustration using React Native SVG
function NetworkIllustration() {
  const cx = width / 2
  const cy = 100

  const nodes = [
    { x: cx, y: 0, r: 12, fill: Colors.primary },
    { x: cx - 110, y: 80, r: 14, fill: Colors.medium },
    { x: cx + 110, y: 80, r: 10, fill: Colors.medium },
    { x: cx, y: 160, r: 18, fill: Colors.pale },
  ]

  const edges = [
    [nodes[0], nodes[1]],
    [nodes[0], nodes[2]],
    [nodes[1], nodes[3]],
    [nodes[2], nodes[3]],
    [nodes[0], nodes[3]],
    [nodes[1], nodes[2]],
  ]

  return (
    <View style={illustration.container}>
      <View style={illustration.svgWrapper}>
        {/* SVG edges */}
        {edges.map(([a, b], i) => {
          const isDashed = i === 5
          return (
            <View
              key={i}
              style={[
                illustration.edge,
                {
                  left: Math.min(a.x, b.x),
                  top: Math.min(a.y, b.y),
                  width: Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2)),
                  transform: [
                    {
                      rotate: `${Math.atan2(b.y - a.y, b.x - a.x)}rad`,
                    },
                  ],
                  borderStyle: isDashed ? 'dashed' : 'solid',
                  borderColor: isDashed ? Colors.pale : Colors.soft,
                },
              ]}
            />
          )
        })}
        {/* Nodes */}
        {nodes.map((n, i) => (
          <View
            key={i}
            style={[
              illustration.node,
              {
                left: n.x - n.r,
                top: n.y - n.r,
                width: n.r * 2,
                height: n.r * 2,
                borderRadius: n.r,
                backgroundColor: n.fill,
              },
            ]}
          />
        ))}
      </View>
    </View>
  )
}

export default function OnboardingScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Wordmark */}
        <Text style={styles.wordmark}>NetForge</Text>
        <Text style={styles.tagline}>Design networks. Not spreadsheets.</Text>

        {/* Illustration */}
        <View style={styles.illustrationWrapper}>
          <NetworkIllustration />
        </View>

        {/* Version */}
        <Text style={styles.version}>v2.4.0-stable | Systematic Network Management</Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <Button
          label="Create account"
          variant="primary"
          fullWidth
          onPress={() => router.push('/(auth)/signup')}
        />
        <Button
          label="Log in"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/(auth)/login')}
        />
        <Button
          label="Continue in Offline Mode (Bypass)"
          variant="ghost"
          fullWidth
          onPress={async () => {
            await useAuthStore.getState().signInAsGuest()
            router.replace('/(tabs)')
          }}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  wordmark: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 36,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: Colors.medium,
    textAlign: 'center',
  },
  illustrationWrapper: {
    marginTop: 32,
    marginBottom: 32,
    height: 220,
    width: '100%',
    alignItems: 'center',
  },
  version: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  buttons: {
    gap: 12,
    paddingBottom: 24,
  },
})

const illustration = StyleSheet.create({
  container: {
    width: width,
    height: 200,
    alignItems: 'center',
  },
  svgWrapper: {
    position: 'relative',
    width: 280,
    height: 200,
  },
  edge: {
    position: 'absolute',
    height: 1,
    borderTopWidth: 1,
    transformOrigin: 'left center',
  },
  node: {
    position: 'absolute',
  },
})
