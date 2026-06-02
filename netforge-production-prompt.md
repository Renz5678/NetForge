# NetForge — Production-Readiness Prompt

You are a senior React Native / Expo engineer. Your task is to harden the **NetForge** app (an Expo Router v6 / React Native app for enterprise network topology design and simulation) from its current MVP state into a production-ready application.

The codebase uses:
- **Expo SDK 54 / Expo Router v6** with typed routes
- **Supabase** for auth and cloud persistence (with AsyncStorage offline fallback)
- **Zustand** for state management (`useAuthStore`, `useConfigStore`, `useVisualizationStore`)
- **@shopify/react-native-skia** for the network graph canvas
- **TypeScript** in strict mode
- **Jest + ts-jest** for algorithm unit tests
- **phosphor-react-native**, **react-native-gesture-handler**, **react-native-reanimated**

Do **not** change the core algorithm logic in `lib/algorithms/` (Dijkstra, A*, Prim's, BFS, cycle detection, topological sort, subnet allocator, routing simulator, ACL engine) — those are well-tested and correct. Do **not** change the Cisco CLI config generator in `lib/configGenerator.ts`.

Work through the following areas in order. After completing each section, run `npx tsc --noEmit` and `npm test` to verify nothing is broken before moving on.

---

## 1. Error Boundaries & Crash Prevention

**Goal:** The app must never show a white screen or unhandled JS error to the user.

- Add a `components/ErrorBoundary.tsx` class component that catches render errors, logs them (see §6), and shows a user-friendly fallback UI with a "Restart" button that calls `Updates.reloadAsync()` from `expo-updates`.
- Wrap the root layout in `app/_layout.tsx` with this ErrorBoundary.
- Add a second, lighter ErrorBoundary specifically around the `NetworkGraph` / Skia canvas component (`components/graph/NetworkGraph.tsx`). If the graph crashes, show an inline error card instead of crashing the whole screen — the rest of the config detail screen should remain usable.
- Audit every `.then()` in stores (`useAuthStore.ts`, `useConfigStore.ts`) and add `.catch()` handlers that surface errors via the existing Toast system (`react-native-toast-message`) rather than silently failing.

---

## 2. Auth & Session Hardening

**Goal:** Auth state must be bulletproof — no ghost sessions, no infinite loading spinners, no navigation race conditions.

- In `stores/useAuthStore.ts`, the `restoreSession` method currently subscribes to `supabase.auth.onAuthStateChange` and returns the unsubscribe function asynchronously. Audit this for a race condition: if the component unmounts before the promise resolves, the subscription may leak. Fix using a `cancelled` flag pattern.
- Add a `SESSION_TIMEOUT_MS = 30_000` guard in `restoreSession` — if Supabase does not respond within 30 seconds, set `loading = false` and treat the user as unauthenticated so the app doesn't spin forever.
- The guest mode (`signInAsGuest`) stores credentials using a `*.local` email check. This is a dev bypass that must be clearly gated: add an `__DEV__` guard so guest mode is only available in development builds. In production (`!__DEV__`), remove the "Continue as Guest" button from both `app/(auth)/login.tsx` and `app/(auth)/signup.tsx`.
- Add `expo-secure-store` token caching for the Supabase session (the plugin is already declared in `app.json` — wire it up in `lib/supabase.ts` using the `AsyncStorageAdapter` pattern documented at https://docs.expo.dev/versions/v56.0.0/).

---

## 3. Offline Sync & Data Integrity

**Goal:** The app must gracefully handle network loss, and local + cloud state must never diverge silently.

- In `stores/useConfigStore.ts`, all Supabase mutations (create, update, delete config) should follow an **optimistic update** pattern:
  1. Apply the change locally (Zustand state + AsyncStorage) immediately.
  2. Attempt the Supabase write in the background.
  3. On network failure, enqueue the operation in a `pendingOps: PendingOp[]` array persisted to AsyncStorage.
  4. On reconnect (use `@react-native-community/netinfo` or Expo's network utilities), flush the pending queue.
- Add a `SyncStatusBanner` component that shows a subtle banner at the top of the configs screen when there are pending unsynced changes. Dismiss it automatically once sync completes.
- Prevent data loss on conflict: if a `NetworkConfig` was modified locally while also modified remotely (compare `updatedAt` timestamps), show a conflict resolution bottom sheet offering "Keep Local" or "Use Cloud Version".

---

## 4. Input Validation & Type Safety

**Goal:** No invalid data should ever reach the algorithm layer or be persisted to Supabase.

- Create a `lib/validators.ts` module exporting Zod schemas (add `zod` as a dependency) for:
  - `NetworkConfigSchema` — validates a full config including all departments, ensuring required fields exist and IPs are valid CIDR notation.
  - `DepartmentSchema` — validates device count (1–16,000,000), peer IDs reference existing departments, VLAN IDs are 1–4094, subnet is valid CIDR.
  - `AclRuleSchema` — validates sequence numbers, protocol, CIDR strings, port range (0–65535).
- Run `DepartmentSchema.parse()` before any department is added or updated in `useConfigStore`. Show field-level validation errors in the department editor bottom sheet.
- Sanitize all user-provided strings (config name, department name, device names) to prevent XSS if configs are ever rendered as HTML in the export screen.

---

## 5. Performance

**Goal:** The app must feel smooth on a mid-range Android device (Pixel 4a equivalent).

- **Graph rendering:** The Skia `NetworkGraph` re-renders on every Zustand state change. Memoize `GraphEdge` and `GraphNode` with `React.memo`. Extract `useGraphLayout` hook results into a `useMemo` keyed on department IDs and peer arrays — not the full department objects.
- **FlatList optimization:** In `app/(tabs)/configs.tsx`, add `initialNumToRender={8}`, `maxToRenderPerBatch={5}`, `windowSize={5}`, and `getItemLayout` if config cards have a fixed height.
- **Algorithm visualizer:** The `useVisualizationStore` `_advanceStep` is called via `setInterval`. Move the interval into a `useRef`-based timer hook and avoid storing the full `steps` array (which can be 100+ objects) in Zustand — store only `currentStepIndex` in Zustand and keep the steps array in a React ref local to `AlgorithmVisualizerPanel`.
- **Bundle size:** Run `npx expo export --dump-sourcemap` and audit the sourcemap with `expo-bundle-analyzer`. Ensure `d3-force` is tree-shaken (import only `forceSimulation`, `forceLink`, `forceManyBody`, `forceCenter` — not the full `d3-force` package default export).

---

## 6. Logging, Observability & Error Reporting

**Goal:** Know when and why the app is failing in production without shipping a console.log-heavy bundle.

- Add `@sentry/react-native` (or `expo-sentry` if available). Initialize it in `app/_layout.tsx` before rendering, using `EXPO_PUBLIC_SENTRY_DSN` from environment variables. Wrap the root component with `Sentry.wrap()`.
- In the `ErrorBoundary` from §1, call `Sentry.captureException(error, { extra: { errorInfo } })`.
- Strip all `console.log` statements from production builds using Babel's `babel-plugin-transform-remove-console` in `babel.config.js` (already uses `babel-preset-expo`, so add the plugin conditionally for `production` env only).
- Add breadcrumb logging (`Sentry.addBreadcrumb`) at key user actions: config created, config opened, algorithm started, export triggered.

---

## 7. Accessibility (a11y)

**Goal:** Pass a basic WCAG 2.1 AA audit for mobile.

- Every `Pressable` and touchable element must have an `accessibilityLabel` and `accessibilityRole`. Audit all of: `app/(tabs)/configs.tsx` (FAB, config cards, delete button), `app/(tabs)/index.tsx` (config cards, metric tiles), `AlgorithmVisualizerPanel` (play/pause/step controls), and the `BottomSheet` component.
- The `BottomSheet` component must trap focus when open and restore focus when closed. Add `accessibilityViewIsModal={true}` on the backdrop.
- Ensure minimum tap target size is 44×44pt for all interactive elements. Audit `StepperInput`, `PeerChip`, and the graph node press handlers.
- Add `accessibilityLiveRegion="polite"` on the `AlgorithmToast` so screen readers announce algorithm step changes.

---

## 8. Security Hardening

**Goal:** No sensitive data leaks; Supabase RLS is the last line of defense but the client must also be correct.

- Audit `lib/supabase.ts`: ensure the Supabase client is initialized once (singleton pattern) and that the `EXPO_PUBLIC_SUPABASE_ANON_KEY` is never logged.
- In `stores/useConfigStore.ts`, every Supabase query must include a `.eq('user_id', userId)` filter before any data is returned. Do not rely solely on RLS — defense in depth.
- The export screen (`app/(tabs)/export.tsx`) writes config data to a `.txt` file via `expo-sharing`. Ensure the temp file is written to `FileSystem.cacheDirectory` (not `documentDirectory`) so it's excluded from iCloud/Google Drive backups. Delete the temp file after sharing completes using `FileSystem.deleteAsync`.
- Validate the `baseIp` field in config creation — reject RFC 1918 public-facing ranges that could be typos causing confusion (e.g., reject `0.0.0.0` and `255.255.255.255` as base IPs).

---

## 9. Testing Coverage

**Goal:** Critical user paths have test coverage; the existing algorithm tests continue to pass.

- Add a `__tests__/validators.test.ts` file testing the Zod schemas from §4 — valid cases, edge cases, and rejection cases for invalid CIDR, out-of-range VLAN IDs, and excessive device counts.
- Add a `__tests__/useConfigStore.test.ts` using `zustand`'s testing utilities (or mock Supabase with `jest.mock('@/lib/supabase')`). Test: `createConfig` optimistic update adds to local state immediately; Supabase failure enqueues a pending op; `loadConfigs` correctly merges local AsyncStorage fallback when Supabase is unreachable.
- Add a `__tests__/authStore.test.ts` testing the 30-second timeout guard and the cancelled-flag race condition fix.
- All existing tests in `__tests__/` must continue to pass without modification.

---

## 10. App Config & Build Readiness

**Goal:** The app can be submitted to the App Store and Google Play.

- In `app.json`, add `"newArchEnabled": true` under each platform (the dependency versions already support the new architecture).
- Add `"privacy"` manifest entries for iOS (required for App Store review): location not used; camera not used; microphone not used.
- Add `"android": { "permissions": [] }` to explicitly declare no dangerous permissions are requested.
- Ensure `expo-secure-store`'s Face ID permission string is non-empty and descriptive (it currently is — verify it still reads: `"Allow NetForge to access Face ID to securely store credentials."`).
- Create a `eas.json` at the repo root with three build profiles: `development` (development client, internal distribution), `preview` (internal distribution, production JS bundle), and `production` (store distribution, `autoIncrement: true`).
- Add a `.github/workflows/ci.yml` that runs on every PR: `npm ci`, `npx tsc --noEmit`, `npm test`.

---

---

## 11. Icon-First UI — Eliminate Emoji Usage

**Goal:** The app must feel like a professional engineering tool, not a consumer chat app. Every emoji currently used as UI chrome must be replaced with a `phosphor-react-native` icon of equivalent semantic meaning. Emoji are appropriate only inside user-generated content (e.g. a department name a user typed themselves) — never in chrome.

**Audit and replace every emoji in the following locations:**

- `app/(onboarding)/index.tsx` — the `✳` used as a NetForge logo mark. Replace with a purpose-built SVG logo component (`components/ui/NetForgeLogo.tsx`) that renders a small stylized node-and-edge mark using React Native SVG (the `react-native-svg` package is already a dependency). The logo should use `Colors.primary` and be reusable across onboarding, login, and the home tab header.
- `app/(auth)/login.tsx` — the `✳` app icon at the top. Replace with `<NetForgeLogo />`.
- `app/(tabs)/index.tsx` — the `✳ NetForge` logo in the header. Replace with `<NetForgeLogo />` alongside the wordmark.
- `components/ui/PeerChip.tsx` — the `✓ ` text checkmark for selected peers. Replace with `<Check size={14} color={Colors.white} />` from `phosphor-react-native`.
- `components/ui/StepperInput.tsx` — the `−` and `+` text buttons. Replace with `<Minus size={18} />` and `<Plus size={18} />` from `phosphor-react-native`. Ensure the tap target remains 52×52pt.
- `components/viz/AlgorithmVisualizerPanel.tsx` — the `▶`, `⏸`, `⏮`, `⏭`, `⏸`, `✕` text used for playback controls. Replace:
  - Play → `<Play size={20} weight="fill" />`
  - Pause → `<Pause size={20} weight="fill" />`
  - Step back → `<SkipBack size={20} />`
  - Step forward → `<SkipForward size={20} />`
  - Close → `<X size={18} />`
  All from `phosphor-react-native`.
- `app/(auth)/signup.tsx` — the `⚡ Continue as Guest` label. Replace with `<Lightning size={16} />` icon (already imported in `NetworkGraph.tsx`) inline before the text.
- Any remaining raw emoji in button labels, section headers, or status indicators anywhere in `app/` or `components/`. Do a codebase-wide search for Unicode emoji characters and replace each one.

**When replacing, follow this rule:** the icon must be the same visual weight (regular vs bold/fill) as the surrounding text. Use `weight="fill"` for primary action icons and `weight="regular"` (the default) for secondary/decorative ones.

---

## 12. Overall UI/UX Polish

**Goal:** Every screen should feel intentional, consistent, and spatially coherent. Raise the perceived quality from "well-built prototype" to "shipping product."

### 12a. Typography & Spacing Consistency

- Audit all inline `fontSize`, `lineHeight`, and `letterSpacing` values across every screen and component. Any value not already defined in `constants/typography.ts` must be moved there. Screens must import from `Typography` constants, not use magic numbers.
- Every section header that currently uses all-caps small text (e.g. `GENERAL`, `DATA`, `RECENT CONFIGS`) must have a consistent `letterSpacing: 0.8` and `fontSize: 11`. Codify this as a `Typography.sectionLabel` style and use it everywhere.
- Line heights for body text must be consistently `1.5× fontSize`. Audit `algoSubtitle`, `description`, `emptySubtitle`, `settingLabel` and normalize.

### 12b. Empty States

Every screen that can have an empty list must have a properly designed empty state — not just a text label. Each empty state needs: a `phosphor-react-native` icon (large, ~48px, `Colors.pale`), a bold title, a one-sentence description, and a primary CTA button if an action is available.

- `app/(tabs)/configs.tsx` — already has a reasonable empty state but the icon container is 80×80 with a 48px icon. Ensure the icon is `FolderSimpleDashed` from phosphor (already used). Verify the "Create Configuration" button inside the empty state actually opens the new config bottom sheet.
- `app/(tabs)/validate.tsx` — if validation has never been run, show an empty state with `CheckCircle size={48}` and the text "Run validation to check your topology for issues."
- `app/(tabs)/export.tsx` — if no config is active, show an empty state with `Export size={48}` and "Open a configuration to export its Cisco CLI script."
- `app/(tabs)/index.tsx` (home) — if `configs.length === 0`, replace the metrics tiles row with a single illustrated empty state card: a `TreeStructure size={48}` icon, "No configurations yet", and a "Create your first config" button that navigates to the configs tab.

### 12c. Loading States

Replace every bare `ActivityIndicator` with a skeleton loading pattern where the loaded content has a known shape:

- `app/(tabs)/configs.tsx` config list — the existing `ConfigSkeleton` component is good. Verify it renders the correct number of skeleton cards (use `initialNumToRender` count, typically 5).
- `app/(tabs)/index.tsx` home — the `loadConfigs` call has no loading skeleton. Add a `HomeSkeleton` component that renders skeleton placeholders for the horizontal config scroll and the metrics row.
- Any `if (loading) return null` pattern (e.g. `app/index.tsx`) — replace with a centered `ActivityIndicator` using `Colors.primary` so users see feedback instead of a blank screen.

### 12d. Interaction Feedback

- Every `Pressable` must have a pressed-state visual change. The pattern used in `Button.tsx` (opacity change via `({ pressed }) => [styles.base, pressed && styles.pressed]`) must be applied consistently everywhere. Audit all `Pressable` instances in `configs.tsx`, `index.tsx`, `profile.tsx`, and all components.
- The FAB (floating action button) in `configs.tsx` must have a `withSpring` scale-down animation on press and a subtle shadow lift at rest. Use Reanimated's `useAnimatedStyle` + `useSharedValue`.
- The `BottomSheet` handle bar should be swipeable to dismiss using `react-native-gesture-handler`'s `PanGestureHandler` — if the user drags down more than 80px at sufficient velocity, the sheet closes. This is a standard mobile pattern users expect.
- Config cards in `configs.tsx` must support swipe-to-delete via a `PanGestureHandler` that reveals a red delete zone on the right side, consistent with platform conventions. The delete action must still show the confirmation bottom sheet before executing.

### 12e. Navigation & Header Consistency

- Every tab screen must have a consistent header height of 64pt with `borderBottomWidth: 1, borderBottomColor: Colors.border` and `backgroundColor: Colors.white`. Audit `configs.tsx`, `validate.tsx`, `export.tsx`, and `profile.tsx` — `index.tsx` (home) uses a custom header which is acceptable.
- Tab bar icons must all use `phosphor-react-native` with `weight="fill"` for the active tab and `weight="regular"` for inactive. Audit `app/(tabs)/_layout.tsx` and ensure this convention is applied uniformly.
- Back buttons (e.g. in `config/[id]`) must use `<ArrowLeft size={22} />` from phosphor, not a text label or system back indicator.

### 12f. Color & Visual Hierarchy

- The home screen's greeting text and sub-greeting have no visual separation from the content below. Add `marginBottom: 24` and a subtle `borderBottomWidth: 1 / PixelRatio.get(), borderBottomColor: Colors.border` divider between the greeting section and the "RECENT CONFIGS" section header.
- Config cards in the horizontal scroll on the home screen (`MiniGraphThumbnail`) use static colored bars that don't reflect actual topology data. Replace with a live mini-graph: render department count as simple colored dots arranged in a row, using `Colors.primary`, `Colors.medium`, and `Colors.pale` to represent different device types (router, switch, department). Cap at 5 visible dots + a "+N" text if there are more.
- The `ValidationCard` currently uses only `Colors.primary` for pass and `Colors.error` for fail. Add a `warning` state (for topology warnings that aren't hard failures) using `Colors.warning`, with a distinct left bar color and `WARNING` badge label.

---

## 13. Algorithm Use — Discoverability & Clarity

**Goal:** A first-time user must understand what the algorithms do, when to use them, and see meaningful visual feedback — without reading documentation.

### 13a. Algorithm Entry Point — Surface It Prominently

The current entry to algorithm visualization is a toolbar button labeled "Explore Algorithms" in the graph canvas toolbar. This is easy to miss.

- Rename the button label to **"Run Algorithm"** and use `<Play size={18} weight="fill" />` as its leading icon. Style it as the primary action in the toolbar (filled background, `Colors.primary`, white icon+text).
- On first app launch after account creation (check `AsyncStorage` for a `hasSeenAlgorithmHint` key), show a one-time coach mark pointing at the "Run Algorithm" button with the text: "Tap to explore Dijkstra, A*, Prim's, and more on this topology." Dismiss on tap anywhere. Use a `CoachMark` component built with `react-native-reanimated` (animated arrow + tooltip bubble).
- When a config has exactly 2 or more nodes, and no algorithm has been run yet in this session, show a persistent inline banner below the graph toolbar (not a toast): "Tap two nodes to find the shortest path, or run a full algorithm." Dismiss it after any algorithm runs or after any two-node selection. Store dismiss state in a `useRef` (not persisted).

### 13b. Algorithm Card Redesign in the Selector

The `AlgorithmSelector` bottom sheet shows algorithm cards with a small icon, a title, and a subtitle. Add the following to each card:

- A **complexity badge**: a small pill showing time complexity (e.g. `O((V+E) log V)` for Dijkstra) rendered in monospace font. Use `fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace'` and `Colors.textMuted`. Position it below the subtitle, right-aligned.
- A **use case tag**: one of `PATHFINDING`, `TOPOLOGY`, `SPANNING TREE`, or `SORTING` — rendered as a `Badge` component (already exists) with `variant="primary"` for the selected algorithm and `variant="neutral"` for others.
- A **"What does this do?"** expandable row at the bottom of each card (initially collapsed). When expanded (toggle on the same tap as card selection is not ideal — add a separate `Info` icon button on the right that expands a description inline). The descriptions must be concrete and network-specific:
  - Dijkstra: "Finds the lowest-cost path between two network nodes, simulating how a router selects the best route using OSPF cost metrics."
  - A*: "Guided pathfinding that uses a heuristic to reach the target faster — useful for visualizing how weighted topology affects routing decisions."
  - Prim's MST: "Builds the minimum spanning tree — the most cost-efficient cabling plan that connects all nodes with the least total link cost."
  - Cycle Detection: "Identifies routing loops that would cause packets to circulate forever, catching misconfigurations before deployment."
  - Topological Sort: "Orders network nodes so that dependencies are respected — useful for determining the sequence in which to bring devices online."

### 13c. Step-by-Step Panel — Make Each Step Legible

The `AlgorithmVisualizerPanel` shows a plain-text explanation for each step. Upgrade it:

- **Step counter chip:** Replace the progress scrubber label ("Step 3 of 12") with a styled chip: `[◀ 3 / 12 ▶]` where the arrows are tappable for step-back and step-forward, integrated into the label itself as a compact control. The separate step-back and step-forward buttons can remain below.
- **Explanation text color coding:** The current `getExplanationColor` function only changes color for cycle and complete states. Extend it:
  - Any step involving "relaxing" or "updating cost" → `Colors.vizInQueue` (blue-ish)
  - Any step involving "settling" or "added to MST" → `Colors.vizSettled` (green-ish)
  - Any step involving "cycle" or "back-edge" → `Colors.vizCycle` (red)
  - Default → `Colors.textPrimary`
- **Algorithm-specific data structure label:** The `DataStructureDisplay` component shows a generic list. Add a header above it that names the structure being displayed: "Priority Queue" for Dijkstra/A*, "Min-Heap" for Prim's, "DFS Stack" for cycle detection, "In-Degree Queue" for topological sort. Use `fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.textMuted, letterSpacing: 0.5` uppercase.
- **"Why this step?" inline hint:** Below the explanation text, add a collapsed `Why?` toggle (a small `Info` icon from phosphor + the word "Why?"). When expanded, show a one-sentence conceptual reason for what the algorithm is doing at this step. These explanations should be pre-authored in the visualizer step data as an optional `hint?: string` field. Add `hint` strings to the step generators in `lib/algorithms/dijkstraVisualizer.ts`, `aStarVisualizer.ts`, `primsVisualizer.ts`, `cycleDetectionVisualizer.ts`, and `topologicalSortVisualizer.ts`. Example: for a Dijkstra "relax edge" step, hint = "We check if going through this node offers a shorter path than what we've found so far."

### 13d. Graph Canvas — Algorithm State Must Be Unmistakable

The graph already uses `VIZ_FILL` color states. Add the following visual reinforcements:

- **Node state label:** When `vizActive` is true, render a small text label below each node card on the Skia canvas showing its current viz state in human-readable terms: "Settled", "In Queue", "Unvisited", "On Path". This label should be 9px, in `rgba(255,255,255,0.7)`, centered below the node card with a `marginTop` of 4px from the bottom of the card. Only render this when `vizActive && showSteps` — not during the fast auto-Dijkstra sweep triggered by two-node selection.
- **Edge weight labels:** When an algorithm is active that uses edge weights (Dijkstra, A*, Prim's), render edge weight numbers as small pills centered on each edge line. The pill background should be `rgba(30,42,60,0.72)` and the text `#C8D8EE` at 9px — consistent with the port label pill style already used in `GraphEdge.tsx`.
- **Animated pulse on the "current" node:** The node currently being processed (the one just dequeued / the active frontier node) should pulse with a scale animation. In Skia, implement this as an animated outer ring that grows from `r=RADIUS+8` to `r=RADIUS+16` and fades from `opacity=0.4` to `opacity=0`, looping while that node is the current step's `currentNodeId`. Use a `useSharedValue` driven by a `withRepeat(withTiming(...))` in Reanimated passed into the Skia canvas via `useDerivedValue`.
- **VizLegend — always show during active algorithm:** The `VizLegend` component is currently toggled by a button. When `vizActive` is true, force `showLegend = true` and hide the toggle button. The legend must always be visible while an algorithm is running so users can decode the color states.

### 13e. Post-Algorithm Result Screen

After an algorithm completes (playback reaches the last step), instead of just stopping, show a **Result Summary** inside the `AlgorithmVisualizerPanel` that replaces the step explanation:

- For **Dijkstra / A***: show total path cost, number of hops, and the full node path as a horizontal scrollable list of node name chips separated by `→` arrows.
- For **Prim's MST**: show total MST weight and the number of edges included.
- For **Cycle Detection**: show "No cycles detected" or "Cycle detected involving: [node names]" as chips.
- For **Topological Sort**: show the full sorted order as a horizontal chip list.

Include a **"Run Again"** button (secondary variant) and a **"Change Algorithm"** button (ghost variant) at the bottom of the result summary.

---

## Constraints & Ground Rules

1. **Do not modify** any file in `lib/algorithms/` or `lib/configGenerator.ts`.
2. **Do not modify** any file in `__tests__/` except to add new test files.
3. All new code must pass `npx tsc --noEmit` with no new errors.
4. All new code must follow the existing naming conventions: PascalCase for components, camelCase for hooks and utilities, kebab-case for file names where already established.
5. Use the existing `Colors` constants — do not introduce hardcoded hex values.
6. Use the existing `Button`, `Card`, `Input`, `BottomSheet`, and `Toast` components for any new UI — do not introduce a new UI library.
7. For any new dependency, prefer packages already used by Expo's ecosystem (check `npx expo install` compatibility before `npm install`).
8. Run `npx tsc --noEmit` and `npm test` after each section. Do not proceed to the next section if either fails.
