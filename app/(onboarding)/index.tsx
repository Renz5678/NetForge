// app/(onboarding)/index.tsx
// 7-step interactive product walkthrough.
// Philosophy: Teach networking concepts through hands-on interaction.
// Algorithms are revealed naturally as explanations of what NetForge does.
// Never "this is an algorithm tutorial" — always "here's what your network is doing."

import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Button } from '@/components/ui/Button'
import { Colors } from '@/constants/colors'
import { useAuthStore } from '@/stores/useAuthStore'
import { NetForgeLogo } from '@/components/ui/NetForgeLogo'
import {
  ArrowsLeftRight,
  CheckCircle,
  Export,
  ShieldCheck,
  GraduationCap,
  ArrowRight,
  HardDrives,
  Globe,
  TreeStructure,
} from 'phosphor-react-native'
import { RouterIcon } from '@/components/ui/DeviceIcons'

const { width } = Dimensions.get('window')

// ─── Illustrations ──────────────────────────────────────────────────────────

function TopologyBuilderIllustration({ step }: { step: number }) {
  // Shows progressive topology building across the 3 design steps
  const showSwitch = step >= 1
  const showLink = step >= 2
  const showIPs = step >= 3

  const nodes = [
    { x: 90, y: 80, label: 'Router', color: Colors.primary, type: 'circle' },
    { x: 210, y: 80, label: 'Switch', color: Colors.medium, type: 'circle', show: showSwitch },
  ]

  return (
    <View style={illus.wrapper}>
      {/* Link between router and switch */}
      {showLink && (
        <View
          style={[
            illus.link,
            {
              left: 118,
              top: 84,
              width: 74,
              borderColor: Colors.vizSettled,
              borderStyle: 'solid',
            },
          ]}
        />
      )}

      {/* Router */}
      <View style={[illus.node, { left: 60, top: 56, backgroundColor: Colors.primary }]}>
        <RouterIcon size={20} color={Colors.white} />
        <Text style={illus.nodeLabel}>Router</Text>
      </View>

      {/* Switch */}
      {showSwitch && (
        <View style={[illus.node, { left: 178, top: 56, backgroundColor: Colors.medium }]}>
          <Globe size={20} color={Colors.white} weight="fill" />
          <Text style={illus.nodeLabel}>Switch</Text>
        </View>
      )}

      {/* IP Labels */}
      {showIPs && (
        <>
          <View style={[illus.ipBadge, { left: 50, top: 110 }]}>
            <Text style={illus.ipText}>10.0.0.1/30</Text>
          </View>
          <View style={[illus.ipBadge, { left: 166, top: 110 }]}>
            <Text style={illus.ipText}>10.0.0.2/30</Text>
          </View>
        </>
      )}

      {/* Status bar */}
      <View style={illus.statusBar}>
        <View style={[illus.statusDot, { backgroundColor: step >= 0 ? Colors.success : Colors.border }]} />
        <Text style={illus.statusText}>{step >= 0 ? 'Router placed' : 'Empty canvas'}</Text>
      </View>
    </View>
  )
}

function ValidationIllustration({ passed }: { passed: boolean }) {
  const checks = [
    { label: 'No routing loops', pass: true },
    { label: 'IP ranges valid', pass: true },
    { label: 'All devices reachable', pass: passed },
    { label: 'VLAN tags assigned', pass: passed },
  ]

  return (
    <View style={illus.wrapper}>
      <View style={illus.checkList}>
        {checks.map((c, i) => (
          <View key={i} style={illus.checkRow}>
            {c.pass ? (
              <CheckCircle size={16} color={Colors.success} weight="fill" />
            ) : (
              <View style={illus.warningDot} />
            )}
            <Text style={[illus.checkLabel, { color: c.pass ? Colors.textPrimary : Colors.warning }]}>
              {c.label}
            </Text>
          </View>
        ))}
      </View>
      <View style={[illus.validBadge, { borderColor: passed ? Colors.success : Colors.warning, backgroundColor: passed ? Colors.successContainer : Colors.warningContainer }]}>
        <ShieldCheck size={14} color={passed ? Colors.success : Colors.warning} weight="fill" />
        <Text style={[illus.validBadgeText, { color: passed ? Colors.success : Colors.warning }]}>
          {passed ? 'Topology Valid' : '1 Warning'}
        </Text>
      </View>
    </View>
  )
}

function RouteIllustration() {
  const pathNodes = ['Router', 'Switch', 'PC-A']
  return (
    <View style={illus.wrapper}>
      <View style={illus.routeRow}>
        {pathNodes.map((n, i) => (
          <React.Fragment key={n}>
            <View style={[illus.routeNode, { backgroundColor: i === 0 ? Colors.primary : i === pathNodes.length - 1 ? Colors.vizPath : Colors.medium }]}>
              <Text style={illus.routeNodeText}>{n}</Text>
            </View>
            {i < pathNodes.length - 1 && (
              <ArrowRight size={14} color={Colors.vizSettled} />
            )}
          </React.Fragment>
        ))}
      </View>

      <View style={illus.routeResult}>
        <Text style={illus.routeResultText}>
          Best route: 2 hops · Cost: 2
        </Text>
      </View>

      <View style={illus.ospfNote}>
        <GraduationCap size={13} color={Colors.primary} weight="fill" />
        <Text style={illus.ospfNoteText}>
          NetForge uses the same shortest-path logic as OSPF
        </Text>
      </View>
    </View>
  )
}

function ExportIllustration() {
  const lines = [
    'interface GigabitEthernet0/0',
    ' ip address 10.0.0.1 255.255.255.252',
    ' no shutdown',
    '!',
    'router ospf 1',
    ' network 10.0.0.0 0.0.0.3 area 0',
  ]
  return (
    <View style={illus.wrapper}>
      <View style={illus.cliBox}>
        {lines.map((line, i) => (
          <Text key={i} style={[illus.cliLine, { color: line.startsWith('interface') || line.startsWith('router') ? Colors.vizPath : line.startsWith(' ip') || line.startsWith(' network') ? Colors.vizSettled : Colors.textMuted }]}>
            {line}
          </Text>
        ))}
      </View>
      <View style={illus.exportBadge}>
        <Export size={13} color={Colors.primary} />
        <Text style={illus.exportBadgeText}>Cisco IOS CLI Ready</Text>
      </View>
    </View>
  )
}

// ─── Slide definitions ───────────────────────────────────────────────────────
type Slide = {
  icon: React.ReactNode
  title: string
  subtitle: string
  illustration: React.ReactNode
  tip?: string
  tipLabel?: string
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter()
  const [activeSlide, setActiveSlide] = useState(0)
  const fadeAnim = useRef(new Animated.Value(1)).current

  const slides: Slide[] = [
    {
      icon: <RouterIcon size={24} color={Colors.primary} />,
      title: 'Design Networks Visually',
      subtitle: 'Drop routers, switches, firewalls, and WAN uplinks onto a canvas. Wire them together in seconds.',
      illustration: <TopologyBuilderIllustration step={0} />,
    },
    {
      icon: <Globe size={24} color={Colors.primary} weight="fill" />,
      title: 'Add Switches & Connect Devices',
      subtitle: 'Tap a node to configure ports, VLANs, and IP addresses. Drag to connect devices with smart link snapping.',
      illustration: <TopologyBuilderIllustration step={1} />,
    },
    {
      icon: <ArrowsLeftRight size={24} color={Colors.primary} weight="fill" />,
      title: 'Wire & Configure Interfaces',
      subtitle: 'Assign IP addresses to router interfaces, configure trunk and access VLAN ports on switches.',
      illustration: <TopologyBuilderIllustration step={2} />,
      tip: 'Each physical link corresponds to a real interface on the device.',
      tipLabel: 'Interface tip',
    },
    {
      icon: <ShieldCheck size={24} color={Colors.primary} weight="fill" />,
      title: 'Live Validation',
      subtitle: 'NetForge automatically checks for routing loops, IP conflicts, isolated devices, and VLAN mismatches as you build.',
      illustration: <ValidationIllustration passed={true} />,
      tip: 'Validation runs in real-time. You\'ll see warnings the moment a problem appears.',
      tipLabel: 'Always-on',
    },
    {
      icon: <ArrowRight size={24} color={Colors.primary} weight="fill" />,
      title: 'Find the Best Route',
      subtitle: 'Tap any two devices to instantly trace the best path between them. NetForge shows every hop and the routing decision.',
      illustration: <RouteIllustration />,
      tip: 'Behind the scenes, NetForge uses the same shortest-path logic found in OSPF — Dijkstra\'s algorithm. You can reveal the full step-by-step analysis anytime.',
      tipLabel: 'How it works',
    },
    {
      icon: <GraduationCap size={24} color={Colors.primary} weight="fill" />,
      title: 'Understand Every Decision',
      subtitle: 'Enable Explain Mode to see why routes were selected, why validation failed, and how redundant links are optimized.',
      illustration: <ValidationIllustration passed={false} />,
      tip: 'Explain Mode never interrupts your workflow. It only reveals details when you want them.',
      tipLabel: 'Optional depth',
    },
    {
      icon: <Export size={24} color={Colors.primary} weight="fill" />,
      title: 'Export to Cisco CLI',
      subtitle: 'When you\'re happy with the design, export production-ready Cisco IOS configuration scripts with one tap.',
      illustration: <ExportIllustration />,
    },
  ]

  const handleNext = () => {
    if (activeSlide >= slides.length - 1) return
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
    setActiveSlide(activeSlide + 1)
  }

  const handleSkip = () => setActiveSlide(slides.length - 1)

  const current = slides[activeSlide]
  const isLast = activeSlide === slides.length - 1

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar: logo + skip */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <NetForgeLogo size={26} />
          <Text style={styles.wordmark}>NetForge</Text>
        </View>
        {!isLast && (
          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}
      </View>

      {/* Step progress dots */}
      <View style={styles.dotsRow}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              activeSlide === i
                ? styles.dotActive
                : activeSlide > i
                ? styles.dotDone
                : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Slide content (fades on transition) */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Step indicator badge */}
        <View style={styles.stepBadge}>
          {current.icon}
          <Text style={styles.stepBadgeText}>
            Step {activeSlide + 1} of {slides.length}
          </Text>
        </View>

        {/* Illustration */}
        <View style={styles.illustrationWrapper}>
          {current.illustration}
        </View>

        {/* Title + subtitle */}
        <View style={styles.textContainer}>
          <Text style={styles.slideTitle}>{current.title}</Text>
          <Text style={styles.slideSubtitle}>{current.subtitle}</Text>
        </View>

        {/* Optional contextual tip */}
        {current.tip && (
          <View style={styles.tipCard}>
            <View style={styles.tipHeader}>
              <GraduationCap size={14} color={Colors.primary} weight="fill" />
              <Text style={styles.tipLabel}>{current.tipLabel ?? 'Tip'}</Text>
            </View>
            <Text style={styles.tipText}>{current.tip}</Text>
          </View>
        )}
      </Animated.View>

      {/* CTA buttons */}
      <View style={styles.buttons}>
        {isLast ? (
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
            {/* Offline/guest mode is available in all builds as a legitimate use-case */}
            <Button
              label="Continue as Guest"
              variant="ghost"
              fullWidth
              onPress={async () => {
                await useAuthStore.getState().signInAsGuest()
                router.replace('/(tabs)')
              }}
            />
          </>
        ) : (
          <Button
            label={activeSlide === slides.length - 2 ? "Let's go →" : 'Next'}
            variant="primary"
            fullWidth
            onPress={handleNext}
          />
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

  // ── Top bar ────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  wordmark: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  skipButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textMuted,
  },

  // ── Progress dots ─────────────────────────────────────────────────────────
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 22,
    backgroundColor: Colors.primary,
  },
  dotDone: {
    width: 6,
    backgroundColor: Colors.medium,
  },
  dotInactive: {
    width: 6,
    backgroundColor: Colors.ice,
  },

  // ── Slide content area ────────────────────────────────────────────────────
  // flex: 1 lets this section expand and push the buttons to the bottom
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  // Step indicator pill
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Colors.primary}10`,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${Colors.primary}25`,
    marginBottom: 24,
  },
  stepBadgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.primary,
  },

  // Illustration container
  illustrationWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 28,
  },

  // Title + subtitle block
  textContainer: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  slideTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 32,
  },
  slideSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 23,
  },

  // Contextual tip card
  tipCard: {
    width: '100%',
    backgroundColor: `${Colors.primary}07`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${Colors.primary}20`,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    // subtle elevation to separate from the background
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },
  tipText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  buttons: {
    gap: 12,
    paddingBottom: 24,
  },
})

const illus = StyleSheet.create({
  wrapper: {
    position: 'relative',
    width: Math.min(width - 48, 320),
    height: 170,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    position: 'absolute',
    height: 2,
    borderTopWidth: 2,
  },
  node: {
    position: 'absolute',
    width: 60,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  nodeLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.white,
  },
  ipBadge: {
    position: 'absolute',
    backgroundColor: Colors.white,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    color: Colors.textSecondary,
  },
  statusBar: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: Colors.textSecondary,
  },

  // Validation
  checkList: {
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textPrimary,
  },
  warningDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.warningContainer,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  validBadge: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  validBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },

  // Route
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  routeNode: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  routeNodeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.white,
  },
  routeResult: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  routeResultText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textPrimary,
  },
  ospfNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${Colors.primary}10`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ospfNoteText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: Colors.primary,
    flex: 1,
    lineHeight: 14,
  },

  // CLI export
  cliBox: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 10,
    padding: 10,
    gap: 1,
    width: 240,
    marginBottom: 8,
  },
  cliLine: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9.5,
    lineHeight: 14,
  },
  exportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.white,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  exportBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.primary,
  },
})
