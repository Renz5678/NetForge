// NetForge — All business logic types
// Define here, import everywhere. No inline type definitions in components.

export type DeviceType = 'department' | 'router' | 'switch' | 'firewall' | 'wan';

export type InterfacePort = {
  id: string;             // Unique port identifier
  name: string;           // e.g. "GigabitEthernet0/0", "FastEthernet0/1"
  connectedToNodeId?: string;
  connectedToPortId?: string;
  ipAddress?: string;     // e.g. "10.0.0.1/24" (for routers/firewalls)
  vlanMode?: 'access' | 'trunk'; // for switch ports
  vlanAccessId?: number;  // Access VLAN ID
  vlanTrunkAllowed?: number[]; // Allowed VLAN trunk IDs
}

export type StaticRoute = {
  destination: string;    // e.g. "0.0.0.0/0", "192.168.2.0/24"
  nextHop: string;        // e.g. "10.0.0.2"
  interfaceId?: string;   // Exit interface ID
}

export type OspfConfig = {
  enabled: boolean;
  areaId: number;         // e.g. 0 (Backbone Area)
}

export type AclAction = 'permit' | 'deny'
export type AclProtocol = 'ip' | 'tcp' | 'udp' | 'icmp'

export type AclRule = {
  id: string
  sequence: number       // ordering (10, 20, 30 …); lower = higher priority
  action: AclAction
  protocol: AclProtocol
  srcCidr: string        // e.g. "any" or "10.0.1.0/24"
  dstCidr: string
  dstPort?: number       // optional destination port (TCP/UDP only)
  remark?: string        // human-readable label
}

export type Department = {
  id: string
  name: string
  deviceCount: number
  peers: string[]
  subnet?: string
  vlanId?: number
  cidrPrefix?: number
  usableHosts?: number
  // Hardware Extensions:
  type?: DeviceType;
  ports?: InterfacePort[];
  staticRoutes?: StaticRoute[];
  ospf?: OspfConfig;
  aclRules?: AclRule[];
}

export type NetworkConfig = {
  id: string
  userId: string
  name: string
  departments: Department[]
  baseIp: string
  vlanStart: number
  createdAt: string
  updatedAt: string
  isValid?: boolean
}

export type CheckResult = {
  passed: boolean
  message: string
  affected?: string[]
}

export type ValidationResult = {
  cycleCheck: CheckResult
  allocationCheck: CheckResult
  connectivityCheck: CheckResult
  vlanCheck: CheckResult
}

export type GraphNode = {
  id: string
  label: string
  subnet: string
  vlanId: number
  x: number
  y: number
  status: 'valid' | 'cycle' | 'isolated'
  type?: DeviceType
}

export type GraphEdge = {
  source: string
  target: string
}

export type PathResult = {
  path: string[]
  hops: number
}

export type Profile = {
  id: string
  fullName: string
  baseIp: string
  vlanStart: number
  createdAt: string
  updatedAt: string
}

export type ActivityEntry = {
  id: string
  configId: string
  configName: string
  description: string
  timestamp: string
  iconName: string
}
