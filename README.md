# NetForge — Mobile Network Topology Designer & Simulator

NetForge is a high-fidelity, offline-first mobile application designed for network engineers to design, simulate, and configure complex Layer 2/Layer 3 network topologies on the go. Built with React Native, Expo, and React Native Skia, it provides a premium interactive graph editor, a robust routing simulation engine, real-time validation checkers, and a vendor configuration script generator.

---

## Key Capabilities

### 1. Interactive Graph Topology Designer
* **Fluid Skia Canvas:** Leverages `@shopify/react-native-skia` to render high-performance network diagrams with smooth panning and pinch-to-zoom gestures.
* **Custom SVG Vector Icons:** High-fidelity custom SVG graphics rendering representing specific hardware roles:
  * 🖧 **Routers** (Deep Blue)
  * 🔀 **Switches** (Teal)
  * 🧱 **Firewalls** (Rust Orange)
  * ☁️ **WAN Uplinks** (Forest Green)
  * 🏢 **Departments / Client Hosts** (Brand Blue)
* **Smart Physical Wiring:** Draw links between ports with visible interface labels (e.g. `g0/0`, `f0/24`) and automatic card border-snapping.

### 2. Multi-Role Hardware Node Management
* **Routers:** Configure per-port IP addresses, static routing tables (`ip route`), and dynamic routing protocols.
* **Switches:** Set FastEthernet/Gigabit port modes (Access vs. Trunk) and assign Access VLANs or allowed trunk trunking ranges.
* **Firewalls:** Define stateless, ordered packet-filtering rules.
* **Departments:** Set end-host counts to calculate required subnet scopes.
* **WAN:** Manage external ISP internet uplink interfaces.

### 3. Layer 2/3 Routing Simulation Engine
* **Longest Prefix Match (LPM):** Automatically selects the best route path in order of precedence: Directly Connected (`DIRECT`) > Static Routes (`STATIC`) > Dynamic Routes (`OSPF`).
* **Dynamic OSPF Routing:** Transitive Link-State Advertisement (LSA) route exchange between routers in the same area. Builds adjacencies and updates local routing tables dynamically using Dijkstra's Shortest Path First (SPF) algorithm.
* **VLAN-Aware L2 Switching:** Tracks active VLAN tags as packets travel across Access and Trunk ports, avoiding L2 loops and blocking unauthorized cross-VLAN packets.
* **Diagnostic Trace & Hops:** Simulates packet trace paths step-by-step with explicit TTL limits, detecting routing loops, blackholes, and unconfigured links.

### 4. Interactive Diagnostics & Dijkstra Simulation
* **One-Tap Path Tracer:** Select a source and destination node on the graph canvas to trace the route.
* **Visual Path Overlay:** Draws a highlighted path directly on the visual graph diagram.
* **Step-by-Step Diagnostics:** Slides up a detailed Path Result Bottom Sheet displaying every hop name, ingress/egress interface, routing type (L2, DIRECT, STATIC, OSPF), and subnet scope.

### 5. Topology Validation & Conflict Detector
* **Cycle Detection:** Identifies routing loops before deploying configurations.
* **Subnet Overlap Checker:** Alerts if custom or calculated IP address blocks overlap.
* **Connectivity Inspector:** Flags isolated subnets or hardware nodes.
* **VLAN Tag Validator:** Detects trunking configurations or access VLAN mismatches.
* **Floating Warning Overlay:** Displays active warnings on the graph that expand into a detailed conflict list modal.

### 6. Stateless Firewall ACL Engine
* **Ordered Sequence Rules:** Evaluates packet headers against a sequence-ordered list of firewall rules.
* **Protocol & Port Checks:** Permits or denies packets based on source/destination CIDR, protocol (IP, TCP, UDP, ICMP), and destination port (e.g. TCP Port 80 for HTTP).
* **Implicit Deny:** Simulates standard enterprise security policies by applying an implicit `deny ip any any` at the end of the rule list.

### 7. Cisco CLI Configuration Exporter
* **Vendor-Specific Configs:** Auto-generates complete, syntax-accurate Cisco IOS CLI scripts.
* **Comprehensive Commands:** Outputs interface `ip address` lines, `router ospf` blocks, named access-lists, `switchport mode trunk` declarations, and `ip default-gateway` configurations.
* **Seamless Sharing:** Export scripts via copy-to-clipboard or share directly as a `.txt` file using the OS Native Share Sheet (`expo-sharing`).

### 8. Enterprise Offline-First Architecture
* **Local Persistence:** Local-first synchronization utilizing `AsyncStorage` to ensure user edits and configurations are saved instantly.
* **Graceful Database Fallback:** Smoothly falls back to local sandbox storage when the Supabase database is unreachable or schema is missing.
* **Dev Sandbox Bypass:** Allows developers to bypass authentication gates using Guest Credentials (`guest@netforge.com` or `*.local` emails) during offline development.

---

## Tech Stack
* **Framework:** React Native (Expo SDK 54 / Expo Router v6)
* **Graphics:** `@shopify/react-native-skia` (Skia 2D Canvas)
* **Gestures:** `react-native-gesture-handler` & `react-native-reanimated`
* **Storage:** `@react-native-async-storage/async-storage` & Supabase JS
* **Icons:** `phosphor-react-native` & Custom SVGs
* **Tests:** Jest & Jest-Expo
* **Type-safety:** TypeScript

---

## Verification
* Run type check: `npx tsc --noEmit`
* Run test suites: `npm test`
