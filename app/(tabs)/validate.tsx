import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ShieldCheck, ArrowsClockwise } from 'phosphor-react-native'
import { useConfigStore } from '@/stores/useConfigStore'
import { useValidation } from '@/hooks/useValidation'
import { ValidationCard } from '@/components/ui/ValidationCard'
import { Button } from '@/components/ui/Button'
import { Colors } from '@/constants/colors'

export default function ValidateScreen() {
  const router = useRouter()
  const { activeConfig } = useConfigStore()
  const [key, setKey] = useState(0) // increment to re-trigger animations

  const departments = activeConfig?.departments ?? []
  const validation = useValidation(departments)

  const allPass =
    validation.cycleCheck.passed &&
    validation.allocationCheck.passed &&
    validation.connectivityCheck.passed &&
    validation.vlanCheck.passed

  const handleRerun = () => {
    setKey((k) => k + 1)
  }

  if (!activeConfig) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Validation</Text>
        </View>
        <View style={styles.emptyState}>
          <ShieldCheck size={56} color={Colors.pale} />
          <Text style={styles.emptyTitle}>No configuration selected</Text>
          <Text style={styles.emptySubtitle}>Select a configuration to run validation checks.</Text>
          <Button
            label="Go to Configs"
            variant="primary"
            onPress={() => router.push('/(tabs)/configs')}
          />
        </View>
      </SafeAreaView>
    )
  }

  const checks = [
    {
      title: 'Cycle detection',
      description: 'Checking for routing loops in graph topology.',
      result: validation.cycleCheck,
    },
    {
      title: 'Subnet allocation',
      description: 'Checking for overlapping IP ranges in VLAN clusters.',
      result: validation.allocationCheck,
    },
    {
      title: 'Connectivity check',
      description: 'Verifying all departments are reachable via BFS.',
      result: validation.connectivityCheck,
    },
    {
      title: 'VLAN assignment',
      description: 'Verifying all access ports mapped to valid broadcast domains.',
      result: validation.vlanCheck,
    },
  ]

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Validation</Text>
          <Pressable onPress={() => router.push('/(tabs)/configs')}>
            <Text style={styles.configName}>
              Config: <Text style={styles.configNameLink}>{activeConfig.name}</Text>
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* All-pass banner */}
        {allPass && (
          <View style={styles.passBanner}>
            <ShieldCheck size={24} color={Colors.success} weight="fill" />
            <Text style={styles.passBannerText}>
              Validation complete. No critical topology conflicts found.
            </Text>
          </View>
        )}

        {/* Check cards */}
        <View style={styles.cards} key={key}>
          {checks.map((check, index) => (
            <ValidationCard
              key={`${check.title}-${key}`}
              title={check.title}
              description={check.description}
              result={check.result}
              index={index}
            />
          ))}
        </View>
      </ScrollView>

      {/* Re-run button */}
      <View style={styles.footer}>
        <Button
          label="Re-run validation"
          variant="primary"
          fullWidth
          onPress={handleRerun}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surfaceAlt },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    color: Colors.primary,
  },
  configName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  configNameLink: {
    color: Colors.primary,
    fontFamily: 'Inter_500Medium',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 100,
  },
  passBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.successContainer,
    borderRadius: 14,
    padding: 16,
  },
  passBannerText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.success,
    lineHeight: 20,
  },
  cards: { gap: 12 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
})
