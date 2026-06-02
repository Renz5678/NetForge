/**
 * app/(tabs)/subnet.tsx
 *
 * VLSM Subnet Calculator — professional IP address planning tool.
 *
 * Allows network engineers to:
 *   1. Define a parent network (CIDR notation)
 *   2. Specify per-segment host requirements
 *   3. Receive optimally-allocated subnets with full addressing detail
 *
 * Implementation uses VLSM (Variable Length Subnet Masking) for optimal
 * address space utilization — the same technique used in production networks.
 */

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ChartPieSlice,
  Plus,
  Trash,
  Lightning,
  CaretRight,
  CaretDown,
  WarningCircle,
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
        maxLength={24}
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

function DetailRow({
  label,
  value,
  mono,
  warn,
}: {
  label: string
  value: string
  mono?: boolean
  warn?: boolean
}) {
  return (
    <View style={sh.detailRow}>
      <Text style={sh.detailLabel}>{label}</Text>
      <Text style={[sh.detailValue, mono && sh.mono, warn && { color: Colors.warning }]}>
        {value}
      </Text>
    </View>
  )
}

function ResultCard({ result, index }: { result: SubnetResult; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const color = SUBNET_PALETTE[index % SUBNET_PALETTE.length]

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={[sh.resultCard, { borderLeftColor: color }]}
    >
      {/* Summary row */}
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
        <View
          style={[
            sh.utilFill,
            { width: `${result.utilizationPct}%` as any, backgroundColor: color },
          ]}
        />
      </View>

      {/* Expanded addressing details */}
      {expanded && (
        <View style={sh.resultDetails}>
          <DetailRow label="Network" value={result.networkAddress} />
          <DetailRow label="Subnet Mask" value={result.subnetMask} mono />
          <DetailRow label="First Usable" value={result.firstUsable} mono />
          <DetailRow label="Last Usable" value={result.lastUsable} mono />
          <DetailRow label="Broadcast" value={result.broadcastAddress} mono />
          <DetailRow label="Usable Hosts" value={`${result.allocatedHosts}`} />
          <DetailRow label="Required" value={`${result.requiredHosts}`} />
          <DetailRow
            label="Wasted"
            value={`${result.wastedHosts} addresses`}
            warn={result.wastedHosts > result.requiredHosts}
          />
        </View>
      )}
    </Pressable>
  )
}

function AddressSpaceBar({
  results,
  totalHosts,
}: {
  results: SubnetResult[]
  totalHosts: number
}) {
  if (results.length === 0) return null
  return (
    <View style={s.spaceBar}>
      {results.map((r, i) => {
        const pct = (Math.pow(2, 32 - r.prefix) / totalHosts) * 100
        const color = SUBNET_PALETTE[i % SUBNET_PALETTE.length]
        return (
          <View
            key={r.id}
            style={[s.spaceSegment, { flex: pct, backgroundColor: color }]}
          >
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

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = 'configure' | 'results'

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SubnetScreen() {
  const [networkCidr, setNetworkCidr] = useState('192.168.1.0/24')
  const [cidrError, setCidrError] = useState('')
  const [requirements, setRequirements] = useState<SubnetRequirement[]>([
    { id: genId(), label: 'Management', hosts: 10 },
    { id: genId(), label: 'Engineering', hosts: 50 },
    { id: genId(), label: 'Sales', hosts: 30 },
  ])
  const [calculation, setCalculation] = useState<VlsmCalculation | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('configure')
  const [calculating, setCalculating] = useState(false)

  // ── Requirement handlers ─────────────────────────────────────────────────

  const handleAddRequirement = () => {
    setRequirements((prev) => [
      ...prev,
      { id: genId(), label: `Subnet ${prev.length + 1}`, hosts: 0 },
    ])
  }

  const handleDeleteRequirement = (id: string) => {
    setRequirements((prev) => prev.filter((r) => r.id !== id))
  }

  const handleLabelChange = (id: string, val: string) => {
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, label: val } : r))
    )
  }

  const handleHostsChange = (id: string, val: string) => {
    const n = parseInt(val, 10)
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, hosts: isNaN(n) ? 0 : n } : r))
    )
  }

  // ── Calculation ──────────────────────────────────────────────────────────

  const handleCalculate = useCallback(() => {
    const validation = validateCIDR(networkCidr)
    if (!validation.valid) {
      setCidrError(validation.error ?? 'Invalid CIDR notation')
      return
    }
    setCidrError('')

    const validReqs = requirements.filter((r) => r.label.trim() && r.hosts > 0)
    if (validReqs.length === 0) {
      setCidrError('Add at least one subnet with a host count before allocating.')
      return
    }

    setCalculating(true)
    // Defer the heavy calculation to keep the UI thread responsive
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

  const TABS: { key: Tab; label: string }[] = [
    { key: 'configure', label: 'Configure' },
    { key: 'results', label: 'Results' },
  ]

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <TopHeader
        title="Subnet Calculator"
        subtitle="VLSM · Variable-length subnet masking"
        leftIcon={
          <View style={s.iconWrap}>
            <ChartPieSlice size={20} color={Colors.white} weight="fill" />
          </View>
        }
      />

      {/* Internal tab bar (Configure / Results) */}
      <View style={s.tabBar}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[s.tabItem, activeTab === t.key && s.tabItemActive]}
            onPress={() => setActiveTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === t.key }}
          >
            <Text style={[s.tabLabel, activeTab === t.key && s.tabLabelActive]}>
              {t.label}
            </Text>
            {activeTab === t.key && <View style={s.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      {/* ── CONFIGURE TAB ────────────────────────────────────────── */}
      {activeTab === 'configure' && (
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
              subtitle="The address block to carve subnets from"
            />
            <View style={s.card}>
              <Text style={s.fieldLabel}>NETWORK ADDRESS (CIDR)</Text>
              <TextInput
                style={[s.cidrInput, cidrError && s.cidrInputError]}
                value={networkCidr}
                onChangeText={(v) => {
                  setNetworkCidr(v)
                  setCidrError('')
                }}
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

              {/* Quick-pick presets */}
              <Text style={s.quickLabel}>Quick select</Text>
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

            {/* Segment requirements */}
            <SectionHeader
              title="Segment Requirements"
              subtitle="Name each segment and specify the number of hosts needed"
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
                  onDelete={() => handleDeleteRequirement(req.id)}
                />
              ))}
              <Pressable style={s.addBtn} onPress={handleAddRequirement}>
                <Plus size={16} color={Colors.primary} weight="bold" />
                <Text style={s.addBtnText}>Add Segment</Text>
              </Pressable>
            </View>

            {/* Allocate button */}
            <Pressable
              style={[s.calcBtn, calculating && s.calcBtnDisabled]}
              onPress={handleCalculate}
              disabled={calculating}
            >
              <Lightning size={18} color={Colors.white} weight="fill" />
              <Text style={s.calcBtnText}>
                {calculating ? 'Allocating…' : 'Allocate Subnets'}
              </Text>
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── RESULTS TAB ──────────────────────────────────────────── */}
      {activeTab === 'results' && (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!calculation ? (
            // Empty state — no calculation run yet
            <View style={s.emptyState}>
              <ChartPieSlice size={52} color={Colors.pale} weight="duotone" />
              <Text style={s.emptyTitle}>No allocation yet</Text>
              <Text style={s.emptyDesc}>
                Go to Configure, enter your requirements, and tap Allocate Subnets.
              </Text>
              <Pressable style={s.emptyBtn} onPress={() => setActiveTab('configure')}>
                <Text style={s.emptyBtnText}>Go to Configure</Text>
              </Pressable>
            </View>
          ) : !calculation.summary.success ? (
            // Allocation failed
            <View style={s.errorCard}>
              <WarningCircle size={36} color={Colors.error} weight="duotone" />
              <Text style={s.errorCardTitle}>Allocation Failed</Text>
              <Text style={s.errorCardMsg}>{calculation.summary.errorMessage}</Text>
              <Pressable style={s.errorCardBtn} onPress={() => setActiveTab('configure')}>
                <Text style={s.errorCardBtnText}>Adjust Requirements</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Success summary banner */}
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

              {/* Address space map */}
              <View style={s.card}>
                <Text style={s.fieldLabel}>ADDRESS SPACE MAP</Text>
                <Text style={s.spaceBarNet}>
                  {calculation.networkAddress}/{calculation.prefix}
                </Text>
                <AddressSpaceBar
                  results={calculation.results}
                  totalHosts={calculation.totalHosts}
                />
                <View style={s.spaceLegend}>
                  {calculation.results.map((r, i) => (
                    <View key={r.id} style={s.legendItem}>
                      <View
                        style={[
                          s.legendDot,
                          { backgroundColor: SUBNET_PALETTE[i % SUBNET_PALETTE.length] },
                        ]}
                      />
                      <Text style={s.legendText}>{r.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Per-subnet cards */}
              <SectionHeader
                title="Allocated Subnets"
                subtitle="Tap a card to see full addressing detail"
              />
              {calculation.results.map((r, i) => (
                <ResultCard key={r.id} result={r} index={i} />
              ))}

              {/* Parent network summary */}
              <View style={[s.card, { marginTop: 8 }]}>
                <Text style={s.fieldLabel}>PARENT NETWORK SUMMARY</Text>
                <DetailRow
                  label="Network"
                  value={`${calculation.networkAddress}/${calculation.prefix}`}
                />
                <DetailRow
                  label="Total Addresses"
                  value={calculation.totalHosts.toLocaleString()}
                />
                <DetailRow
                  label="Usable Hosts"
                  value={calculation.usableHosts.toLocaleString()}
                />
                <DetailRow
                  label="Allocated"
                  value={`${calculation.summary.totalAllocated} hosts`}
                />
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
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Internal tab bar ──────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabItemActive: {},
  tabLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  // ── Card ──────────────────────────────────────────────────────────────────
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

  // ── Field labels (all-caps style) ─────────────────────────────────────────
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10,
  },

  // ── CIDR input ────────────────────────────────────────────────────────────
  cidrInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    letterSpacing: 0.5,
  },
  cidrInputError: { borderColor: Colors.error },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.error },

  // ── Quick-pick network chips ──────────────────────────────────────────────
  quickLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 14,
    marginBottom: 8,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quickChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  quickChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  quickChipLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textPrimary,
  },
  quickChipLabelActive: { color: Colors.white },
  quickChipDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },

  // ── Add segment button ────────────────────────────────────────────────────
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary + '60',
    backgroundColor: Colors.primary + '06',
  },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.primary },

  // ── Allocate button ───────────────────────────────────────────────────────
  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
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

  // ── Results: summary banner ───────────────────────────────────────────────
  summaryBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 22, color: Colors.white },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.ice, marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: Colors.white + '30' },

  // ── Address space bar ─────────────────────────────────────────────────────
  spaceBarNet: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  spaceBar: {
    flexDirection: 'row',
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  spaceSegment: { justifyContent: 'center', alignItems: 'center' },
  spaceLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, color: Colors.white },
  spaceLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textSecondary },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 10,
  },
  emptyBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.white },

  // ── Error card ────────────────────────────────────────────────────────────
  errorCard: {
    backgroundColor: Colors.errorContainer,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  errorCardTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.error,
    marginTop: 12,
    marginBottom: 8,
  },
  errorCardMsg: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorCardBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.error,
    borderRadius: 10,
  },
  errorCardBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.white },
})

// ── Requirement row styles ────────────────────────────────────────────────────

const sh = StyleSheet.create({
  sectionHeader: { marginBottom: 8, marginTop: 4 },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  sectionSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },

  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderRadius: 2,
  },
  reqIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqIndexText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: Colors.white },
  reqLabel: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  reqHostsWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reqHosts: {
    width: 60,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 36,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  reqHostsUnit: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted },
  reqDelete: { padding: 4 },

  // ── Result card ────────────────────────────────────────────────────────
  resultCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  resultDot: { width: 10, height: 10, borderRadius: 5 },
  resultLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  resultCidr: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  resultBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.successContainer,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginRight: 4,
  },
  resultBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Colors.success,
  },

  // ── Utilization bar ────────────────────────────────────────────────────
  utilBar: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: 0,
  },
  utilFill: { height: 4, borderRadius: 2 },

  // ── Expanded detail rows ───────────────────────────────────────────────
  resultDetails: { marginTop: 12 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  detailValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textPrimary,
  },
  mono: { fontFamily: 'Inter_500Medium' },
})
