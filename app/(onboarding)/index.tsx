import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  Pressable,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Button } from '@/components/ui/Button'
import { Colors } from '@/constants/colors'
import { useAuthStore } from '@/stores/useAuthStore'
import { NetForgeLogo } from '@/components/ui/NetForgeLogo'
import { ShieldCheck, Check } from 'phosphor-react-native'

const { width } = Dimensions.get('window')

// Slide 1: Diamond topology representation
function TopologyIllustration() {
  const cx = 140
  const cy = 100

  const nodes = [
    { x: cx, y: 15, r: 12, fill: Colors.primary },
    { x: cx - 90, y: 90, r: 14, fill: Colors.medium },
    { x: cx + 90, y: 90, r: 10, fill: Colors.medium },
    { x: cx, y: 165, r: 18, fill: Colors.pale },
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
    <View style={illustration.svgWrapper}>
      {edges.map(([a, b], i) => {
        const isDashed = i === 5
        const len = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2))
        const angle = Math.atan2(b.y - a.y, b.x - a.x)
        return (
          <View
            key={i}
            style={[
              illustration.edge,
              {
                left: a.x,
                top: a.y,
                width: len,
                transform: [
                  { rotate: `${angle}rad` },
                ],
                borderStyle: isDashed ? 'dashed' : 'solid',
                borderColor: isDashed ? Colors.soft : Colors.ice,
                borderTopWidth: 2,
              },
            ]}
          />
        )
      })}
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
              borderWidth: 2,
              borderColor: Colors.white,
              shadowColor: Colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            },
          ]}
        />
      ))}
    </View>
  )
}

// Slide 2: Relaxing edges / queue representation
function AlgorithmIllustration() {
  const cx = 140
  const cy = 100

  // Showing step-by-step search
  const nodes = [
    { x: cx - 80, y: 100, r: 14, fill: Colors.vizSettled, label: 'Start (Settled)', sub: 'g=0' },
    { x: cx + 10, y: 40, r: 16, fill: Colors.vizInQueue, label: 'Queue', sub: 'g=5' },
    { x: cx + 10, y: 160, r: 12, fill: Colors.vizUnvisited, label: 'Unvisited', sub: 'g=∞' },
    { x: cx + 90, y: 100, r: 12, fill: Colors.vizUnvisited, label: 'Target', sub: 'g=∞' },
  ]

  const edges = [
    { from: nodes[0], to: nodes[1], color: Colors.vizSettled, width: 3 },
    { from: nodes[0], to: nodes[2], color: Colors.vizInQueue, width: 2, dashed: true },
    { from: nodes[1], to: nodes[3], color: Colors.ice, width: 1.5 },
    { from: nodes[2], to: nodes[3], color: Colors.ice, width: 1.5 },
  ]

  return (
    <View style={illustration.svgWrapper}>
      {edges.map((e, i) => {
        const a = e.from
        const b = e.to
        const len = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2))
        const angle = Math.atan2(b.y - a.y, b.x - a.x)
        return (
          <View
            key={i}
            style={[
              illustration.edge,
              {
                left: a.x,
                top: a.y,
                width: len,
                transform: [
                  { rotate: `${angle}rad` },
                ],
                borderStyle: e.dashed ? 'dashed' : 'solid',
                borderColor: e.color,
                borderTopWidth: e.width,
              },
            ]}
          />
        )
      })}
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
              borderWidth: 2,
              borderColor: Colors.white,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 3,
              elevation: 2,
            },
          ]}
        >
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: Colors.textPrimary }}>
            {n.sub}
          </Text>
        </View>
      ))}
      <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: `${Colors.vizSettled}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
        <Text style={{ fontSize: 10, color: Colors.success, fontWeight: 'bold' }}>🟢 Settled</Text>
      </View>
      <View style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: `${Colors.vizInQueue}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
        <Text style={{ fontSize: 10, color: Colors.warning, fontWeight: 'bold' }}>🟡 In Queue</Text>
      </View>
    </View>
  )
}

// Slide 3: Validation checks / shield representation
function ComplianceIllustration() {
  const checks = [
    { title: 'Routing Loops Check', desc: 'No cyclic paths detected', status: 'pass' },
    { title: 'Subnet Allocations Check', desc: 'All IP addresses unique & isolated', status: 'pass' },
    { title: 'VLAN Tag Assignment Check', desc: 'Zero collision/VLAN leaks', status: 'pass' },
  ]

  return (
    <View style={[illustration.svgWrapper, { justifyContent: 'center', gap: 10 }]}>
      <View style={illustration.shield}>
        <ShieldCheck size={20} color={Colors.success} weight="fill" />
        <Text style={{ fontSize: 13, fontWeight: 'bold', color: Colors.success }}>COMPLIANT</Text>
      </View>
      <View style={{ gap: 6, width: '100%', paddingHorizontal: 20 }}>
        {checks.map((c, i) => (
          <View key={i} style={illustration.checkRow}>
            <Check size={14} color={Colors.success} weight="bold" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={illustration.checkTitle}>{c.title}</Text>
              <Text style={illustration.checkDesc}>{c.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

export default function OnboardingScreen() {
  const router = useRouter()
  const [activeSlide, setActiveSlide] = useState(0)

  const slides = [
    {
      title: 'Design & Wire Networks',
      subtitle: 'Build interactive network topologies. Connect subnets visually, configure routing paths, and design network hardware without spreadsheets.',
      illustration: <TopologyIllustration />,
    },
    {
      title: 'Expose Routing Algorithms',
      subtitle: 'Never treat networks like a black box. Watch Dijkstra, A* Search, Kahn\'s Topological Sort, and Prim\'s MST work step-by-step with live queues.',
      illustration: <AlgorithmIllustration />,
    },
    {
      title: 'Real-time Compliance',
      subtitle: 'Automatically check for network loops, IP range collisions, isolated nodes, and VLAN conflicts as you draw your layout.',
      illustration: <ComplianceIllustration />,
    },
  ]

  const handleNext = () => {
    if (activeSlide < slides.length - 1) {
      setActiveSlide(activeSlide + 1)
    }
  }

  const handleSkip = () => {
    setActiveSlide(slides.length - 1)
  }

  const current = slides[activeSlide]

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header / Skip Button */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <NetForgeLogo size={28} />
          <Text style={styles.wordmark}>NetForge</Text>
        </View>
        {activeSlide < slides.length - 1 && (
          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>

      {/* Slide Content */}
      <View style={styles.content}>
        <View style={styles.illustrationWrapper}>
          {current.illustration}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.slideTitle}>{current.title}</Text>
          <Text style={styles.slideSubtitle}>{current.subtitle}</Text>
        </View>

        {/* Page Dots */}
        <View style={styles.dotsRow}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                activeSlide === i ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Interactive Navigation / Auth Buttons */}
      <View style={styles.buttons}>
        {activeSlide < slides.length - 1 ? (
          <Button
            label="Next"
            variant="primary"
            fullWidth
            onPress={handleNext}
          />
        ) : (
          <>
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
            {__DEV__ && (
              <Button
                label="Continue in Offline Mode (Bypass)"
                variant="ghost"
                fullWidth
                onPress={async () => {
                  await useAuthStore.getState().signInAsGuest()
                  router.replace('/(tabs)')
                }}
              />
            )}
          </>
        )}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  wordmark: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textMuted,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  illustrationWrapper: {
    height: 200,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 24,
    gap: 12,
  },
  slideTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  slideSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 20,
    backgroundColor: Colors.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: Colors.ice,
  },
  buttons: {
    gap: 12,
    paddingBottom: 24,
  },
})

const illustration = StyleSheet.create({
  svgWrapper: {
    position: 'relative',
    width: 280,
    height: 180,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  edge: {
    position: 'absolute',
    height: 2,
    transformOrigin: 'left center',
  },
  node: {
    position: 'absolute',
  },
  shield: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Colors.success,
    marginTop: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textPrimary,
  },
  checkDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: Colors.textMuted,
  },
})
