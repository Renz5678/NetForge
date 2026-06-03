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

// ─── Algorithm Impact Summary ──────────────────────────────────────────────────
// Shown after every algorithm completes to explain the networking impact.
export type AlgorithmImpactSummary = {
  whatHappened: string      // e.g. "Best route found."
  whyItMatters: string      // e.g. "This path reduces total cost from 34 to 18."
  behindTheScenes: string   // e.g. "Dijkstra's Algorithm evaluated 12 nodes."
}

// ─── Network Insights ───────────────────────────────────────────────────────────
// Auto-surfaced findings shown in the Insights Panel.
export type InsightSeverity = 'info' | 'warning' | 'error'

export type NetworkInsight = {
  id: string
  severity: InsightSeverity
  title: string             // Short summary
  explanation: string       // What was found
  suggestedAction: string   // What to do about it
  algorithmRef?: string     // Human-friendly name of algorithm used
  algorithmKey?: AlgorithmType // Underlying algorithm key
  affectedNodeIds?: string[] // Node IDs involved in the insight
  timestamp: number
}

// ─── Algorithm Visualization Types ────────────────────────────────────────────
// NodeVizState: the visual state a graph node can be in during algorithm replay.
// Mapped to the color language:
//   unvisited   → Blue    (default / not yet reached)
//   inQueue     → Yellow  (in priority queue or BFS queue)
//   inStack     → Orange  (in current DFS recursion stack)
//   settled     → Green   (finalized / added to MST / sorted)
//   cycle       → Red     (part of a detected cycle)
//   path        → Cyan    (on the final highlighted path)
//   mstIncluded → Green   (absorbed into the MST)
//   mstFrontier → Yellow  (reachable from MST but not yet included)
export type NodeVizState =
  | 'unvisited'
  | 'inQueue'
  | 'inStack'
  | 'settled'
  | 'cycle'
  | 'path'
  | 'mstIncluded'
  | 'mstFrontier'

export type EdgeVizState =
  | 'default'
  | 'active'       // currently being relaxed / evaluated
  | 'back-edge'    // back-edge causing a cycle (red)
  | 'path'         // on the final shortest path (cyan)
  | 'mst'          // accepted into the MST (green dashed)
  | 'candidate'    // crossing edge being considered for MST (yellow)

// MSTEdge: a single edge accepted into the Minimum Spanning Tree.
export type MSTEdge = {
  source: string
  target: string
  weight: number
}

// PrimsResult: the full output of Prim's MST algorithm.
export type PrimsResult = {
  mstEdges: MSTEdge[]
  totalCost: number
  orderedNodes: string[] // order in which nodes were added to the MST
}

// VisualizationStep: a single snapshot of algorithm state, pre-computed.
// The visualizer replays an array of these — one per animation frame.
export type StoryPhase = 'before' | 'during' | 'after'

export type VisualizationStep = {
  stepIndex: number
  explanation: string                          // Plain-English description of this step
  networkingContext?: string                   // Networking-first framing ("OSPF selected...")  
  hint?: string                                // Conceptual hint for "Why this step?"
  storyPhase?: StoryPhase                      // Which storytelling phase this step belongs to
  impactSummary?: AlgorithmImpactSummary       // Only present on the final 'after' step
  nodeStates: Record<string, NodeVizState>     // Visual state per node ID
  edgeStates?: Record<string, EdgeVizState>    // Visual state per "srcId→targetId" edge key

  // ── Dijkstra / A* specific ─────────────────────────────────────────────────
  priorityQueue?: Array<{ id: string; dist: number; f?: number; h?: number }>
  distances?: Record<string, number>           // g-scores from source
  currentNode?: string                         // node being settled this step

  // ── Cycle Detection specific ────────────────────────────────────────────────
  dfsStack?: string[]                          // current DFS recursion stack (node IDs)
  backEdge?: { from: string; to: string }      // the back-edge that caused a cycle

  // ── Topological Sort specific ───────────────────────────────────────────────
  inDegreeMap?: Record<string, number>         // live in-degree counts
  topoQueue?: string[]                         // current BFS queue contents
  sortedResult?: string[]                      // growing sorted result list

  // ── Prim's MST specific ─────────────────────────────────────────────────────
  mstEdges?: MSTEdge[]                         // accepted MST edges so far
  mstCost?: number                             // running total cost
  candidateEdges?: Array<{ source: string; target: string; weight: number }> // crossing edges
  currentEdge?: { source: string; target: string; weight: number } // edge being evaluated
}

// AlgorithmType: union of all supported visualization algorithms.
// 'pathfindingComparison' is a synthetic type for the side-by-side Dijkstra vs A* panel.
export type AlgorithmType =
  | 'dijkstra'
  | 'aStar'
  | 'cycleDetection'
  | 'topologicalSort'
  | 'prims'
  | 'pathfindingComparison'

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
