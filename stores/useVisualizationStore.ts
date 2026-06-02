import { create } from 'zustand'
import type { VisualizationStep, AlgorithmType } from '@/types'

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
  currentStepIndex: number
  totalSteps: number
  currentStep: VisualizationStep | null
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

  showSteps: boolean

  // ── Actions ────────────────────────────────────────────────────────────────
  setIsExpanded: (expanded: boolean) => void
  setShowSteps: (show: boolean) => void
  startVisualization: (
    algorithm: AlgorithmType,
    steps: VisualizationStep[],
    options?: {
      sourceId?: string
      targetId?: string
      rootId?: string
      dijkstraVisited?: Set<string>
      astarVisited?: Set<string>
      showSteps?: boolean
    }
  ) => void
  stopVisualization: () => void
  play: () => void
  pause: () => void
  stepForward: () => void
  stepBack: () => void
  setStep: (index: number) => void
  setSpeed: (speed: Speed) => void
  _advanceStep: () => void
}

// Module-level non-reactive cache for large steps array to optimize performance
let visualizerSteps: VisualizationStep[] = []

export const useVisualizationStore = create<VisualizationStore>((set, get) => ({
  // Initial state
  isActive: false,
  algorithm: null,
  currentStepIndex: 0,
  totalSteps: 0,
  currentStep: null,
  isPlaying: false,
  speed: 'normal',
  isExpanded: true,
  showSteps: false,
  sourceId: null,
  targetId: null,
  rootId: null,
  dijkstraVisited: new Set(),
  astarVisited: new Set(),

  setIsExpanded: (isExpanded) => {
    set({ isExpanded })
  },

  setShowSteps: (showSteps) => {
    set({ showSteps })
  },

  startVisualization: (algorithm, steps, options = {}) => {
    const showSteps = options.showSteps ?? false
    visualizerSteps = steps
    set({
      isActive: true,
      algorithm,
      currentStepIndex: 0,
      totalSteps: steps.length,
      currentStep: steps[0] ?? null,
      isPlaying: !showSteps, // Autoplay if steps are not shown
      isExpanded: showSteps,
      showSteps,
      sourceId: options.sourceId ?? null,
      targetId: options.targetId ?? null,
      rootId: options.rootId ?? null,
      dijkstraVisited: options.dijkstraVisited ?? new Set(),
      astarVisited: options.astarVisited ?? new Set(),
    })
  },

  stopVisualization: () => {
    visualizerSteps = []
    set({
      isActive: false,
      algorithm: null,
      currentStepIndex: 0,
      totalSteps: 0,
      currentStep: null,
      isPlaying: false,
      isExpanded: true,
      showSteps: false,
      sourceId: null,
      targetId: null,
      rootId: null,
      dijkstraVisited: new Set(),
      astarVisited: new Set(),
    })
  },

  play: () => {
    const { totalSteps, currentStepIndex } = get()
    if (currentStepIndex >= totalSteps - 1) {
      // Already at end — restart from beginning
      set({
        currentStepIndex: 0,
        currentStep: visualizerSteps[0] ?? null,
        isPlaying: true,
      })
    } else {
      set({ isPlaying: true })
    }
  },

  pause: () => {
    set({ isPlaying: false })
  },

  stepForward: () => {
    const { currentStepIndex, totalSteps } = get()
    if (currentStepIndex < totalSteps - 1) {
      const nextIndex = currentStepIndex + 1
      set({
        currentStepIndex: nextIndex,
        currentStep: visualizerSteps[nextIndex] ?? null,
        isPlaying: false,
      })
    }
  },

  stepBack: () => {
    const { currentStepIndex } = get()
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1
      set({
        currentStepIndex: prevIndex,
        currentStep: visualizerSteps[prevIndex] ?? null,
        isPlaying: false,
      })
    }
  },

  setStep: (index) => {
    const { totalSteps } = get()
    const clamped = Math.max(0, Math.min(index, totalSteps - 1))
    set({
      currentStepIndex: clamped,
      currentStep: visualizerSteps[clamped] ?? null,
      isPlaying: false,
    })
  },

  setSpeed: (speed) => {
    set({ speed })
  },

  _advanceStep: () => {
    const { currentStepIndex, totalSteps, isPlaying } = get()
    if (!isPlaying) return
    if (currentStepIndex >= totalSteps - 1) {
      // Reached end — stop auto-play
      set({ isPlaying: false })
      return
    }
    const nextIndex = currentStepIndex + 1
    set({
      currentStepIndex: nextIndex,
      currentStep: visualizerSteps[nextIndex] ?? null,
    })
  },
}))
