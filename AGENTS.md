# NetForge — Architecture & Contributor Guide

> Read the **exact versioned docs** at https://docs.expo.dev/versions/v56.0.0/ before writing any Expo-specific code.

---

## §1 Project Overview

NetForge is a **React Native / Expo** networking simulator that lets users build, visualise, and validate enterprise network topologies on a mobile device.

The app simulates real networking protocols and behaviours:
- **Longest Prefix Match (LPM) routing** with static routes and OSPF dynamic propagation
- **VLAN switching** (access / trunk ports, per-VLAN forwarding)
- **ACL enforcement** on firewall and department nodes
- **Algorithm visualisation** — every graph algorithm (Dijkstra, A\*, Cycle Detection, Topological Sort, Prim's MST) is recorded as a pre-computed `VisualizationStep[]` array and replayed step-by-step in the UI.

---

## §2 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Expo SDK 56 + React Native |
| Language | TypeScript (strict) |
| State | Zustand 4 (`stores/`) |
| Canvas | @shopify/react-native-skia |
| Remote persistence | Supabase (PostgreSQL + Row Level Security) |
| Offline persistence | @react-native-async-storage/async-storage |
| Unit tests | Jest |
| Navigation | Expo Router v4 (file-based) |

**Key docs:** https://docs.expo.dev/versions/v56.0.0/

---

## §3 Data Model

All nodes in a topology are typed as `NetworkNode` — a **discriminated union** with `type` as the discriminant field.

```ts
export type NetworkNode =
  | RouterNode      // type: 'router'
  | SwitchNode      // type: 'switch'
  | FirewallNode    // type: 'firewall'
  | DepartmentNode  // type: 'department'
  | WanNode         // type: 'wan'
```

Each variant extends `BaseNode` (id, name, deviceCount, peers, subnet?, vlanId?, cidrPrefix?, usableHosts?) and adds only the fields valid for that device class:

| Field | RouterNode | SwitchNode | FirewallNode | DepartmentNode | WanNode |
|-------|:---:|:---:|:---:|:---:|:---:|
| `ports` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `staticRoutes` | ✓ | — | ✓ | — | ✓ |
| `ospf` | ✓ | — | — | — | — |
| `aclRules` | — | — | ✓ | ✓ | — |

### Invariants — read these before touching topology code

1. **Edges are always bidirectional.** If node A lists node B in `peers`, node B MUST list node A. Violating this breaks BFS, cycle detection, Prim's, and routing.
2. **`ports[].connectedToNodeId` / `connectedToPortId`** is the physical link representation. `peers[]` is the logical adjacency list consumed by graph algorithms. Both must be kept in sync.
3. **`subnet` and `vlanId` are allocation outputs.** They are written by `allocateSubnets()` (called from `useConfigStore.runAllocation()`). Never set them manually in node literals — they will be overwritten.
4. **OSPF adjacency requires a physical link.** Two routers in the same OSPF area will NOT exchange routes unless they are connected via `connectedToNodeId`/`connectedToPortId`. Area ID match alone is not enough.
5. **`type` is required on every node.** Legacy data may have `type: undefined` — treat it as `'department'` when narrowing.

---

## §4 Zustand Stores

### `useConfigStore` (`stores/useConfigStore.ts`)
Owns all persistent app state:
- `configs: NetworkNode[][]` — the user's saved network configurations
- `activeConfig: NetworkConfig | null` — the currently selected config (all algorithm screens read from here)
- `pendingOps` — offline sync queue flushed to Supabase when connectivity is restored
- `activeMstEdges`, `activeMstCost`, `activeHasCycle` — cached algorithm outputs from the last `runAllocation()` call

The most important action is **`runAllocation()`**, which is called on every topology change and runs this pipeline synchronously:
1. `detectCycles()` → sets `activeHasCycle`
2. `topologicalSort()` → stable insertion order
3. `allocateSubnets()` → assigns `subnet`, `vlanId`, `usableHosts` to every node
4. `findMinimumSpanningTree()` → sets `activeMstEdges`, `activeMstCost`

### `useVisualizationStore` (`stores/useVisualizationStore.ts`)
Owns the active algorithm replay state:
- `steps: VisualizationStep[]` — the pre-computed snapshot array for the current algorithm run
- `currentStepIndex: number` — the frame being displayed
- `isPlaying: boolean`, `speed: number` — playback controls
- `failureSimResult` — result of the route simulation (for Routing trace view)

Call `startVisualization(algorithmType, steps, options)` to hand it a computed step array. The store's ticker advances `currentStepIndex` at `speed` ms intervals independently of re-renders.

### `useAuthStore` (`stores/useAuthStore.ts`)
Owns the Supabase session and user profile. Used for RLS-scoped queries in `useConfigStore`.

### `usePreferencesStore` (`stores/usePreferencesStore.ts`)
Owns UI preferences (default base IP, VLAN start, theme). Persisted to AsyncStorage.

---

## §5 Algorithm-to-Visualizer Pipeline

This is the most important architectural pattern in the codebase. All algorithms follow the same contract:

1. **A user interaction** (e.g., tapping two nodes in `NetworkGraph.tsx`) triggers a call to a pure visualizer function, e.g.:
   ```ts
   const result = buildDijkstraSteps(departments, srcId, tgtId)
   ```
2. **The visualizer function** runs the full algorithm once, recording every decision into a `VisualizationStep[]` array. It never performs IO or reads from stores. It returns immediately with a snapshot array.
3. **The result is handed to the store:**
   ```ts
   useVisualizationStore.getState().startVisualization('dijkstra', result.steps, options)
   ```
4. **The store's ticker** advances `currentStepIndex` at the configured `speed` interval using `setInterval`.
5. **`NetworkGraph.tsx` reads** `useVisualizationStore((s) => s.currentStep)` and maps `currentStep.nodeStates` / `currentStep.edgeStates` to Skia paint colours on the canvas. **No re-computation happens per frame** — only state reads and paint calls.

### Visualizer file naming convention
Each algorithm has two files:
- `lib/algorithms/{algo}.ts` — pure algorithm, returns `PathResult | PrimsResult | etc.`
- `lib/algorithms/{algo}Visualizer.ts` — wraps the algorithm, returns `VisualizationStep[]`

---

## §6 Zustand Selector Pattern (mandatory)

> **RULE: Always subscribe to `useConfigStore` with a granular selector. Never call `useConfigStore()` without a selector.**

```ts
// ✅ Correct — component only re-renders when activeConfig changes
const activeConfig = useConfigStore((s) => s.activeConfig)

// ❌ Wrong — component re-renders on ANY store change (syncing, pendingOps, loading, etc.)
const { activeConfig, loadConfigs } = useConfigStore()
```

`useConfigStore` holds the full `activeConfig` (potentially hundreds of nodes) and async sync state. A whole-store subscription causes every subscribed component to re-render whenever `syncing`, `pendingOps`, `loading`, or any unrelated field changes.

### Files audited (Task 6 — June 2026)
The following files were migrated from whole-store to granular selectors:
- `app/(tabs)/configs.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/profile.tsx`
- `components/ui/ProfileSidebar.tsx`
- `components/ui/ProjectSwitcherSheet.tsx`
- `app/config/[id].tsx`

**Note:** `useVisualizationStore` in `components/graph/NetworkGraph.tsx` (line ~185) still uses whole-store destructuring for actions. This is a known follow-up — it applies the same anti-pattern to a different store and should be addressed in a future cleanup pass.

---

## §7 Running Locally

```bash
# Install dependencies
cd netforge-app
npm install

# Start the Expo dev server (iOS / Android / Web)
npx expo start

# Run unit tests
npx jest

# Type-check without emitting
npx tsc --noEmit
```

The test suite is located in `__tests__/`. All test files mock `@react-native-async-storage/async-storage`, `@/lib/supabase`, and `@react-native-community/netinfo` at the top of the file — new tests must include these mocks or they will fail in CI.
