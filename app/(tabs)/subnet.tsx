/**
 * app/(tabs)/subnet.tsx
 *
 * Subnet Calculator Tab — Professional VLSM-based subnet design tool.
 *
 * Algorithms used (networking-first framing):
 *   • Decrease & Conquer: Insertion Sort  — sort by host count before allocation
 *   • Divide & Conquer:   Binary Search   — find minimum prefix per requirement
 *   • Greedy:             VLSM            — allocate subnets from lowest address
 *   • Brute Force:        Sequential Search — educational comparison
 */

import React, { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ChartPieSlice,
  Plus,
  Trash,
  Lightning,
  CaretRight,
  CaretDown,
  CheckCircle,
  WarningCircle,
  Info,
  ArrowsDownUp,
  MagnifyingGlass,
  ChartBar,
  Copy,
  ArrowRight,
} from 'phosphor-react-native'
import { Colors } from '@/constants/colors'
import {
  calculateVLSM,
  validateCIDR,
  type SubnetRequirement,
  type SubnetResult,
  type VlsmCalculation,
} from '@/lib/algorithms/vlsmCalculator'
import { TopHeader } from '@/components/ui/TopHeader'

// ── Helpers ───────────────────────────────────────────────────────────────────

let _idCounter = 0
function genId() {
  return `req_${Date.now()}_${++_idCounter}`
}

const QUICK_NETWORKS = [
  { label: '192.168.1.0/24', desc: '254 hosts' },
  { label: '10.0.0.0/16', desc: '65,534 hosts' },
  { label: '172.16.0.0/20', desc: '4,094 hosts' },
  { label: '10.10.0.0/22', desc: '1,022 hosts' },
]

const ALGO_LABELS: Record<string, { short: string; color: string }> = {
  insertion_sort: { short: 'Insertion Sort', color: Colors.warning },
  binary_search:  { short: 'Binary Search',  color: Colors.medium },
  greedy:         { short: 'Greedy (VLSM)',  color: Colors.success },
  brute_force:    { short: 'Brute Force',    color: Colors.vizInStack },
}

const SUBNET_PALETTE = [
  '#2563EB', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6',
  '#F97316', '#6366F1',
]

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={sh.sectionHeader}>
      <Text style={sh.sectionTitle}>{title}</Text>
      {subtitle && <Text style={sh.sectionSub}>{subtitle}</Text>}
    </View>
  )
}

function RequirementRow({
  req,
  index,
  onLabelChange,
  onHostsChange,
  onDelete,
  color,
}: {
  req: SubnetRequirement
  index: number
  onLabelChange: (val: string) => void
  onHostsChange: (val: string) => void
  onDelete: () => void
  color: string
}) {
  return (
    <View style={[sh.reqRow, { borderLeftColor: color }]}>
      <View style={[sh.reqIndex, { backgroundColor: color }]}>
        <Text style={sh.reqIndexText}>{index + 1}</Text>
      </View>
      <TextInput
        style={sh.reqLabel}
        placeholder="Subnet name"
        placeholderTextColor={Colors.textMuted}
        value={req.label}
        onChangeText={onLabelChange}
        maxLength={20}
      />
      <View style={sh.reqHostsWrap}>
        <TextInput
          style={sh.reqHosts}
          placeholder="Hosts"
          placeholderTextColor={Colors.textMuted}
          value={req.hosts > 0 ? String(req.hosts) : ''}
          keyboardType="numeric"
          onChangeText={onHostsChange}
          maxLength={6}
        />
        <Text style={sh.reqHostsUnit}>hosts</Text>
      </View>
      <Pressable onPress={onDelete} style={sh.reqDelete} hitSlop={8}>
        <Trash size={16} color={Colors.error} weight="bold" />
      </Pressable>
    </View>
  )
}

function ResultCard({ result, index }: { result: SubnetResult; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const color = SUBNET_PALETTE[index % SUBNET_PALETTE.length]

  return (
    <Pressable onPress={() => setExpanded(!expanded)} style={[sh.resultCard, { borderLeftColor: color }]}>
      {/* Header row */}
      <View style={sh.resultHeader}>
        <View style={[sh.resultDot, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={sh.resultLabel}>{result.label}</Text>
          <Text style={sh.resultCidr}>{result.cidr}</Text>
        </View>
        <View style={sh.resultBadge}>
          <Text style={sh.resultBadgeText}>{result.utilizationPct}%</Text>
        </View>
        {expanded
          ? <CaretDown size={16} color={Colors.textMuted} />
          : <CaretRight size={16} color={Colors.textMuted} />}
      </View>

      {/* Utilization bar */}
      <View style={sh.utilBar}>
        <View style={[sh.utilFill, { width: `${result.utilizationPct}%` as any, backgroundColor: color }]} />
      </View>

      {/* Expanded details */}
      {expanded && (
        <View style={sh.resultDetails}>
          <DetailRow label="Network" value={result.networkAddress} />
          <DetailRow label="Subnet Mask" value={result.subnetMask} />
          <DetailRow label="First Usable" value={result.firstUsable} />
          <DetailRow label="Last Usable" value={result.lastUsable} />
          <DetailRow label="Broadcast" value={result.broadcastAddress} />
          <DetailRow label="Allocated" value={`${result.allocatedHosts} usable hosts`} />
          <DetailRow label="Required" value={`${result.requiredHosts} hosts`} />
          <DetailRow label="Wasted" value={`${result.wastedHosts} addresses`} mono warn={result.wastedHosts > result.requiredHosts} />
        </View>
      )}
    </Pressable>
  )
}

function DetailRow({ label, value, mono, warn }: { label: string; value: string; mono?: boolean; warn?: boolean }) {
  return (
    <View style={sh.detailRow}>
      <Text style={sh.detailLabel}>{label}</Text>
      <Text style={[sh.detailValue, mono && sh.mono, warn && { color: Colors.warning }]}>{value}</Text>
    </View>
  )
}

function AddressSpaceBar({ results, totalHosts }: { results: SubnetResult[]; totalHosts: number }) {
  if (results.length === 0) return null
  return (
    <View style={s.spaceBar}>
      {results.map((r, i) => {
        const pct = (Math.pow(2, 32 - r.prefix) / totalHosts) * 100
        const color = SUBNET_PALETTE[i % SUBNET_PALETTE.length]
        return (
          <View key={r.id} style={[s.spaceSegment, { flex: pct, backgroundColor: color }]}>
            {pct > 8 && (
              <Text style={s.spaceLabel} numberOfLines={1}>
                /{r.prefix}
              </Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

function StepBubble({ step, index }: { step: import('@/lib/algorithms/vlsmCalculator').VlsmStep; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const algo = ALGO_LABELS[step.algorithm]
  const phaseColor = step.phase === 'before' ? Colors.warning
    : step.phase === 'during' ? Colors.primary
    : Colors.success

  return (
    <Pressable onPress={() => setExpanded(!expanded)} style={sh.stepBubble}>
      <View style={[sh.stepPhaseBar, { backgroundColor: phaseColor }]} />
      <View style={{ flex: 1 }}>
        <View style={sh.stepTop}>
          <View style={[sh.stepAlgoBadge, { backgroundColor: algo.color + '20' }]}>
            <Text style={[sh.stepAlgoText, { color: algo.color }]}>{algo.short}</Text>
          </View>
          <Text style={[sh.stepPhaseText, { color: phaseColor }]}>
            {step.phase.toUpperCase()}
          </Text>
        </View>
        <Text style={sh.stepTitle}>{step.title}</Text>
        <Text style={sh.stepDesc}>{step.description}</Text>
        {expanded && step.technicalNote && (
          <View style={sh.stepTechNote}>
            <Info size={12} color={Colors.textMuted} />
            <Text style={sh.stepTechText}>{step.technicalNote}</Text>
          </View>
        )}
      </View>
      <View style={sh.stepChevron}>
        {expanded
          ? <CaretDown size={14} color={Colors.textMuted} />
          : <CaretRight size={14} color={Colors.textMuted} />}
      </View>
    </Pressable>
  )
}

function ComparisonCard({ calc }: { calc: VlsmCalculation }) {
  const { bruteForceComparison: bf } = calc
  return (
    <View style={s.compCard}>
      <View style={s.compHeader}>
        <ChartBar size={18} color={Colors.primary} weight="duotone" />
        <Text style={s.compTitle}>Algorithm Efficiency</Text>
      </View>
      <Text style={s.compSub}>
        How Greedy compares to Brute Force Sequential Search for {calc.requirements.length} subnets
      </Text>

      <View style={s.compRow}>
        {/* Greedy */}
        <View style={[s.compBlock, { borderColor: Colors.success + '40', backgroundColor: Colors.successContainer }]}>
          <Text style={s.compBlockLabel}>Greedy (VLSM)</Text>
          <Text style={[s.compBlockValue, { color: Colors.success }]}>{bf.greedySteps}</Text>
          <Text style={s.compBlockUnit}>steps</Text>
        </View>

        <View style={s.compArrow}>
          <ArrowRight size={20} color={Colors.textMuted} />
          <Text style={s.compArrowLabel}>{bf.speedupFactor}× faster</Text>
        </View>

        {/* Brute Force */}
        <View style={[s.compBlock, { borderColor: Colors.error + '30', backgroundColor: Colors.errorContainer }]}>
          <Text style={s.compBlockLabel}>Brute Force</Text>
          <Text style={[s.compBlockValue, { color: Colors.error }]}>
            {bf.bruteForceSteps > 9999 ? bf.bruteForceSteps.toLocaleString() : bf.bruteForceSteps}
          </Text>
          <Text style={s.compBlockUnit}>steps</Text>
        </View>
      </View>

      <Text style={s.compNote}>
        Brute force tries all {calc.requirements.length}! permutations × {calc.requirements.length} checks.{'\n'}
        Greedy makes one optimal pass — same result, exponentially fewer operations.
      </Text>
    </View>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

type Tab = 'input' | 'results' | 'steps'

export default function SubnetScreen() {
  const [networkCidr, setNetworkCidr] = useState('192.168.1.0/24')
  const [cidrError, setCidrError] = useState('')
  const [requirements, setRequirements] = useState<SubnetRequirement[]>([
    { id: genId(), label: 'Management', hosts: 10 },
    { id: genId(), label: 'Engineering', hosts: 50 },
    { id: genId(), label: 'Sales', hosts: 30 },
  ])
  const [calculation, setCalculation] = useState<VlsmCalculation | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('input')
  const [explainMode, setExplainMode] = useState(false)
  const [calculating, setCalculating] = useState(false)

  const handleAddRequirement = () => {
    setRequirements((prev) => [
      ...prev,
      { id: genId(), label: `Subnet ${prev.length + 1}`, hosts: 0 },
    ])
  }

  const handleDelete = (id: string) => {
    setRequirements((prev) => prev.filter((r) => r.id !== id))
  }

  const handleLabelChange = (id: string, val: string) => {
    setRequirements((prev) => prev.map((r) => (r.id === id ? { ...r, label: val } : r)))
  }

  const handleHostsChange = (id: string, val: string) => {
    const n = parseInt(val, 10)
    setRequirements((prev) => prev.map((r) => (r.id === id ? { ...r, hosts: isNaN(n) ? 0 : n } : r)))
  }

  const handleCalculate = useCallback(() => {
    const validation = validateCIDR(networkCidr)
    if (!validation.valid) {
      setCidrError(validation.error ?? 'Invalid CIDR')
      return
    }
    setCidrError('')

    const validReqs = requirements.filter((r) => r.label.trim() && r.hosts > 0)
    if (validReqs.length === 0) {
      setCidrError('Add at least one subnet requirement with a host count')
      return
    }

    setCalculating(true)
    // Defer to avoid blocking the UI thread
    setTimeout(() => {
      const result = calculateVLSM(networkCidr.trim(), validReqs)
      setCalculation(result)
      setActiveTab('results')
      setCalculating(false)
    }, 50)
  }, [networkCidr, requirements])

  const handleQuickNetwork = (cidr: string) => {
    setNetworkCidr(cidr)
    setCidrError('')
  }

  const copyAllCLI = () => {
    if (!calculation) return
    const lines = calculation.results.map(
      (r) => `ip route ${r.networkAddress} ${r.subnetMask} [next-hop]  ! ${r.label} — ${r.requiredHosts} hosts`
    )
    // Clipboard import would go here; for now just a placeholder
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'input', label: 'Design' },
    { key: 'results', label: 'Results' },
    { key: 'steps', label: 'Algorithm' },
  ]

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <TopHeader
        title="Subnet Calculator"
        subtitle="VLSM · Greedy allocation"
        leftIcon={
          <View style={s.iconWrap}>
            <ChartPieSlice size={20} color={Colors.white} weight="fill" />
          </View>
        }
        rightActions={
          <Pressable
            style={[s.explainBtn, explainMode && s.explainBtnOn]}
            onPress={() => setExplainMode(!explainMode)}
          >
            <Lightning
              size={14}
              color={explainMode ? Colors.white : Colors.primary}
              weight={explainMode ? 'fill' : 'regular'}
            />
            <Text style={[s.explainText, explainMode && s.explainTextOn]}>
              {explainMode ? 'Explain' : 'Explain'}
            </Text>
          </Pressable>
        }
      />

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[s.tabItem, activeTab === t.key && s.tabItemActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[s.tabLabel, activeTab === t.key && s.tabLabelActive]}>
              {t.label}
            </Text>
            {activeTab === t.key && <View style={s.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      {/* ── DESIGN TAB ── */}
      {activeTab === 'input' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Parent network */}
            <SectionHeader
              title="Parent Network"
              subtitle="The address space to carve subnets from"
            />
            <View style={s.card}>
              <Text style={s.fieldLabel}>Network Address (CIDR)</Text>
              <TextInput
                style={[s.cidrInput, cidrError && s.cidrInputError]}
                value={networkCidr}
                onChangeText={(v) => { setNetworkCidr(v); setCidrError('') }}
                placeholder="e.g. 192.168.1.0/24"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
              />
              {cidrError ? (
                <View style={s.errorRow}>
                  <WarningCircle size={14} color={Colors.error} />
                  <Text style={s.errorText}>{cidrError}</Text>
                </View>
              ) : null}

              {/* Quick picks */}
              <Text style={s.quickLabel}>Quick pick</Text>
              <View style={s.quickRow}>
                {QUICK_NETWORKS.map((n) => (
                  <Pressable
                    key={n.label}
                    style={[
                      s.quickChip,
                      networkCidr === n.label && s.quickChipActive,
                    ]}
                    onPress={() => handleQuickNetwork(n.label)}
                  >
                    <Text
                      style={[
                        s.quickChipLabel,
                        networkCidr === n.label && s.quickChipLabelActive,
                      ]}
                    >
                      {n.label}
                    </Text>
                    <Text
                      style={[
                        s.quickChipDesc,
                        networkCidr === n.label && { color: Colors.ice },
                      ]}
                    >
                      {n.desc}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Subnet requirements */}
            <SectionHeader
              title="Subnet Requirements"
              subtitle="Name each segment and enter the number of hosts needed"
            />
            <View style={s.card}>
              {requirements.map((req, i) => (
                <RequirementRow
                  key={req.id}
                  req={req}
                  index={i}
                  color={SUBNET_PALETTE[i % SUBNET_PALETTE.length]}
                  onLabelChange={(v) => handleLabelChange(req.id, v)}
                  onHostsChange={(v) => handleHostsChange(req.id, v)}
                  onDelete={() => handleDelete(req.id)}
                />
              ))}

              <Pressable style={s.addBtn} onPress={handleAddRequirement}>
                <Plus size={16} color={Colors.primary} weight="bold" />
                <Text style={s.addBtnText}>Add Subnet</Text>
              </Pressable>
            </View>

            {/* Algorithm info card */}
            {explainMode && (
              <View style={s.algoInfoCard}>
                <View style={s.algoInfoHeader}>
                  <Lightning size={16} color={Colors.primary} weight="fill" />
                  <Text style={s.algoInfoTitle}>What happens when you Calculate</Text>
                </View>
                <View style={s.algoStep}>
                  <View style={[s.algoStepDot, { backgroundColor: Colors.warning }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.algoStepName}>1. Insertion Sort (Decrease & Conquer)</Text>
                    <Text style={s.algoStepDesc}>Sorts subnets largest→smallest to prevent address fragmentation.</Text>
                  </View>
                </View>
                <View style={s.algoStep}>
                  <View style={[s.algoStepDot, { backgroundColor: Colors.medium }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.algoStepName}>2. Binary Search (Divide & Conquer)</Text>
                    <Text style={s.algoStepDesc}>Finds the minimum prefix length for each host count in O(log n).</Text>
                  </View>
                </View>
                <View style={s.algoStep}>
                  <View style={[s.algoStepDot, { backgroundColor: Colors.success }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.algoStepName}>3. Greedy VLSM (Greedy Algorithm)</Text>
                    <Text style={s.algoStepDesc}>Assigns each subnet to the next available block. Same logic as Cisco VLSM.</Text>
                  </View>
                </View>
                <View style={[s.algoStep, { borderBottomWidth: 0 }]}>
                  <View style={[s.algoStepDot, { backgroundColor: Colors.vizInStack }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.algoStepName}>4. Brute Force (Sequential Search)</Text>
                    <Text style={s.algoStepDesc}>Compares step count to show how much faster Greedy is.</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Calculate button */}
            <Pressable
              style={[s.calcBtn, calculating && s.calcBtnDisabled]}
              onPress={handleCalculate}
              disabled={calculating}
            >
              <Lightning size={18} color={Colors.white} weight="fill" />
              <Text style={s.calcBtnText}>
                {calculating ? 'Calculating…' : 'Calculate Subnets'}
              </Text>
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── RESULTS TAB ── */}
      {activeTab === 'results' && (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!calculation ? (
            <View style={s.emptyState}>
              <ChartPieSlice size={52} color={Colors.pale} weight="duotone" />
              <Text style={s.emptyTitle}>No calculation yet</Text>
              <Text style={s.emptyDesc}>
                Go to Design, enter your requirements, and tap Calculate Subnets.
              </Text>
              <Pressable style={s.emptyBtn} onPress={() => setActiveTab('input')}>
                <Text style={s.emptyBtnText}>Go to Design</Text>
              </Pressable>
            </View>
          ) : !calculation.summary.success ? (
            <View style={s.errorCard}>
              <WarningCircle size={36} color={Colors.error} weight="duotone" />
              <Text style={s.errorCardTitle}>Allocation Failed</Text>
              <Text style={s.errorCardMsg}>{calculation.summary.errorMessage}</Text>
              <Pressable style={s.errorCardBtn} onPress={() => setActiveTab('input')}>
                <Text style={s.errorCardBtnText}>Adjust Requirements</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Summary banner */}
              <View style={s.summaryBanner}>
                <View style={s.summaryItem}>
                  <Text style={s.summaryValue}>{calculation.results.length}</Text>
                  <Text style={s.summaryLabel}>Subnets</Text>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <Text style={s.summaryValue}>{calculation.summary.utilizationPct}%</Text>
                  <Text style={s.summaryLabel}>Utilization</Text>
                </View>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <Text style={s.summaryValue}>{calculation.summary.totalWasted}</Text>
                  <Text style={s.summaryLabel}>Wasted Addrs</Text>
                </View>
              </View>

              {/* Address space visual */}
              <View style={s.card}>
                <Text style={s.fieldLabel}>Address Space Map</Text>
                <Text style={s.spaceBarNet}>{calculation.networkAddress}/{calculation.prefix}</Text>
                <AddressSpaceBar
                  results={calculation.results}
                  totalHosts={calculation.totalHosts}
                />
                <View style={s.spaceLegend}>
                  {calculation.results.map((r, i) => (
                    <View key={r.id} style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: SUBNET_PALETTE[i % SUBNET_PALETTE.length] }]} />
                      <Text style={s.legendText}>{r.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Subnet cards */}
              <SectionHeader
                title="Allocated Subnets"
                subtitle="Tap each card to expand full addressing details"
              />
              {calculation.results.map((r, i) => (
                <ResultCard key={r.id} result={r} index={i} />
              ))}

              {/* Algorithm comparison */}
              {explainMode && <ComparisonCard calc={calculation} />}

              {/* Parent network info */}
              <View style={[s.card, { marginTop: 8 }]}>
                <Text style={s.fieldLabel}>Parent Network</Text>
                <DetailRow label="Network" value={`${calculation.networkAddress}/${calculation.prefix}`} />
                <DetailRow label="Total Addresses" value={calculation.totalHosts.toLocaleString()} />
                <DetailRow label="Usable Hosts" value={calculation.usableHosts.toLocaleString()} />
                <DetailRow label="Allocated" value={`${calculation.summary.totalAllocated} hosts`} />
                <DetailRow
                  label="Wasted"
                  value={`${calculation.summary.totalWasted} addresses`}
                  warn={calculation.summary.totalWasted > calculation.summary.totalAllocated}
                />
              </View>

              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
      )}

      {/* ── ALGORITHM STEPS TAB ── */}
      {activeTab === 'steps' && (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!calculation ? (
            <View style={s.emptyState}>
              <ArrowsDownUp size={52} color={Colors.pale} weight="duotone" />
              <Text style={s.emptyTitle}>Run a calculation first</Text>
              <Text style={s.emptyDesc}>
                The Algorithm tab shows every step — from sorting to allocation.
              </Text>
              <Pressable style={s.emptyBtn} onPress={() => setActiveTab('input')}>
                <Text style={s.emptyBtnText}>Go to Design</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Phase legend */}
              <View style={s.phaseLegend}>
                {[
                  { label: 'BEFORE', color: Colors.warning, desc: 'Preprocessing' },
                  { label: 'DURING', color: Colors.primary, desc: 'Allocation' },
                  { label: 'AFTER',  color: Colors.success, desc: 'Finalized' },
                ].map((p) => (
                  <View key={p.label} style={s.phaseLegendItem}>
                    <View style={[s.phaseDot, { backgroundColor: p.color }]} />
                    <View>
                      <Text style={[s.phaseLabel, { color: p.color }]}>{p.label}</Text>
                      <Text style={s.phaseDesc}>{p.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Algorithm badges */}
              <View style={s.algoBadgeRow}>
                {Object.entries(ALGO_LABELS).map(([key, val]) => (
                  <View key={key} style={[s.algoBadge, { backgroundColor: val.color + '15', borderColor: val.color + '40' }]}>
                    <View style={[s.algoBadgeDot, { backgroundColor: val.color }]} />
                    <Text style={[s.algoBadgeText, { color: val.color }]}>{val.short}</Text>
                  </View>
                ))}
              </View>

              <Text style={s.stepCount}>{calculation.steps.length} steps recorded</Text>

              {/* Step list */}
              {calculation.steps.map((step, i) => (
                <StepBubble key={i} step={step} index={i} />
              ))}

              {/* Efficiency comparison — always shown in Algorithm tab */}
              <ComparisonCard calc={calculation} />

              <View style={{ height: 40 }} />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: Colors.textPrimary },
  headerSub:   { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  explainBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  explainBtnOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  explainText:  { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: Colors.primary },
  explainTextOn:{ color: Colors.white },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
  },
  tabItemActive: {},
  tabLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textMuted,
  },
  tabLabelActive: { color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 16, right: 16,
    height: 2, backgroundColor: Colors.primary, borderRadius: 1,
  },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  // Section header
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
  },

  // CIDR input
  cidrInput: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: 'Inter_500Medium', fontSize: 15, color: Colors.textPrimary,
    backgroundColor: Colors.background,
    letterSpacing: 0.5,
  },
  cidrInputError: { borderColor: Colors.error },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.error },

  // Quick picks
  quickLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 11, color: Colors.textMuted,
    marginTop: 12, marginBottom: 6,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickChip: {
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  quickChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  quickChipLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: Colors.textPrimary },
  quickChipLabelActive: { color: Colors.white },
  quickChipDesc: { fontFamily: 'Inter_400Regular', fontSize: 10, color: Colors.textMuted, marginTop: 1 },

  // Add button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 8, paddingVertical: 11,
    borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: Colors.primary + '60',
    backgroundColor: Colors.primary + '06',
  },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.primary },

  // Algorithm info card
  algoInfoCard: {
    backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.primary + '25', marginBottom: 12,
    overflow: 'hidden',
  },
  algoInfoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary + '08', padding: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  algoInfoTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.primary },
  algoStep: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  algoStepDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  algoStepName: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.textPrimary, marginBottom: 2 },
  algoStepDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },

  // Calculate button
  calcBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15, borderRadius: 14,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginTop: 4,
  },
  calcBtnDisabled: { backgroundColor: Colors.soft, shadowOpacity: 0 },
  calcBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: Colors.white },

  // Empty state
  emptyState: {
    alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32,
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: Colors.textPrimary, marginTop: 16, marginBottom: 8 },
  emptyDesc:  { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn:   { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 10 },
  emptyBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.white },

  // Error card
  errorCard: {
    backgroundColor: Colors.errorContainer, borderRadius: 14, padding: 24,
    alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: Colors.error + '30',
  },
  errorCardTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: Colors.error, marginTop: 12, marginBottom: 8 },
  errorCardMsg:   { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  errorCardBtn:   { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.error, borderRadius: 10 },
  errorCardBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.white },

  // Summary banner
  summaryBanner: {
    flexDirection: 'row', backgroundColor: Colors.primary,
    borderRadius: 14, padding: 16, marginBottom: 12,
    alignItems: 'center', justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.white },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.ice, marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: Colors.white + '30' },

  // Address space bar
  spaceBarNet: { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colors.textMuted, marginBottom: 6 },
  spaceBar: { flexDirection: 'row', height: 32, borderRadius: 8, overflow: 'hidden', marginBottom: 10 },
  spaceSegment: { justifyContent: 'center', alignItems: 'center' },
  spaceLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, color: Colors.white },
  spaceLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textSecondary },

  // Phase legend
  phaseLegend: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: Colors.white, borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  phaseLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  phaseLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 },
  phaseDesc:  { fontFamily: 'Inter_400Regular', fontSize: 10, color: Colors.textMuted },

  // Algorithm badges row
  algoBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  algoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  algoBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  algoBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },

  stepCount: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted, marginBottom: 8,
  },

  // Comparison card
  compCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 16,
    marginTop: 8, marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  compHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  compTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.textPrimary },
  compSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted, marginBottom: 14, lineHeight: 18 },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  compBlock: {
    flex: 1, alignItems: 'center', padding: 12,
    borderRadius: 10, borderWidth: 1,
  },
  compBlockLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  compBlockValue: { fontFamily: 'Inter_700Bold', fontSize: 22 },
  compBlockUnit:  { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted },
  compArrow: { alignItems: 'center', gap: 2 },
  compArrowLabel: { fontFamily: 'Inter_700Bold', fontSize: 11, color: Colors.success },
  compNote: {
    fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted,
    lineHeight: 17, textAlign: 'center',
  },
})

// Requirement row styles
const sh = StyleSheet.create({
  sectionHeader: { marginBottom: 8, marginTop: 4 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.textPrimary },
  sectionSub:   { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  reqRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 8, paddingLeft: 10,
    borderLeftWidth: 3, borderRadius: 2,
  },
  reqIndex: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  reqIndexText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: Colors.white },
  reqLabel: {
    flex: 1, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 10, height: 36,
    fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  reqHostsWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reqHosts: {
    width: 60, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 8, height: 36, textAlign: 'center',
    fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  reqHostsUnit: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted },
  reqDelete: { padding: 4 },

  // Result card
  resultCard: {
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 4,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  resultDot: { width: 10, height: 10, borderRadius: 5 },
  resultLabel: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.textPrimary },
  resultCidr:  { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  resultBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.successContainer, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2, marginRight: 4,
  },
  resultBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: Colors.success },

  // Utilization bar
  utilBar: {
    height: 4, backgroundColor: Colors.border, borderRadius: 2, marginBottom: 0,
  },
  utilFill: { height: 4, borderRadius: 2 },

  // Expanded detail rows
  resultDetails: { marginTop: 12, gap: 0 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  detailLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted },
  detailValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.textPrimary },
  mono: { fontFamily: 'Inter_500Medium' },

  // Step bubble
  stepBubble: {
    flexDirection: 'row', gap: 10,
    backgroundColor: Colors.white, borderRadius: 12, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: Colors.border,
  },
  stepPhaseBar: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  stepTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  stepAlgoBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  stepAlgoText:  { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.3 },
  stepPhaseText: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.5, marginLeft: 'auto' },
  stepTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.textPrimary, marginBottom: 3 },
  stepDesc:  { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  stepTechNote: {
    flexDirection: 'row', gap: 5, marginTop: 8, alignItems: 'flex-start',
    backgroundColor: Colors.surfaceAlt, borderRadius: 8, padding: 8,
  },
  stepTechText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted, lineHeight: 16 },
  stepChevron: { paddingTop: 4 },
})
