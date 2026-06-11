import React, { useEffect, useState, useCallback, useRef } from 'react'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
} from 'react-native-reanimated'

// Custom lightweight uuidv4 implementation for React Native / Hermes compatibility
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
} from 'react-native'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  ArrowLeft,
  Plus,
  PencilSimple,
  Trash,
  MagnifyingGlass,
  Funnel,
  CaretDown,
  CaretUp,
  Globe,
  ListNumbers,
  Warning,
  Question,
  Link,
  Tag,
  WarningCircle,
  Info,
  SlidersHorizontal,
} from 'phosphor-react-native'
import { useConfigStore } from '@/stores/useConfigStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useValidation } from '@/hooks/useValidation'
import { useVisualizationStore } from '@/stores/useVisualizationStore'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { SyncConflictSheet } from '@/components/ui/SyncConflictSheet'
import { Input } from '@/components/ui/Input'
import { PeerChip } from '@/components/ui/PeerChip'
import { StepperInput } from '@/components/ui/StepperInput'
import { DeviceTypePicker } from '@/components/ui/DeviceTypePicker'
import { NetworkGraph } from '@/components/graph/NetworkGraph'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AlgorithmSelector } from '@/components/viz/AlgorithmSelector'
import { AlgorithmVisualizerPanel } from '@/components/viz/AlgorithmVisualizerPanel'
import { Colors } from '@/constants/colors'
import { buildDijkstraSteps } from '@/lib/algorithms/dijkstraVisualizer'
import { buildAStarSteps } from '@/lib/algorithms/aStarVisualizer'
import { buildCycleDetectionSteps } from '@/lib/algorithms/cycleDetectionVisualizer'
import { buildTopologicalSortSteps } from '@/lib/algorithms/topologicalSortVisualizer'
import { buildPrimsSteps } from '@/lib/algorithms/primsVisualizer'
import { findShortestPath } from '@/lib/algorithms/dijkstra'
import { findShortestPathAStar } from '@/lib/algorithms/aStar'
import type { Department, PathResult, AlgorithmType } from '@/types'
import type { ComparisonResult } from '@/stores/useVisualizationStore'
import { DepartmentSchema } from '@/lib/validators'

const generateId = () => 'dept_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)

function getSubnetDetails(subnetStr: string | undefined) {
  if (!subnetStr) return null
  const [ip, prefixStr] = subnetStr.split('/')
  const prefix = parseInt(prefixStr, 10)
  
  const parts = ip.split('.').map((p) => parseInt(p, 10))
  const ipNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  
  const netNum = (ipNum & mask) >>> 0
  const totalAddresses = 1 << (32 - prefix)
  const bcastNum = (netNum + totalAddresses - 1) >>> 0
  
  const uint32ToIp = (n: number) => {
    return `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`
  }
  
  const subnetMask = uint32ToIp(mask)
  const networkAddress = uint32ToIp(netNum)
  const broadcastAddress = uint32ToIp(bcastNum)
  
  let usableRange = 'N/A'
  if (prefix <= 30) {
    usableRange = `${uint32ToIp(netNum + 1)} - ${uint32ToIp(bcastNum - 1)}`
  }
  
  return {
    subnetMask,
    networkAddress,
    broadcastAddress,
    usableRange,
  }
}

// Path result sheet component (shown when 2 nodes selected)
function PathResultSheet({
  visible,
  onClose,
  result,
  departments,
  onReplay,
}: {
  visible: boolean
  onClose: () => void
  result: PathResult | null
  departments: Department[]
  onReplay?: () => void
}) {
  if (!result) return null

  const getDept = (id: string) => departments.find((d) => d.id === id)

  // Route type badge config
  const routeBadgeStyle = (type?: string) => {
    switch (type) {
      case 'OSPF':   return { bg: '#EFF6FF', color: '#2563EB', label: 'OSPF' }
      case 'STATIC': return { bg: '#FFF7ED', color: '#EA580C', label: 'STATIC' }
      case 'L2':     return { bg: '#ECFDF5', color: '#059669', label: 'L2 Switch' }
      default:       return { bg: '#F5F3FF', color: '#7C3AED', label: 'DIRECT' }
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={460}>
      {/* Header with Dijkstra badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
        <Text style={pathSheet.title}>
          {getDept(result.path[0])?.name ?? '?'} → {getDept(result.path[result.path.length - 1])?.name ?? '?'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <View style={{ backgroundColor: `${Colors.primary}12`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 10, color: Colors.primary, letterSpacing: 0.4 }}>DIJKSTRA</Text>
        </View>
        <Text style={pathSheet.subtitle}>{result.hops} {result.hops === 1 ? 'hop' : 'hops'} · Shortest route</Text>
        {onReplay && (
          <Pressable onPress={onReplay} style={{ marginLeft: 'auto' }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.primary }}>Step-by-step ›</Text>
          </Pressable>
        )}
      </View>

      <ScrollView style={pathSheet.list} showsVerticalScrollIndicator={false}>
        {result.path.map((id, index) => {
          const dept = getDept(id)
          const isLast = index === result.path.length - 1
          // Access hop detail from result if it's a PathTraceResult
          const hopDetail = (result as any).hops?.[index]
          const decision = hopDetail?.decisionReason
          const badge = routeBadgeStyle(hopDetail?.routeType ?? decision?.routeType)

          return (
            <View key={id} style={pathSheet.step}>
              <View style={pathSheet.stepLeft}>
                <View style={[pathSheet.circle, isLast && pathSheet.circleGreen]}>
                  <Text style={pathSheet.stepNumber}>{index + 1}</Text>
                </View>
                {!isLast && <View style={pathSheet.connector} />}
              </View>
              <View style={pathSheet.stepContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <Text style={pathSheet.stepName}>{dept?.name ?? id}</Text>
                  {(hopDetail?.routeType || decision?.routeType) && (
                    <View style={{ backgroundColor: badge.bg, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 9, color: badge.color }}>{badge.label}</Text>
                    </View>
                  )}
                </View>
                <Text style={pathSheet.stepMeta}>
                  {dept?.subnet ?? '—'} · VLAN {dept?.vlanId ?? '—'}
                </Text>
                {/* Routing decision detail */}
                {decision && (
                  <View style={pathSheet.decisionBox}>
                    {decision.aclVerdict ? (
                      <Text style={[pathSheet.decisionText, { color: decision.aclVerdict === 'permit' ? Colors.success : Colors.error }]}>
                        ACL seq {decision.aclRuleSeq ?? '?'}: {decision.aclVerdict.toUpperCase()}
                        {decision.aclVerdict === 'deny' ? ' — packet blocked' : ' — forwarding allowed'}
                      </Text>
                    ) : decision.nextHop === 'Default Gateway' ? (
                      <Text style={pathSheet.decisionText}>
                        Forwarded via default gateway · VLAN {decision.vlanId ?? '—'}
                      </Text>
                    ) : (
                      <Text style={pathSheet.decisionText}>
                        LPM match: {decision.matchedPrefix} (/{decision.prefixLength})
                        {decision.nextHop !== 'DIRECT' && ` → via ${decision.nextHop}`}
                      </Text>
                    )}
                    {hopDetail?.egressPortName && (
                      <Text style={pathSheet.decisionPort}>Egress: {hopDetail.egressPortName}</Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          )
        })}
      </ScrollView>

      <Pressable onPress={onClose} style={pathSheet.clearButton}>
        <Text style={pathSheet.clearText}>× Clear selection</Text>
      </Pressable>
    </BottomSheet>
  )
}

import type { DeviceType, InterfacePort, StaticRoute, OspfConfig, AclRule } from '@/types'

function initializeDefaultPorts(type: DeviceType, existingPorts?: InterfacePort[]): InterfacePort[] {
  if (existingPorts && existingPorts.length > 0) return existingPorts;

  switch (type) {
    case 'switch':
      return Array.from({ length: 8 }, (_, i) => ({
        id: `sw_port_${i + 1}`,
        name: `FastEthernet0/${i + 1}`,
        vlanMode: 'access',
        vlanAccessId: 10,
      }))
    case 'router':
      return Array.from({ length: 4 }, (_, i) => ({
        id: `rt_port_${i}`,
        name: `GigabitEthernet0/${i}`,
        ipAddress: `10.0.${i}.1/24`,
      }))
    case 'firewall':
      return [
        { id: 'fw_inside', name: 'inside', ipAddress: '10.0.1.1/24' },
        { id: 'fw_outside', name: 'outside', ipAddress: '203.0.113.1/24' },
      ]
    default:
      return []
  }
}

// ─── Quick Add / Edit Node Sheet ────────────────────────────────────────────
//
// Structure (progressive disclosure):
//   Section 1 – Essentials : Name (auto-focus) + DeviceTypePicker
//   Section 2 – Connections: Peer chip grid
//   Section 3 – Advanced ▾ : collapsed accordion
//     • department  → Device count stepper
//     • router      → OSPF config + Static routes
//     • switch      → Port VLAN assignments
//     • firewall    → ACL rules
//     • all w/peers → Port wiring cards
//
function DeptSheet({
  visible,
  onClose,
  onSave,
  dept,
  otherDepts,
}: {
  visible: boolean
  onClose: () => void
  onSave: (dept: Department) => void
  dept: Department | null
  otherDepts: Department[]
}) {
  const [name, setName] = useState('')
  const [deviceCount, setDeviceCount] = useState(1)
  const [peers, setPeers] = useState<string[]>([])
  const [nameError, setNameError] = useState('')
  const [deviceCountError, setDeviceCountError] = useState('')

  const [type, setType] = useState<DeviceType>('department')
  const [ports, setPorts] = useState<InterfacePort[]>([])
  const [staticRoutes, setStaticRoutes] = useState<StaticRoute[]>([])
  const [ospfEnabled, setOspfEnabled] = useState(false)
  const [ospfAreaId, setOspfAreaId] = useState(0)
  const [switchPorts, setSwitchPorts] = useState<InterfacePort[]>([])
  const [aclRules, setAclRules] = useState<AclRule[]>([])

  // Accordion state
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const canSave = name.trim().length > 0

  useEffect(() => {
    if (visible) {
      setName(dept?.name ?? '')
      setDeviceCount(dept?.deviceCount ?? 1)
      setPeers(dept?.peers ?? [])
      setNameError('')
      setDeviceCountError('')
      setAdvancedOpen(false)

      const resolvedType = dept?.type ?? 'department'
      setType(resolvedType)
      setPorts(dept?.ports ?? [])
      setStaticRoutes(dept?.staticRoutes ?? [])
      setOspfEnabled(dept?.ospf?.enabled ?? false)
      setOspfAreaId(dept?.ospf?.areaId ?? 0)

      if (resolvedType === 'switch') {
        setSwitchPorts(dept?.ports ?? initializeDefaultPorts('switch'))
      } else {
        setSwitchPorts([])
      }
      setAclRules(dept?.aclRules ?? [])
    }
  }, [visible, dept])

  const togglePeer = (peerId: string) => {
    setPeers((prev) => {
      const exists = prev.includes(peerId)
      if (exists) {
        setPorts((p) => p.filter((item) => item.connectedToNodeId !== peerId))
        return prev.filter((p) => p !== peerId)
      } else {
        const newPort: InterfacePort = {
          id: uuidv4(),
          name: type === 'switch' ? 'FastEthernet0/1' : 'GigabitEthernet0/0',
          connectedToNodeId: peerId,
        }
        setPorts((p) => [...p, newPort])
        return [...prev, peerId]
      }
    })
  }

  const handleSave = () => {
    setNameError('')
    setDeviceCountError('')

    const finalPorts = type === 'switch' ? switchPorts : ports

    const finalDept: Department = {
      id: dept?.id ?? generateId(),
      name: name.trim(),
      deviceCount,
      peers,
      type,
      ports: finalPorts.length > 0 ? finalPorts : initializeDefaultPorts(type),
      ospf: type === 'router' ? { enabled: ospfEnabled, areaId: ospfAreaId } : undefined,
      staticRoutes: type === 'router' ? staticRoutes : undefined,
      aclRules: type === 'firewall' ? aclRules : undefined,
    }

    const validationResult = DepartmentSchema.safeParse(finalDept)
    if (!validationResult.success) {
      const formatted = validationResult.error.format()
      if (formatted.name) setNameError(formatted.name._errors.join(', '))
      if (formatted.deviceCount) setDeviceCountError(formatted.deviceCount._errors.join(', '))
      return
    }

    onSave(validationResult.data as Department)
    onClose()
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>

      {/* ── Header (always visible, never scrolled away) ── */}
      <View style={deptSheet.headerRow}>
        <Text style={deptSheet.title}>
          {dept ? 'Edit Node' : 'Add Node'}
        </Text>
        {dept && (
          <View style={deptSheet.editBadge}>
            <Text style={deptSheet.editBadgeText}>EDITING</Text>
          </View>
        )}
      </View>

      {/* ── Name field — outside ScrollView, always rendered ── */}
      <View style={[deptSheet.field, { marginBottom: 4 }]}>
        <Input
          label="Node Name"
          placeholder="e.g. Core-Router or Finance-LAN"
          value={name}
          onChangeText={setName}
          error={nameError}
        />
      </View>

      {/* ── Scrollable body — maxHeight so it renders in auto-height sheet ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 8 }}
        style={{ maxHeight: Dimensions.get('window').height * 0.48 }}
      >
        {/* Device type picker */}
        <View style={[deptSheet.section, { paddingTop: 4 }]}>
          <Text style={deptSheet.sectionLabel}>ESSENTIALS</Text>
          <View style={deptSheet.field}>
            <Text style={deptSheet.label}>Device Type</Text>
            <DeviceTypePicker
              value={type}
              onChange={(t) => {
                setType(t)
                if (t === 'switch' && switchPorts.length === 0) {
                  setSwitchPorts(initializeDefaultPorts('switch'))
                }
              }}
            />
          </View>
        </View>

        <View style={deptSheet.sectionDivider} />

        {/* ── Section 2: Connections ── */}
        <View style={deptSheet.section}>
          <Text style={deptSheet.sectionLabel}>CONNECTIONS</Text>
          {otherDepts.length === 0 ? (
            <Text style={deptSheet.noPeers}>Add more nodes to define links.</Text>
          ) : (
            <View style={deptSheet.chipRow}>
              {otherDepts.map((d) => (
                <PeerChip
                  key={d.id}
                  label={d.name}
                  selected={peers.includes(d.id)}
                  onPress={() => togglePeer(d.id)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={deptSheet.sectionDivider} />

        {/* ── Section 3: Advanced (accordion) ── */}
        <Pressable
          style={deptSheet.accordionHeader}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
            setAdvancedOpen((v) => !v)
          }}
        >
          <SlidersHorizontal size={16} color={Colors.textMuted} />
          <Text style={[deptSheet.label, { flex: 1, marginBottom: 0 }]}>Advanced Settings</Text>
          {advancedOpen
            ? <CaretUp size={16} color={Colors.textMuted} />
            : <CaretDown size={16} color={Colors.textMuted} />}
        </Pressable>

        {advancedOpen && (
          <View style={{ paddingBottom: 8 }}>

            {/* Department: device count */}
            {type === 'department' && (
              <View style={deptSheet.field}>
                <Text style={deptSheet.label}>Number of End Devices</Text>
                <StepperInput value={deviceCount} onChange={setDeviceCount} min={1} />
                {deviceCountError ? (
                  <Text style={deptSheet.errorText}>{deviceCountError}</Text>
                ) : null}
              </View>
            )}

            {/* Router: OSPF + Static Routes */}
            {type === 'router' && (
              <View style={{ gap: 12 }}>
                {/* OSPF */}
                <View style={deptSheet.advancedCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={deptSheet.advancedCardTitle}>OSPF Area 0</Text>
                    <Pressable
                      style={[deptSheet.toggleBtn, ospfEnabled && deptSheet.toggleBtnOn]}
                      onPress={() => setOspfEnabled(!ospfEnabled)}
                    >
                      <Text style={[deptSheet.toggleBtnText, ospfEnabled && deptSheet.toggleBtnTextOn]}>
                        {ospfEnabled ? 'OSPF ON' : 'Disabled'}
                      </Text>
                    </Pressable>
                  </View>
                  {ospfEnabled && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <Text style={deptSheet.sublabel}>Area ID:</Text>
                      <TextInput
                        style={deptSheet.compactInput}
                        value={String(ospfAreaId)}
                        keyboardType="numeric"
                        onChangeText={(v) => setOspfAreaId(parseInt(v, 10) || 0)}
                      />
                    </View>
                  )}
                </View>

                {/* Static Routes */}
                <View style={deptSheet.field}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={deptSheet.label}>Static Routes</Text>
                    <Pressable onPress={() => setStaticRoutes([...staticRoutes, { destination: '10.0.1.0/24', nextHop: '10.0.0.2' }])}>
                      <Text style={deptSheet.addRowText}>+ Add Route</Text>
                    </Pressable>
                  </View>
                  {staticRoutes.length === 0 && (
                    <Text style={deptSheet.emptyAdvanced}>No static routes defined.</Text>
                  )}
                  {staticRoutes.map((r, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                      <TextInput
                        style={[deptSheet.tableInput, { flex: 1 }]}
                        placeholder="Subnet CIDR"
                        value={r.destination}
                        onChangeText={(text) => {
                          const updated = [...staticRoutes]
                          updated[idx] = { ...updated[idx], destination: text }
                          setStaticRoutes(updated)
                        }}
                      />
                      <TextInput
                        style={[deptSheet.tableInput, { flex: 1 }]}
                        placeholder="Next Hop IP"
                        value={r.nextHop}
                        onChangeText={(text) => {
                          const updated = [...staticRoutes]
                          updated[idx] = { ...updated[idx], nextHop: text }
                          setStaticRoutes(updated)
                        }}
                      />
                      <Pressable onPress={() => setStaticRoutes(staticRoutes.filter((_, i) => i !== idx))}>
                        <Text style={deptSheet.removeText}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Switch: VLAN port table */}
            {type === 'switch' && (
              <View style={deptSheet.field}>
                <Text style={deptSheet.label}>Port VLAN Assignments</Text>
                {switchPorts.map((port, idx) => (
                  <View key={port.id} style={deptSheet.portRow}>
                    <Text style={deptSheet.portName}>{port.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={deptSheet.sublabel}>VLAN</Text>
                      <TextInput
                        style={deptSheet.compactInput}
                        value={String(port.vlanAccessId ?? 10)}
                        keyboardType="numeric"
                        onChangeText={(text) => {
                          const updated = [...switchPorts]
                          updated[idx] = { ...updated[idx], vlanAccessId: parseInt(text, 10) || 10 }
                          setSwitchPorts(updated)
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Firewall: ACL Rules */}
            {type === 'firewall' && (
              <View style={deptSheet.field}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={deptSheet.label}>ACL Rules</Text>
                  <Pressable onPress={() => setAclRules([...aclRules, {
                    id: uuidv4(), sequence: (aclRules.length + 1) * 10,
                    action: 'permit', protocol: 'ip', srcCidr: 'any', dstCidr: 'any',
                  }])}>
                    <Text style={deptSheet.addRowText}>+ Add Rule</Text>
                  </Pressable>
                </View>
                {aclRules.length === 0 && (
                  <Text style={deptSheet.emptyAdvanced}>No ACL rules defined. All traffic is implicitly denied.</Text>
                )}
                {aclRules.map((rule, idx) => (
                  <View
                    key={rule.id}
                    style={[deptSheet.aclCard, {
                      borderColor: rule.action === 'permit' ? Colors.success + '40' : Colors.error + '40',
                      backgroundColor: rule.action === 'permit' ? Colors.success + '08' : Colors.error + '08',
                    }]}
                  >
                    {/* Row 1: seq + action toggle + protocol chips + delete */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Text style={deptSheet.aclSeq}>#{rule.sequence}</Text>
                      <Pressable
                        style={[deptSheet.aclAction, { backgroundColor: rule.action === 'permit' ? Colors.success : Colors.error }]}
                        onPress={() => {
                          const updated = [...aclRules]
                          updated[idx] = { ...rule, action: rule.action === 'permit' ? 'deny' : 'permit' }
                          setAclRules(updated)
                        }}
                      >
                        <Text style={deptSheet.aclActionText}>{rule.action.toUpperCase()}</Text>
                      </Pressable>
                      {(['ip', 'tcp', 'udp', 'icmp'] as const).map((proto) => (
                        <Pressable
                          key={proto}
                          style={[deptSheet.aclProto, rule.protocol === proto && deptSheet.aclProtoActive]}
                          onPress={() => {
                            const updated = [...aclRules]
                            updated[idx] = { ...rule, protocol: proto }
                            setAclRules(updated)
                          }}
                        >
                          <Text style={[deptSheet.aclProtoText, rule.protocol === proto && deptSheet.aclProtoTextActive]}>
                            {proto.toUpperCase()}
                          </Text>
                        </Pressable>
                      ))}
                      <Pressable style={{ marginLeft: 'auto' }} onPress={() => setAclRules(aclRules.filter((_, i) => i !== idx))}>
                        <Text style={deptSheet.removeText}>×</Text>
                      </Pressable>
                    </View>
                    {/* Row 2: CIDRs */}
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TextInput
                        style={[deptSheet.tableInput, { flex: 1 }]}
                        placeholder="Src CIDR"
                        value={rule.srcCidr}
                        onChangeText={(text) => {
                          const updated = [...aclRules]; updated[idx] = { ...rule, srcCidr: text }; setAclRules(updated)
                        }}
                      />
                      <TextInput
                        style={[deptSheet.tableInput, { flex: 1 }]}
                        placeholder="Dst CIDR"
                        value={rule.dstCidr}
                        onChangeText={(text) => {
                          const updated = [...aclRules]; updated[idx] = { ...rule, dstCidr: text }; setAclRules(updated)
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Port Wiring (all types when peers selected) */}
            {peers.length > 0 && type !== 'switch' && (
              <View style={[deptSheet.field, { marginTop: 4 }]}>
                <Text style={deptSheet.label}>Port Wiring</Text>
                <Text style={[deptSheet.sublabel, { marginBottom: 10 }]}>
                  Assign a local interface to each connected peer.
                </Text>
                {peers.map((peerId) => {
                  const peerNode = otherDepts.find((d) => d.id === peerId)
                  if (!peerNode) return null

                  const currentPort = ports.find((p) => p.connectedToNodeId === peerId)
                  const portName = currentPort?.name ?? ''
                  const portIp = currentPort?.ipAddress ?? ''

                  const presetNames =
                    type === 'router'   ? ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2'] :
                    type === 'firewall' ? ['inside', 'outside', 'dmz'] :
                                         ['GigabitEthernet0/0', 'FastEthernet0/1']

                  const updatePortField = (field: 'name' | 'ipAddress', value: string) => {
                    setPorts((prev) => {
                      const existing = prev.find((p) => p.connectedToNodeId === peerId)
                      if (existing) {
                        return prev.map((p) => p.connectedToNodeId === peerId ? { ...p, [field]: value } : p)
                      }
                      return [...prev, { id: uuidv4(), name: field === 'name' ? value : 'GigabitEthernet0/0', ipAddress: field === 'ipAddress' ? value : undefined, connectedToNodeId: peerId }]
                    })
                  }

                  return (
                    <View key={peerId} style={deptSheet.portWiringCard}>
                      <View style={deptSheet.portWiringHeader}>
                        <View style={{ flex: 1, height: 1.5, backgroundColor: Colors.primary + '50', borderRadius: 1 }} />
                        <Text style={deptSheet.portWiringPeerName}>{peerNode.name}</Text>
                        <View style={{ flex: 1, height: 1.5, backgroundColor: Colors.primary + '50', borderRadius: 1 }} />
                      </View>

                      <Text style={[deptSheet.sublabel, { marginBottom: 6 }]}>Interface Port</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {presetNames.map((preset) => (
                          <Pressable
                            key={preset}
                            onPress={() => updatePortField('name', preset)}
                            style={[deptSheet.presetChip, portName === preset && deptSheet.presetChipActive]}
                          >
                            <Text style={[deptSheet.presetChipText, portName === preset && deptSheet.presetChipTextActive]}>
                              {preset.replace('GigabitEthernet', 'Gi').replace('FastEthernet', 'Fa')}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <TextInput
                        style={[deptSheet.tableInput, { marginBottom: (type === 'router' || type === 'firewall') ? 8 : 0 }]}
                        placeholder="Custom interface name…"
                        value={portName}
                        onChangeText={(v) => updatePortField('name', v)}
                      />

                      {(type === 'router' || type === 'firewall') && (
                        <>
                          <Text style={[deptSheet.sublabel, { marginBottom: 4 }]}>Interface IP (CIDR)</Text>
                          <TextInput
                            style={deptSheet.tableInput}
                            placeholder="e.g. 10.0.0.1/30"
                            value={portIp}
                            autoCapitalize="none"
                            onChangeText={(v) => updatePortField('ipAddress', v)}
                          />
                        </>
                      )}
                    </View>
                  )
                })}
              </View>
            )}

          </View>
        )}

        <View style={{ height: 8 }} />
      </ScrollView>

      {/* ── Action buttons ── */}
      <View style={deptSheet.buttons}>
        <Pressable
          style={[deptSheet.saveBtn, !canSave && deptSheet.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={[deptSheet.saveBtnText, !canSave && deptSheet.saveBtnTextDisabled]}>
            {dept ? 'Save Changes' : 'Add Node'}
          </Text>
        </Pressable>
        <Pressable style={deptSheet.cancelBtn} onPress={onClose}>
          <Text style={deptSheet.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </BottomSheet>
  )
}

export default function ConfigDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { activeConfig, setActiveConfig, updateConfig, addDepartment, updateDepartment, deleteDepartment } =
    useConfigStore()
  const departments = activeConfig?.departments ?? []
  const isSample = activeConfig?.id.startsWith('local_tpl_') ?? false

  const [activeTab, setActiveTab] = useState<'departments' | 'subnets' | 'graph'>('departments')

  // ── Animation shared values ───────────────────────────────────────────────
  const segmentContainerWidth = useSharedValue(0)
  const indicatorX = useSharedValue(0)
  const fabScale = useSharedValue(0)

  // Segment indicator slide
  useEffect(() => {
    const idx = activeTab === 'departments' ? 0 : activeTab === 'subnets' ? 1 : 2
    const segW = segmentContainerWidth.value / 3
    indicatorX.value = withTiming(idx * segW, { duration: 200 })
  }, [activeTab])

  // FAB entrance on mount
  useEffect(() => {
    fabScale.value = withSpring(1, { damping: 22, stiffness: 200 })
  }, [])

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: segmentContainerWidth.value > 0 ? segmentContainerWidth.value / 3 : '33.33%' as any,
  }))

  const fabAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }))
  const [editedName, setEditedName] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [nameInputFocused, setNameInputFocused] = useState(false)
  const [search, setSearch] = useState('')
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirmDeptId, setDeleteConfirmDeptId] = useState<string | null>(null)

  // Path result sheet state
  const [showPathSheet, setShowPathSheet] = useState(false)
  const [pathResult, setPathResult] = useState<PathResult | null>(null)
  const [showConflictSheet, setShowConflictSheet] = useState(false)

  // Algorithm visualization
  const [showVizSelector, setShowVizSelector] = useState(false)
  const { startVisualization } = useVisualizationStore()
  // Node positions for A* (empty map \u2014 A* degenerates gracefully without positions)
  const nodePositions = new Map<string, { x: number; y: number }>()

  useEffect(() => {
    if (id) setActiveConfig(id)
  }, [id])

  useEffect(() => {
    if (activeConfig) setEditedName(activeConfig.name)
  }, [activeConfig?.id])

  const handleNameChange = (text: string) => {
    setEditedName(text)
    setIsDirty(text !== activeConfig?.name)
  }

  const handleSave = () => {
    if (!activeConfig || !isDirty) return
    updateConfig({ ...activeConfig, name: editedName })
    setIsDirty(false)
  }

  const handleAddDept = async (dept: Department) => {
    await addDepartment(dept)
  }

  const handleUpdateDept = async (dept: Department) => {
    await updateDepartment(dept)
  }

  const handleDeleteDept = async (deptId: string) => {
    setDeletingId(deptId)
    await deleteDepartment(deptId)
    setDeletingId(null)
  }

  const handlePathFound = useCallback(
    (result: PathResult | null, nodeIds: string[]) => {
      if (result && nodeIds.length === 2) {
        setPathResult(result)
        setShowPathSheet(true)
      } else {
        setShowPathSheet(false)
        setPathResult(null)
      }
    },
    []
  )

  const handleVisualize = useCallback(
    (config: {
      algorithm: AlgorithmType
      sourceId?: string
      targetId?: string
      rootId?: string
      showSteps?: boolean
    }) => {
      const depts = departments
      switch (config.algorithm) {
        case 'dijkstra': {
          const res = buildDijkstraSteps(
            depts,
            config.sourceId ?? depts[0]?.id ?? '',
            config.targetId ?? depts[depts.length - 1]?.id ?? ''
          )
          startVisualization('dijkstra', res.steps, {
            sourceId: config.sourceId,
            targetId: config.targetId,
            dijkstraVisited: res.visitedNodeIds,
            showSteps: config.showSteps,
          })
          break
        }
        case 'aStar': {
          const res = buildAStarSteps(
            depts,
            config.sourceId ?? depts[0]?.id ?? '',
            config.targetId ?? depts[depts.length - 1]?.id ?? '',
            nodePositions
          )
          startVisualization('aStar', res.steps, {
            sourceId: config.sourceId,
            targetId: config.targetId,
            astarVisited: res.visitedNodeIds,
            showSteps: config.showSteps,
          })
          break
        }
        case 'cycleDetection': {
          const res = buildCycleDetectionSteps(depts)
          startVisualization('cycleDetection', res.steps, {
            showSteps: config.showSteps,
          })
          break
        }
        case 'topologicalSort': {
          const res = buildTopologicalSortSteps(depts)
          startVisualization('topologicalSort', res.steps, {
            showSteps: config.showSteps,
          })
          break
        }
        case 'prims': {
          const rootId = config.rootId ?? depts[0]?.id ?? ''
          const res = buildPrimsSteps(depts, rootId)
          startVisualization('prims', res.steps, {
            rootId,
            showSteps: config.showSteps,
          })
          break
        }
        case 'pathfindingComparison': {
          const srcId = config.sourceId ?? depts[0]?.id ?? ''
          const dstId = config.targetId ?? depts[depts.length - 1]?.id ?? ''

          // Run Dijkstra (pure algorithm, not the visualizer steps)
          const dijkstraResult = findShortestPath(depts, srcId, dstId)

          // Run A* (needs node positions from canvas)
          const astarResult = findShortestPathAStar(depts, srcId, dstId, nodePositions)

          // Count nodes visited: run the step builders to get visited sets
          const dijkstraStepRes = buildDijkstraSteps(depts, srcId, dstId)
          const astarStepRes = buildAStarSteps(depts, srcId, dstId, nodePositions)

          const comparison: ComparisonResult = {
            sourceId: srcId,
            targetId: dstId,
            dijkstra: dijkstraResult
              ? { path: dijkstraResult.path, hops: dijkstraResult.hops, nodesVisited: dijkstraStepRes.visitedNodeIds.size }
              : null,
            aStar: astarResult
              ? { path: astarResult.path, hops: astarResult.hops, nodesVisited: astarStepRes.visitedNodeIds.size }
              : null,
          }

          // Store comparison result, then trigger a minimal Dijkstra visualization
          // so the panel has valid steps/state to render against.
          startVisualization('pathfindingComparison', dijkstraStepRes.steps, {
            sourceId: srcId,
            targetId: dstId,
            dijkstraVisited: dijkstraStepRes.visitedNodeIds,
            astarVisited: astarStepRes.visitedNodeIds,
            comparisonResult: comparison,
            showSteps: false, // comparison is a static card, not a step-by-step
          })
          break
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [departments, startVisualization]
  )

  const validation = useValidation(departments)
  const allPass =
    validation.cycleCheck.passed &&
    validation.allocationCheck.passed &&
    validation.connectivityCheck.passed &&
    validation.vlanCheck.passed

  if (!activeConfig) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading configuration…</Text>
        </View>
      </SafeAreaView>
    )
  }

  const otherDepts = editingDept
    ? departments.filter((d) => d.id !== editingDept.id)
    : departments

  const filteredDepts = departments.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        {/* Breadcrumb row */}
        <View style={styles.breadcrumbRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.breadcrumbLink}>My Configs</Text>
          </Pressable>
          <Text style={styles.breadcrumb}>{' › '}{editedName}</Text>
        </View>

        {/* Title row */}
        <View style={styles.titleRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={22} color={Colors.primary} />
          </Pressable>
          <TextInput
            style={[
              styles.titleInput,
              nameInputFocused && styles.titleInputFocused,
            ]}
            value={editedName}
            onChangeText={handleNameChange}
            onBlur={() => {
              setNameInputFocused(false)
              handleSave()
            }}
            onFocus={() => setNameInputFocused(true)}
            selectTextOnFocus
          />
          <Pressable
            onPress={handleSave}
            disabled={!isDirty}
            style={[styles.saveButton, !isDirty && styles.saveButtonDisabled]}
          >
            <Text style={[styles.saveText, !isDirty && styles.saveTextDisabled]}>Save</Text>
          </Pressable>
        </View>
      </View>

      {/* Sample topology banner */}
      {isSample && (
        <View style={styles.sampleBanner}>
          <Info size={13} color={Colors.textMuted} />
          <Text style={styles.sampleBannerText}>Sample topology — view only, changes won't be saved</Text>
        </View>
      )}

      {/* Segmented control with animated sliding indicator */}
      <View
        style={styles.segmented}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width - 8 // subtract padding
          if (segmentContainerWidth.value !== w) {
            segmentContainerWidth.value = w
            const idx = activeTab === 'departments' ? 0 : activeTab === 'subnets' ? 1 : 2
            indicatorX.value = (w / 3) * idx
          }
        }}
      >
        {/* Sliding pill indicator */}
        <Animated.View style={[styles.segmentIndicator, indicatorStyle]} />

        <Pressable
          style={styles.segment}
          onPress={() => setActiveTab('departments')}
        >
          <Text style={[styles.segmentText, activeTab === 'departments' && styles.segmentTextActive]}>
            Departments
          </Text>
        </Pressable>
        <Pressable
          style={styles.segment}
          onPress={() => setActiveTab('subnets')}
        >
          <Text style={[styles.segmentText, activeTab === 'subnets' && styles.segmentTextActive]}>
            Subnets
          </Text>
        </Pressable>
        <Pressable
          style={styles.segment}
          onPress={() => setActiveTab('graph')}
        >
          <Text style={[styles.segmentText, activeTab === 'graph' && styles.segmentTextActive]}>
            Graph View
          </Text>
        </Pressable>
      </View>

      {/* Departments view */}
      {activeTab === 'departments' && (
        <Animated.View entering={FadeIn.duration(220)} style={styles.deptContainer}>
          {/* Search */}
          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <MagnifyingGlass size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search departments..."
                placeholderTextColor={Colors.textMuted}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <Pressable style={styles.filterButton}>
              <Funnel size={18} color={Colors.textMuted} />
            </Pressable>
          </View>

          <FlatList
            data={filteredDepts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeIn.duration(160)}
                key={item.id}
              >
                <View style={styles.deptCard}>
                  <View style={styles.deptHeader}>
                    <Text style={styles.deptName}>{item.name}</Text>
                    <View style={styles.deptActions}>
                      <Pressable
                        onPress={() => {
                          setEditingDept(item)
                          setShowAddSheet(true)
                        }}
                      >
                        <PencilSimple size={20} color={Colors.textMuted} />
                      </Pressable>
                      <Pressable
                        onPress={() => setDeleteConfirmDeptId(item.id)}
                        disabled={deletingId === item.id}
                      >
                        <Trash size={20} color={Colors.textMuted} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.deptMeta}>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{item.deviceCount} Devices</Text>
                    </View>
                    {item.subnet && (
                      <View style={styles.chip}>
                        <Text style={styles.chipText}>{item.subnet}</Text>
                      </View>
                    )}
                  </View>

                  {item.peers.length > 0 && (
                    <View style={styles.peerChips}>
                      {item.peers.slice(0, 4).map((peerId) => {
                        const peerDept = departments.find((d) => d.id === peerId)
                        if (!peerDept) return null
                        return (
                          <View key={peerId} style={styles.peerBadge}>
                            <Text style={styles.peerBadgeText}>Peer: {peerDept.name}</Text>
                          </View>
                        )
                      })}
                      {item.peers.length > 4 && (
                        <Text style={styles.morePeers}>+{item.peers.length - 4} more</Text>
                      )}
                    </View>
                  )}
                </View>
              </Animated.View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Globe size={48} color={Colors.primary} weight="duotone" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>No departments yet</Text>
                <Text style={styles.emptySubtitle}>
                  Add your first department to start building your network topology.
                </Text>
                <View style={{ marginTop: 12, alignSelf: 'stretch', paddingHorizontal: 24 }}>
                  <Button
                    label="Add Department"
                    variant="primary"
                    fullWidth
                    onPress={() => {
                      setEditingDept(null)
                      setShowAddSheet(true)
                    }}
                  />
                </View>
              </View>
            }
          />

          {/* FAB */}
          <Animated.View style={[styles.fab, fabAnimStyle]}>
          <Pressable
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => {
              setEditingDept(null)
              setShowAddSheet(true)
            }}
          >
            <Plus size={28} color={Colors.white} />
          </Pressable>
          </Animated.View>
        </Animated.View>
      )}

      {/* Subnets view */}
      {activeTab === 'subnets' && (
        <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
        <ScrollView style={styles.subnetContainer} showsVerticalScrollIndicator={true}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.subnetScrollHorizontal}>
            <View style={styles.subnetTable}>
              {/* Header Row */}
              <View style={styles.tableRowHeader}>
                <Text style={[styles.columnHeader, { width: 140 }]}>Department</Text>
                <Text style={[styles.columnHeader, { width: 140 }]}>Subnet CIDR</Text>
                <Text style={[styles.columnHeader, { width: 140 }]}>Network Addr</Text>
                <Text style={[styles.columnHeader, { width: 180 }]}>Usable Range</Text>
                <Text style={[styles.columnHeader, { width: 140 }]}>Broadcast Addr</Text>
                <Text style={[styles.columnHeader, { width: 140 }]}>Subnet Mask</Text>
                <Text style={[styles.columnHeader, { width: 100 }]}>VLAN ID</Text>
                <Text style={[styles.columnHeader, { width: 120 }]}>Usable Hosts</Text>
              </View>

              {/* Body Rows */}
              <View style={styles.tableBodyContainer}>
                {departments.map((item) => {
                  const details = getSubnetDetails(item.subnet)
                  return (
                    <View key={item.id} style={styles.tableRow}>
                      <Text style={[styles.columnCell, styles.columnCellBold, { width: 140 }]} numberOfLines={1} ellipsizeMode="tail">
                        {item.name}
                      </Text>
                      <Text style={[styles.columnCell, { width: 140 }]}>
                        {item.subnet ?? '—'}
                      </Text>
                      <Text style={[styles.columnCell, { width: 140 }]}>
                        {details?.networkAddress ?? '—'}
                      </Text>
                      <Text style={[styles.columnCell, { width: 180 }]} numberOfLines={1} ellipsizeMode="tail">
                        {details?.usableRange ?? '—'}
                      </Text>
                      <Text style={[styles.columnCell, { width: 140 }]}>
                        {details?.broadcastAddress ?? '—'}
                      </Text>
                      <Text style={[styles.columnCell, { width: 140 }]}>
                        {details?.subnetMask ?? '—'}
                      </Text>
                      <Text style={[styles.columnCell, { width: 100 }]}>
                        {item.vlanId !== undefined ? `VLAN ${item.vlanId}` : '—'}
                      </Text>
                      <Text style={[styles.columnCell, { width: 120 }]}>
                        {item.usableHosts !== undefined ? item.usableHosts.toLocaleString() : '—'}
                      </Text>
                    </View>
                  )
                })}
                {departments.length === 0 && (
                  <View style={styles.emptyState}>
                    <ListNumbers size={48} color={Colors.primary} weight="duotone" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyTitle}>No subnets allocated</Text>
                    <Text style={styles.emptySubtitle}>
                      Add departments to automatically compute subnets.
                    </Text>
                    <View style={{ marginTop: 12, width: 180 }}>
                      <Button
                        label="Add Department"
                        variant="primary"
                        onPress={() => {
                          setEditingDept(null)
                          setShowAddSheet(true)
                        }}
                      />
                    </View>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </ScrollView>
        </Animated.View>
      )}

      {/* Graph view */}
      {activeTab === 'graph' && (
        <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1, position: 'relative' }}>
          <ErrorBoundary inline inlineLabel="Network Graph">
          <NetworkGraph
              departments={departments}
              onPathFound={handlePathFound}
              onVisualize={() => setShowVizSelector(true)}
              onWarningPress={() => setShowConflictSheet(true)}
              validationWarnings={
                [validation.cycleCheck, validation.allocationCheck,
                 validation.connectivityCheck, validation.vlanCheck
                ].filter(c => !c.passed).length
              }
              validationPassed={allPass}
              validationResult={validation}
            />
          </ErrorBoundary>

          {/* Slim validation pill — brief, non-intrusive */}
          {!allPass && (
            <Pressable
              style={styles.validationPill}
              onPress={() => setShowConflictSheet(true)}
            >
              <Warning size={13} color={Colors.error} weight="fill" />
              <Text style={styles.validationPillText}>
                {[validation.cycleCheck, validation.allocationCheck,
                  validation.connectivityCheck, validation.vlanCheck
                ].filter(c => !c.passed).length} issue
                {[validation.cycleCheck, validation.allocationCheck,
                  validation.connectivityCheck, validation.vlanCheck
                ].filter(c => !c.passed).length !== 1 ? 's' : ''} detected
              </Text>
              <Text style={styles.validationPillCta}>Details</Text>
            </Pressable>
          )}
        </Animated.View>
      )}

      {/* Add/Edit dept sheet */}
      <DeptSheet
        visible={showAddSheet}
        onClose={() => {
          setShowAddSheet(false)
          setEditingDept(null)
        }}
        onSave={editingDept ? handleUpdateDept : handleAddDept}
        dept={editingDept}
        otherDepts={otherDepts}
      />

      {/* Path result sheet */}
      <PathResultSheet
        visible={showPathSheet}
        onClose={() => {
          setShowPathSheet(false)
          setPathResult(null)
        }}
        result={pathResult}
        departments={departments}
        onReplay={() => {
          // Open step-by-step Dijkstra replay for the same nodes
          if (pathResult && pathResult.path.length >= 2) {
            const srcId = pathResult.path[0]
            const tgtId = pathResult.path[pathResult.path.length - 1]
            const steps = buildDijkstraSteps(departments, srcId, tgtId)
            startVisualization('dijkstra', steps.steps, {
              sourceId: srcId,
              targetId: tgtId,
              dijkstraVisited: steps.visitedNodeIds,
              showSteps: true,
            })
            setShowPathSheet(false)
          }
        }}
      />

      <BottomSheet
        visible={showConflictSheet}
        onClose={() => setShowConflictSheet(false)}
        snapHeight={520}
      >
        <Text style={styles.sheetTitle}>Topology Issues Detected</Text>
        <Text style={styles.sheetSubtitle}>
          The following issues make this network invalid. Tap each card for details and how to fix it.
        </Text>
        <ScrollView style={styles.conflictList} showsVerticalScrollIndicator={false}>
          {!validation.cycleCheck.passed && (
            <View style={styles.conflictItem}>
              <View style={styles.conflictTitleRow}>
                <Warning size={16} color={Colors.warning} weight="fill" />
                <Text style={styles.conflictHeader}>Routing Loop Detected</Text>
                <Pressable onPress={() => Alert.alert('Why Routing Loops are Bad', 'Routing loops cause broadcast storms and severe network instability. Packets get trapped endlessly cycling between nodes, eventually bringing the entire network down.')} hitSlop={8} style={styles.questionIcon}>
                  <Question size={16} color={Colors.textMuted} weight="fill" />
                </Pressable>
              </View>
              <Text style={styles.conflictMessage}>{validation.cycleCheck.message}</Text>
              <View style={styles.fixSuggestion}>
                <Text style={styles.fixLabel}>HOW TO FIX</Text>
                <Text style={styles.fixText}>Go to the Departments tab and remove the circular peer link that connects back to a parent node. A routing loop means Device A links to Device B, and Device B links back to Device A through the same path. Use a switch or firewall as an intermediate node to break the cycle.</Text>
              </View>
            </View>
          )}

          {!validation.allocationCheck.passed && (
            <View style={styles.conflictItem}>
              <View style={styles.conflictTitleRow}>
                <WarningCircle size={16} color={Colors.error} weight="fill" />
                <Text style={styles.conflictHeader}>Subnet Overlap / Error</Text>
                <Pressable onPress={() => Alert.alert('Why IP Overlap is Bad', 'IP overlapping happens when multiple devices are assigned the same IP address or subnet range. This causes intermittent connectivity drops, ARP conflicts, and routing failures.')} hitSlop={8} style={styles.questionIcon}>
                  <Question size={16} color={Colors.textMuted} weight="fill" />
                </Pressable>
              </View>
              <Text style={styles.conflictMessage}>{validation.allocationCheck.message}</Text>
              <View style={styles.fixSuggestion}>
                <Text style={styles.fixLabel}>HOW TO FIX</Text>
                <Text style={styles.fixText}>In the Subnets tab, change the Base IP or the CIDR prefix of overlapping departments. Each department must have a unique, non-overlapping subnet range. Try increasing the CIDR prefix (e.g., /24 → /26) or using a different address block.</Text>
              </View>
            </View>
          )}

          {!validation.connectivityCheck.passed && (
            <View style={styles.conflictItem}>
              <View style={styles.conflictTitleRow}>
                <Link size={16} color={Colors.textSecondary} weight="fill" />
                <Text style={styles.conflictHeader}>Connectivity Isolation</Text>
                <Pressable onPress={() => Alert.alert('Why Connectivity Fails', 'If a node is unreachable, there is no physical or logical path from the core to that department. Traffic will be blackholed — sent but never delivered.')} hitSlop={8} style={styles.questionIcon}>
                  <Question size={16} color={Colors.textMuted} weight="fill" />
                </Pressable>
              </View>
              <Text style={styles.conflictMessage}>{validation.connectivityCheck.message}</Text>
              <View style={styles.fixSuggestion}>
                <Text style={styles.fixLabel}>HOW TO FIX</Text>
                <Text style={styles.fixText}>Open the isolated department and add a peer connection to a router or switch that is already part of the main topology. Every department must have at least one connected peer with a reachable path to the core network.</Text>
              </View>
            </View>
          )}

          {!validation.vlanCheck.passed && (
            <View style={styles.conflictItem}>
              <View style={styles.conflictTitleRow}>
                <Tag size={16} color={Colors.primary} weight="fill" />
                <Text style={styles.conflictHeader}>VLAN Tag Collision</Text>
                <Pressable onPress={() => Alert.alert('Why Invalid VLANs are Bad', 'VLAN inconsistencies lead to dropped traffic. Devices may be physically connected but logically isolated, causing hard-to-diagnose connectivity issues.')} hitSlop={8} style={styles.questionIcon}>
                  <Question size={16} color={Colors.textMuted} weight="fill" />
                </Pressable>
              </View>
              <Text style={styles.conflictMessage}>{validation.vlanCheck.message}</Text>
              <View style={styles.fixSuggestion}>
                <Text style={styles.fixLabel}>HOW TO FIX</Text>
                <Text style={styles.fixText}>In the department editor, ensure each department is assigned a unique VLAN ID. Go to the port wiring section of your switch and verify that trunk ports allow the correct VLAN IDs and access ports use only one VLAN.</Text>
              </View>
            </View>
          )}
        </ScrollView>
        <View style={styles.sheetButtons}>
          <Button
            label="Close"
            variant="primary"
            fullWidth
            onPress={() => setShowConflictSheet(false)}
          />
        </View>
      </BottomSheet>

      {/* Algorithm Selector Sheet */}
      <AlgorithmSelector
        visible={showVizSelector}
        onClose={() => setShowVizSelector(false)}
        onStart={(config) => {
          setShowVizSelector(false)
          handleVisualize(config)
        }}
        departments={departments}
      />

      {/* Algorithm Visualizer Panel */}
      <AlgorithmVisualizerPanel departments={departments} />

      {/* Delete Department Confirmation Bottom Sheet */}
      <BottomSheet
        visible={deleteConfirmDeptId !== null}
        onClose={() => setDeleteConfirmDeptId(null)}
        snapHeight={250}
      >
        <Text style={styles.sheetTitle}>Delete Department?</Text>
        <Text style={[styles.sheetSubtitle, { marginBottom: 20 }]}>
          This action is permanent. This department and all its connections to peer nodes will be removed from the network topology.
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => setDeleteConfirmDeptId(null)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Delete"
              variant="destructive"
              onPress={async () => {
                if (deleteConfirmDeptId) {
                  const targetId = deleteConfirmDeptId
                  setDeleteConfirmDeptId(null)
                  await handleDeleteDept(targetId)
                }
              }}
            />
          </View>
        </View>
      </BottomSheet>
      
      <SyncConflictSheet />
    </SafeAreaView>

  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surfaceAlt },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: Colors.textMuted },
  sampleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.ice,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sampleBannerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  topBar: {
    flexDirection: 'column',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingLeft: 2,
  },
  breadcrumb: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    flexShrink: 1,
  },
  breadcrumbLink: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: Colors.primary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: { padding: 4 },
  titleInput: {
    flex: 1,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    paddingVertical: 2,
  },
  titleInputFocused: {
    borderBottomColor: Colors.primary,
  },
  saveButton: { paddingHorizontal: 4 },
  saveButtonDisabled: { opacity: 0.3 },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.primary },
  saveTextDisabled: { color: Colors.pale },
  segmented: {
    flexDirection: 'row',
    margin: 12,
    backgroundColor: Colors.ice,
    borderRadius: 12,
    padding: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: Colors.white,
    borderRadius: 9,
    // shadow for pill depth
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  segmentActive: {
    // kept for API compat — visual active state now driven by animated pill
    backgroundColor: 'transparent',
  },
  segmentText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textMuted,
  },
  segmentTextActive: {
    color: Colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  deptContainer: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: 16, gap: 12, paddingBottom: 100 },
  deptCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 10,
  },
  deptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deptName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  deptActions: { flexDirection: 'row', gap: 16 },
  deptMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    backgroundColor: Colors.ice,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  peerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  peerBadge: {
    backgroundColor: Colors.ice,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  peerBadgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.medium,
  },
  morePeers: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    alignSelf: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyIcon: { fontSize: 48 },
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
  },
  validationPill: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${Colors.error}50`,
    paddingVertical: 7,
    paddingHorizontal: 14,
    zIndex: 10,
  },
  validationPillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.error,
    flex: 1,
  },
  validationPillCta: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 0.2,
  },
  sheetTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  sheetSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  conflictList: {
    maxHeight: 220,
    marginBottom: 16,
  },
  conflictItem: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 8,
  },
  conflictTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  questionIcon: {
    marginLeft: 'auto',
  },
  conflictHeader: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  conflictMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  fixSuggestion: {
    marginTop: 10,
    backgroundColor: `${Colors.primary}08`,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  fixLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.6,
  },
  fixText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  sheetButtons: {
    gap: 8,
  },
  subnetContainer: {
    flex: 1,
    padding: 16,
  },
  subnetScrollHorizontal: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subnetTable: {
    flexDirection: 'column',
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.ice,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  columnHeader: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
    textAlign: 'left',
    paddingHorizontal: 4,
  },
  tableBodyContainer: {
    flexDirection: 'column',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  columnCell: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'left',
    paddingHorizontal: 4,
  },
  columnCellBold: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textPrimary,
  },
})

const deptSheet = StyleSheet.create({
  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    color: Colors.textPrimary,
    flex: 1,
  },
  editBadge: {
    backgroundColor: `${Colors.primary}15`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
  },
  editBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 0.4,
  },

  // ── Sections ──
  section: {
    paddingHorizontal: 2,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: -2,
    marginVertical: 4,
  },

  // ── Accordion header ──
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 14,
    paddingHorizontal: 2,
  },

  // ── Fields ──
  field: { marginBottom: 16 },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  sublabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
  },
  errorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },

  // ── Advanced card ──
  advancedCard: {
    backgroundColor: Colors.surfaceAlt,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  advancedCardTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
  },

  // ── Toggle button ──
  toggleBtn: {
    backgroundColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toggleBtnOn: {
    backgroundColor: Colors.successContainer,
  },
  toggleBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
  },
  toggleBtnTextOn: {
    color: Colors.success,
  },

  // ── Compact input (VLAN IDs, OSPF area) ──
  compactInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    borderRadius: 6,
    width: 52,
    height: 28,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },

  // ── Table inputs (routes, ACL CIDRs) ──
  tableInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 34,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textPrimary,
  },

  // ── Add row / remove text ──
  addRowText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
  },
  removeText: {
    color: Colors.error,
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
  emptyAdvanced: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 6,
  },

  // ── Switch port row ──
  portRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: Colors.surfaceAlt,
    padding: 8,
    borderRadius: 8,
  },
  portName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textPrimary,
  },

  // ── ACL rule card ──
  aclCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  aclSeq: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    width: 28,
  },
  aclAction: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aclActionText: {
    color: Colors.white,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  aclProto: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.surfaceAlt,
  },
  aclProtoActive: {
    backgroundColor: Colors.primary,
  },
  aclProtoText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textMuted,
  },
  aclProtoTextActive: {
    color: Colors.white,
  },

  // ── Port wiring ──
  portWiringCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 10,
  },
  portWiringHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  portWiringPeerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  presetChipText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  presetChipTextActive: {
    color: Colors.white,
  },

  // ── Connections section ──
  noPeers: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // ── Action buttons ──
  buttons: {
    gap: 8,
    marginTop: 12,
    alignItems: 'stretch',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.white,
  },
  saveBtnTextDisabled: {
    color: Colors.textMuted,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.textMuted,
  },
})

const pathSheet = StyleSheet.create({
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.medium,
    marginBottom: 20,
  },
  list: { maxHeight: 280 },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 4,
  },
  stepLeft: { alignItems: 'center', width: 28 },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleGreen: { backgroundColor: Colors.success },
  stepNumber: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.white,
  },
  connector: {
    width: 2,
    height: 28,
    backgroundColor: Colors.pale,
    borderStyle: 'dashed',
    marginTop: 2,
  },
  stepContent: { flex: 1, paddingTop: 4, paddingBottom: 12 },
  stepName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  stepMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  clearButton: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
  },
  clearText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.primary,
  },
  decisionBox: {
    marginTop: 5,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderLeftWidth: 2.5,
    borderLeftColor: Colors.primary,
  },
  decisionText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  decisionPort: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 3,
  },
})
