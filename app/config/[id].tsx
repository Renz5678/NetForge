import React, { useEffect, useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  SafeAreaView,
  ScrollView,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  ArrowLeft,
  Plus,
  PencilSimple,
  Trash,
  MagnifyingGlass,
  Funnel,
  CaretRight,
} from 'phosphor-react-native'
import { useConfigStore } from '@/stores/useConfigStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useValidation } from '@/hooks/useValidation'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PeerChip } from '@/components/ui/PeerChip'
import { StepperInput } from '@/components/ui/StepperInput'
import { NetworkGraph } from '@/components/graph/NetworkGraph'
import { Colors } from '@/constants/colors'
import type { Department, PathResult } from '@/types'

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
}: {
  visible: boolean
  onClose: () => void
  result: PathResult | null
  departments: Department[]
}) {
  if (!result) return null

  const getDept = (id: string) => departments.find((d) => d.id === id)

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={400}>
      <Text style={pathSheet.title}>
        Path: {getDept(result.path[0])?.name ?? '?'} → {getDept(result.path[result.path.length - 1])?.name ?? '?'}
      </Text>
      <Text style={pathSheet.subtitle}>{result.hops} {result.hops === 1 ? 'hop' : 'hops'} · Shortest route</Text>

      <ScrollView style={pathSheet.list} showsVerticalScrollIndicator={false}>
        {result.path.map((id, index) => {
          const dept = getDept(id)
          const isLast = index === result.path.length - 1

          return (
            <View key={id} style={pathSheet.step}>
              <View style={pathSheet.stepLeft}>
                <View style={[pathSheet.circle, isLast && pathSheet.circleGreen]}>
                  <Text style={pathSheet.stepNumber}>{index + 1}</Text>
                </View>
                {!isLast && <View style={pathSheet.connector} />}
              </View>
              <View style={pathSheet.stepContent}>
                <Text style={pathSheet.stepName}>{dept?.name ?? id}</Text>
                <Text style={pathSheet.stepMeta}>
                  {dept?.subnet ?? '—'} · VLAN {dept?.vlanId ?? '—'}
                </Text>
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

// Add/Edit department sheet
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

  const [type, setType] = useState<DeviceType>('department')
  const [ports, setPorts] = useState<InterfacePort[]>([])
  const [staticRoutes, setStaticRoutes] = useState<StaticRoute[]>([])
  const [ospfEnabled, setOspfEnabled] = useState(false)
  const [ospfAreaId, setOspfAreaId] = useState(0)
  const [switchPorts, setSwitchPorts] = useState<InterfacePort[]>([])
  const [aclRules, setAclRules] = useState<AclRule[]>([])

  useEffect(() => {
    if (visible) {
      setName(dept?.name ?? '')
      setDeviceCount(dept?.deviceCount ?? 1)
      setPeers(dept?.peers ?? [])
      setNameError('')

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
    if (!name.trim()) {
      setNameError('Device/Department name is required')
      return
    }
    
    // Compile final ports list
    const finalPorts = type === 'switch' ? switchPorts : ports;

    onSave({
      id: dept?.id ?? generateId(),
      name: name.trim(),
      deviceCount,
      peers,
      type,
      ports: finalPorts.length > 0 ? finalPorts : initializeDefaultPorts(type),
      ospf: type === 'router' ? { enabled: ospfEnabled, areaId: ospfAreaId } : undefined,
      staticRoutes: type === 'router' ? staticRoutes : undefined,
      aclRules: type === 'firewall' ? aclRules : undefined,
    })
    onClose()
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
        <Text style={deptSheet.title}>{dept ? 'Edit Node Configuration' : 'Add Node to Network'}</Text>

        <View style={deptSheet.field}>
          <Input
            label="Node Name"
            placeholder="e.g. Core-Router or Finance"
            value={name}
            onChangeText={setName}
            error={nameError}
            autoFocus={!dept}
          />
        </View>

        {/* Device Type Segment Controls */}
        <View style={deptSheet.field}>
          <Text style={deptSheet.label}>Device Category Role</Text>
          <View style={styles.segmented}>
            {(['department', 'router', 'switch', 'firewall'] as const).map((t) => (
              <Pressable
                key={t}
                style={[styles.segment, type === t && styles.segmentActive]}
                onPress={() => {
                  setType(t)
                  if (t === 'switch' && switchPorts.length === 0) {
                    setSwitchPorts(initializeDefaultPorts('switch'))
                  }
                }}
              >
                <Text style={[styles.segmentText, type === t && styles.segmentTextActive, { fontSize: 11 }]}>
                  {t.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {type === 'department' && (
          <View style={deptSheet.field}>
            <Text style={deptSheet.label}>Number of End Devices</Text>
            <StepperInput value={deviceCount} onChange={setDeviceCount} min={1} />
          </View>
        )}

        {/* Router Context Forms */}
        {type === 'router' && (
          <View style={{ marginBottom: 16 }}>
            {/* OSPF Area ID Config */}
            <View style={[deptSheet.field, { backgroundColor: Colors.surfaceAlt, padding: 12, borderRadius: 10 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.textPrimary }}>Dynamic OSPF Area 0</Text>
                <Pressable
                  style={{ backgroundColor: ospfEnabled ? Colors.successContainer : Colors.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
                  onPress={() => setOspfEnabled(!ospfEnabled)}
                >
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: ospfEnabled ? Colors.success : Colors.textMuted }}>
                    {ospfEnabled ? '⚡ OSPF Active' : '✕ Disabled'}
                  </Text>
                </Pressable>
              </View>
              {ospfEnabled && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textSecondary }}>Area ID:</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, borderRadius: 6, width: 44, height: 26, textAlign: 'center', fontSize: 12 }}
                    value={String(ospfAreaId)}
                    keyboardType="numeric"
                    onChangeText={(val) => setOspfAreaId(parseInt(val, 10) || 0)}
                  />
                </View>
              )}
            </View>

            {/* Static Routes configuration */}
            <View style={deptSheet.field}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={deptSheet.label}>Static Forwarding Table</Text>
                <Pressable onPress={() => setStaticRoutes([...staticRoutes, { destination: '10.0.1.0/24', nextHop: '10.0.0.2' }])}>
                  <Text style={{ color: Colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>+ Add Route</Text>
                </Pressable>
              </View>
              {staticRoutes.length === 0 && (
                <Text style={{ fontStyle: 'italic', fontSize: 12, color: Colors.textMuted, textAlign: 'center', paddingVertical: 6 }}>No static routes defined.</Text>
              )}
              {staticRoutes.map((r, idx) => (
                <View key={idx} style={{ flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <TextInput
                    style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, borderRadius: 8, paddingHorizontal: 8, height: 32, fontSize: 11 }}
                    placeholder="Subnet CIDR"
                    value={r.destination}
                    onChangeText={(text) => {
                      const updated = [...staticRoutes]
                      updated[idx].destination = text
                      setStaticRoutes(updated)
                    }}
                  />
                  <TextInput
                    style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, borderRadius: 8, paddingHorizontal: 8, height: 32, fontSize: 11 }}
                    placeholder="Next Hop IP"
                    value={r.nextHop}
                    onChangeText={(text) => {
                      const updated = [...staticRoutes]
                      updated[idx].nextHop = text
                      setStaticRoutes(updated)
                    }}
                  />
                  <Pressable onPress={() => setStaticRoutes(staticRoutes.filter((_, i) => i !== idx))}>
                    <Text style={{ color: Colors.error, fontSize: 18, fontWeight: 'bold', paddingHorizontal: 6 }}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Switch Context Forms */}
        {type === 'switch' && (
          <View style={deptSheet.field}>
            <Text style={deptSheet.label}>Port VLAN Mode Assignments</Text>
            {switchPorts.map((p, idx) => (
              <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, backgroundColor: Colors.surfaceAlt, padding: 8, borderRadius: 8 }}>
                <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.textPrimary }}>{p.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary }}>Access VLAN</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, borderRadius: 6, width: 44, height: 26, textAlign: 'center', fontSize: 12 }}
                    value={String(p.vlanAccessId ?? 10)}
                    keyboardType="numeric"
                    onChangeText={(val) => {
                      const updated = [...switchPorts]
                      updated[idx].vlanAccessId = parseInt(val, 10) || 10
                      setSwitchPorts(updated)
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Firewall ACL Rules */}
        {type === 'firewall' && (
          <View style={deptSheet.field}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={deptSheet.label}>ACL Rules (ordered, first-match)</Text>
              <Pressable
                onPress={() => {
                  const nextSeq = aclRules.length > 0
                    ? Math.max(...aclRules.map((r) => r.sequence)) + 10
                    : 10
                  setAclRules([...aclRules, {
                    id: uuidv4(),
                    sequence: nextSeq,
                    action: 'permit',
                    protocol: 'ip',
                    srcCidr: 'any',
                    dstCidr: 'any',
                    remark: '',
                  }])
                }}
              >
                <Text style={{ color: Colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>+ Add Rule</Text>
              </Pressable>
            </View>

            {aclRules.length === 0 && (
              <Text style={{ fontStyle: 'italic', fontSize: 12, color: Colors.textMuted, textAlign: 'center', paddingVertical: 6 }}>
                No ACL rules — all traffic implicitly denied.
              </Text>
            )}

            {aclRules.map((rule, idx) => (
              <View
                key={rule.id}
                style={{
                  backgroundColor: rule.action === 'permit'
                    ? 'rgba(34,197,94,0.08)'
                    : 'rgba(239,68,68,0.08)',
                  borderWidth: 1,
                  borderColor: rule.action === 'permit' ? Colors.success : Colors.error,
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 8,
                }}
              >
                {/* Row 1: Seq + Action toggle + Protocol + Delete */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: Colors.textMuted, width: 28 }}>#{rule.sequence}</Text>

                  {/* Action toggle */}
                  <Pressable
                    style={{
                      backgroundColor: rule.action === 'permit' ? Colors.success : Colors.error,
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                    }}
                    onPress={() => {
                      const updated = [...aclRules]
                      updated[idx] = { ...rule, action: rule.action === 'permit' ? 'deny' : 'permit' }
                      setAclRules(updated)
                    }}
                  >
                    <Text style={{ color: Colors.white, fontFamily: 'Inter_600SemiBold', fontSize: 11 }}>
                      {rule.action.toUpperCase()}
                    </Text>
                  </Pressable>

                  {/* Protocol picker */}
                  {(['ip', 'tcp', 'udp', 'icmp'] as const).map((proto) => (
                    <Pressable
                      key={proto}
                      style={{
                        paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
                        backgroundColor: rule.protocol === proto ? Colors.primary : Colors.surfaceAlt,
                      }}
                      onPress={() => {
                        const updated = [...aclRules]
                        updated[idx] = { ...rule, protocol: proto }
                        setAclRules(updated)
                      }}
                    >
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_600SemiBold', color: rule.protocol === proto ? Colors.white : Colors.textMuted }}>
                        {proto.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}

                  <Pressable
                    style={{ marginLeft: 'auto' }}
                    onPress={() => setAclRules(aclRules.filter((_, i) => i !== idx))}
                  >
                    <Text style={{ color: Colors.error, fontSize: 18, fontWeight: 'bold' }}>×</Text>
                  </Pressable>
                </View>

                {/* Row 2: Src + Dst CIDRs */}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 2 }}>Source CIDR</Text>
                    <TextInput
                      style={{ borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, borderRadius: 6, paddingHorizontal: 8, height: 30, fontSize: 11 }}
                      placeholder="any or 10.0.1.0/24"
                      value={rule.srcCidr}
                      onChangeText={(text) => {
                        const updated = [...aclRules]
                        updated[idx] = { ...rule, srcCidr: text }
                        setAclRules(updated)
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 2 }}>Dest CIDR</Text>
                    <TextInput
                      style={{ borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, borderRadius: 6, paddingHorizontal: 8, height: 30, fontSize: 11 }}
                      placeholder="any or 10.0.2.0/24"
                      value={rule.dstCidr}
                      onChangeText={(text) => {
                        const updated = [...aclRules]
                        updated[idx] = { ...rule, dstCidr: text }
                        setAclRules(updated)
                      }}
                    />
                  </View>
                  {(rule.protocol === 'tcp' || rule.protocol === 'udp') && (
                    <View style={{ width: 54 }}>
                      <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 2 }}>Port</Text>
                      <TextInput
                        style={{ borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, borderRadius: 6, paddingHorizontal: 8, height: 30, fontSize: 11 }}
                        placeholder="80"
                        keyboardType="numeric"
                        value={rule.dstPort !== undefined ? String(rule.dstPort) : ''}
                        onChangeText={(text) => {
                          const updated = [...aclRules]
                          updated[idx] = { ...rule, dstPort: text ? parseInt(text, 10) : undefined }
                          setAclRules(updated)
                        }}
                      />
                    </View>
                  )}
                </View>

                {/* Row 3: Optional remark */}
                <TextInput
                  style={{ marginTop: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, borderRadius: 6, paddingHorizontal: 8, height: 28, fontSize: 11, color: Colors.textMuted }}
                  placeholder="Remark (optional)"
                  value={rule.remark ?? ''}
                  onChangeText={(text) => {
                    const updated = [...aclRules]
                    updated[idx] = { ...rule, remark: text }
                    setAclRules(updated)
                  }}
                />
              </View>
            ))}
          </View>
        )}

        {/* Peer Connections */}
        <View style={deptSheet.field}>
          <Text style={deptSheet.label}>Can communicate with (Edge Peers)</Text>
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

        {/* Port Mapping Dropdowns (when connected) */}
        {peers.length > 0 && type !== 'switch' && (
          <View style={[deptSheet.field, { marginTop: 8 }]}>
            <Text style={deptSheet.label}>Wiring Port Configuration</Text>
            {peers.map((peerId) => {
              const peerNode = otherDepts.find((d) => d.id === peerId)
              if (!peerNode) return null

              const currentPort = ports.find((p) => p.connectedToNodeId === peerId)
              
              return (
                <View key={peerId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.ice, padding: 8, borderRadius: 8, marginBottom: 6 }}>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.primary }}>➔ {peerNode.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: Colors.textSecondary }}>Port Interface:</Text>
                    <TextInput
                      style={{ borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, borderRadius: 6, width: 90, height: 26, paddingHorizontal: 6, fontSize: 11 }}
                      value={currentPort?.name ?? 'GigabitEthernet0/0'}
                      onChangeText={(pName) => {
                        setPorts((prev) => {
                          const existing = prev.find((p) => p.connectedToNodeId === peerId)
                          if (existing) {
                            return prev.map((p) => p.connectedToNodeId === peerId ? { ...p, name: pName } : p)
                          } else {
                            const newPortId = uuidv4()
                            return [...prev, { id: newPortId, name: pName, connectedToNodeId: peerId }]
                          }
                        })
                      }}
                    />
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>

      <View style={deptSheet.buttons}>
        <Button label="Save Configuration" variant="primary" fullWidth onPress={handleSave} />
        <Button label="Cancel" variant="ghost" fullWidth onPress={onClose} />
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

  const [activeTab, setActiveTab] = useState<'departments' | 'subnets' | 'graph'>('departments')
  const [editedName, setEditedName] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [search, setSearch] = useState('')
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Path result sheet state
  const [showPathSheet, setShowPathSheet] = useState(false)
  const [pathResult, setPathResult] = useState<PathResult | null>(null)
  const [showConflictSheet, setShowConflictSheet] = useState(false)

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

  const departments = activeConfig?.departments ?? []
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
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={Colors.primary} />
        </Pressable>
        <TextInput
          style={styles.titleInput}
          value={editedName}
          onChangeText={handleNameChange}
          onBlur={handleSave}
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

      {/* Segmented control */}
      <View style={styles.segmented}>
        <Pressable
          style={[styles.segment, activeTab === 'departments' && styles.segmentActive]}
          onPress={() => setActiveTab('departments')}
        >
          <Text style={[styles.segmentText, activeTab === 'departments' && styles.segmentTextActive]}>
            Departments
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segment, activeTab === 'subnets' && styles.segmentActive]}
          onPress={() => setActiveTab('subnets')}
        >
          <Text style={[styles.segmentText, activeTab === 'subnets' && styles.segmentTextActive]}>
            Subnets
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segment, activeTab === 'graph' && styles.segmentActive]}
          onPress={() => setActiveTab('graph')}
        >
          <Text style={[styles.segmentText, activeTab === 'graph' && styles.segmentTextActive]}>
            Graph View
          </Text>
        </Pressable>
      </View>

      {/* Departments view */}
      {activeTab === 'departments' && (
        <View style={styles.deptContainer}>
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
            renderItem={({ item }) => (
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
                      onPress={() => handleDeleteDept(item.id)}
                      disabled={deletingId === item.id}
                    >
                      <Trash size={20} color={Colors.textMuted} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.deptMeta}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>🖥 {item.deviceCount} Devices</Text>
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
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🌐</Text>
                <Text style={styles.emptyTitle}>No departments yet</Text>
                <Text style={styles.emptySubtitle}>
                  Add your first one to start building your network topology.
                </Text>
              </View>
            }
          />

          {/* FAB */}
          <Pressable
            style={styles.fab}
            onPress={() => {
              setEditingDept(null)
              setShowAddSheet(true)
            }}
          >
            <Plus size={28} color={Colors.white} />
          </Pressable>
        </View>
      )}

      {/* Subnets view */}
      {activeTab === 'subnets' && (
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
                    <Text style={styles.emptyIcon}>📊</Text>
                    <Text style={styles.emptyTitle}>No subnets allocated</Text>
                    <Text style={styles.emptySubtitle}>
                      Add departments to automatically compute subnets.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </ScrollView>
      )}

      {/* Graph view */}
      {activeTab === 'graph' && (
        <View style={{ flex: 1, position: 'relative' }}>
          <NetworkGraph departments={departments} onPathFound={handlePathFound} />
          
          {/* Floating Validation Warning Bar */}
          {!allPass && (
            <Pressable
              style={styles.warningBar}
              onPress={() => setShowConflictSheet(true)}
            >
              <View style={styles.warningBarLeft}>
                <View style={styles.warningIconCircle}>
                  <Text style={styles.warningIconText}>⚠️</Text>
                </View>
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Invalid Configuration</Text>
                  <Text style={styles.warningSubtitle}>Tap to view routing loops & overlaps</Text>
                </View>
              </View>
              <CaretRight size={16} color={Colors.error} />
            </Pressable>
          )}
        </View>
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
      />

      {/* Topology Conflicts Bottom Sheet */}
      <BottomSheet
        visible={showConflictSheet}
        onClose={() => setShowConflictSheet(false)}
        snapHeight={420}
      >
        <Text style={styles.sheetTitle}>Topology Conflicts Detected</Text>
        <Text style={styles.sheetSubtitle}>
          The current network layout contains validation issues that make it invalid.
        </Text>
        <ScrollView style={styles.conflictList} showsVerticalScrollIndicator={false}>
          {!validation.cycleCheck.passed && (
            <View style={styles.conflictItem}>
              <Text style={styles.conflictHeader}>⚠️ Routing Loop Detected</Text>
              <Text style={styles.conflictMessage}>{validation.cycleCheck.message}</Text>
            </View>
          )}

          {!validation.allocationCheck.passed && (
            <View style={styles.conflictItem}>
              <Text style={styles.conflictHeader}>🚫 Subnet Overlap / Error</Text>
              <Text style={styles.conflictMessage}>{validation.allocationCheck.message}</Text>
            </View>
          )}

          {!validation.connectivityCheck.passed && (
            <View style={styles.conflictItem}>
              <Text style={styles.conflictHeader}>🔗 Connectivity Isolation</Text>
              <Text style={styles.conflictMessage}>{validation.connectivityCheck.message}</Text>
            </View>
          )}

          {!validation.vlanCheck.passed && (
            <View style={styles.conflictItem}>
              <Text style={styles.conflictHeader}>🏷️ VLAN Tag Collision</Text>
              <Text style={styles.conflictMessage}>{validation.vlanCheck.message}</Text>
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surfaceAlt },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: Colors.textMuted },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  backButton: { padding: 4 },
  titleInput: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.primary,
    textAlign: 'center',
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
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: Colors.white,
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
  warningBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 80,
    backgroundColor: Colors.errorContainer,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.error,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  warningBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  warningIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningIconText: {
    fontSize: 16,
    lineHeight: 20,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.error,
  },
  warningSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#991B1B',
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
  conflictHeader: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  conflictMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
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
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  field: { marginBottom: 16 },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  noPeers: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  buttons: { gap: 8, marginTop: 8 },
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
})
