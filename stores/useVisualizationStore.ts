// useVisualizationStore.ts
// Zustand store for algorithm visualization playback state.
// Completely separate from useConfigStore — no cross-contamination.
// The store holds the pre-computed step snapshot array and manages
// playback cursor, speed, and auto-play timing.

import { create } from 'zustand'
import type { VisualizationStep, AlgorithmType, MSTEdge } from '@/types'

type Speed = 'slow' | 'normal' | 'fast'

// Milliseconds between automatic step advances per speed setting
export const SPEED_MS: Record<Speed, number> = {
  slow: 1200,
  normal: 600,
  fast: 200,
}

type VisualizationStore = {
  // ── State ──────────────────────────────────────────────────────────────────
  isActive: boolean
  algorithm: AlgorithmType | null
  steps: VisualizationStep[]
  currentStepIndex: number
  isPlaying: boolean
  speed: Speed
  isExpanded: boolean

  // Source/target for path-finding algorithms (Dijkstra, A*)
  sourceId: string | null
  targetId: string | null

  // Root node for Prim's MST
  rootId: string | null

  // For A* comparison panel: Dijkstra visited set
  dijkstraVisited: Set<string>
  astarVisited: Set<string>

  // ── Derived ────────────────────────────────────────────────────────────────
  currentStep: VisualizationStep | null

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Toggle the detailed data structure view. */
  setIsExpanded: (expanded: boolean) => void

  /** Start a new visualization with a pre-computed step array. */
  startVisualization: (
    algorithm: AlgorithmType,
    steps: VisualizationStep[],
    options?: {
      sourceId?: string
      targetId?: string
      rootId?: string
      dijkstraVisited?: Set<string>
      astarVisited?: Set<string>
    }
  ) => void

  /** Dismiss the visualizer and reset all state. */
  stopVisualization: () => void

  /** Begin auto-playing from the current step. */
  play: () => void

  /** Pause auto-play. */
  pause: () => void

  /** Advance one step forward. Pauses if playing. */
  stepForward: () => void

  /** Go back one step. Pauses if playing. */
  stepBack: () => void

  /** Jump to an arbitrary step index. */
  setStep: (index: number) => void

  /** Change playback speed. */
  setSpeed: (speed: Speed) => void

  // Internal: called by the auto-play timer
  _advanceStep: () => void
}

export const useVisualizationStore = create<VisualizationStore>((set, get) => ({
  // Initial state
  isActive: false,
  algorithm: null,
  steps: [],
  currentStepIndex: 0,
  isPlaying: false,
  speed: 'normal',
  isExpanded: true,
  sourceId: null,
  targetId: null,
  rootId: null,
  dijkstraVisited: new Set(),
  astarVisited: new Set(),

  get currentStep() {
    const { steps, currentStepIndex } = get()
    return steps[currentStepIndex] ?? null
  },

  setIsExpanded: (isExpanded) => {
    set({ isExpanded })
  },

  startVisualization: (algorithm, steps, options = {}) => {
    set({
      isActive: true,
      algorithm,
      steps,
      currentStepIndex: 0,
      isPlaying: false,
      isExpanded: true,
      sourceId: options.sourceId ?? null,
      targetId: options.targetId ?? null,
      rootId: options.rootId ?? null,
      dijkstraVisited: options.dijkstraVisited ?? new Set(),
      astarVisited: options.astarVisited ?? new Set(),
    })
  },

  stopVisualization: () => {
    set({
      isActive: false,
      algorithm: null,
      steps: [],
      currentStepIndex: 0,
      isPlaying: false,
      isExpanded: true,
      sourceId: null,
      targetId: null,
      rootId: null,
      dijkstraVisited: new Set(),
      astarVisited: new Set(),
    })
  },

  play: () => {
    const { steps, currentStepIndex } = get()
    if (currentStepIndex >= steps.length - 1) {
      // Already at end — restart from beginning
      set({ currentStepIndex: 0, isPlaying: true })
    } else {
      set({ isPlaying: true })
    }
  },

  pause: () => {
    set({ isPlaying: false })
  },

  stepForward: () => {
    const { steps, currentStepIndex } = get()
    if (currentStepIndex < steps.length - 1) {
      set({ currentStepIndex: currentStepIndex + 1, isPlaying: false })
    }
  },

  stepBack: () => {
    const { currentStepIndex } = get()
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1, isPlaying: false })
    }
  },

  setStep: (index) => {
    const { steps } = get()
    const clamped = Math.max(0, Math.min(index, steps.length - 1))
    set({ currentStepIndex: clamped, isPlaying: false })
  },

  setSpeed: (speed) => {
    set({ speed })
  },

  _advanceStep: () => {
    const { steps, currentStepIndex, isPlaying } = get()
    if (!isPlaying) return
    if (currentStepIndex >= steps.length - 1) {
      // Reached end — stop auto-play
      set({ isPlaying: false })
      return
    }
    set({ currentStepIndex: currentStepIndex + 1 })
  },
}))
