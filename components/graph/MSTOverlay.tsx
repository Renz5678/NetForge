// MSTOverlay.tsx
// Renders the Minimum Spanning Tree edge overlay on the Skia canvas.
// MST edges are drawn as green dashed thick strokes on top of normal topology edges.
// Only active during Prim's algorithm visualization.

import React from 'react'
import { Path } from '@shopify/react-native-skia'
import { Colors } from '@/constants/colors'
import type { GraphNode, MSTEdge } from '@/types'

const MST_STROKE_WIDTH = 3.5
const NODE_HALF_W = 68  // half of NODE_WIDTH (136)
const NODE_HALF_H = 26  // half of NODE_HEIGHT (52)
const ARROW_SIZE = 10

function getMSTEdgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)
  if (length === 0) return ''

  const ux = dx / length
  const uy = dy / length

  const startX = x1 + ux * NODE_HALF_W
  const startY = y1 + uy * NODE_HALF_H
  const endX = x2 - ux * (NODE_HALF_W + ARROW_SIZE)
  const endY = y2 - uy * (NODE_HALF_H + ARROW_SIZE)

  return `M ${startX} ${startY} L ${endX} ${endY}`
}

type MSTOverlayProps = {
  mstEdges: MSTEdge[]
  nodes: GraphNode[]
  candidateEdge?: { source: string; target: string; weight: number } | null
}

export function MSTOverlay({ mstEdges, nodes, candidateEdge }: MSTOverlayProps) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return (
    <>
      {/* Accepted MST edges — green thick dashed stroke */}
      {mstEdges.map((edge, i) => {
        const src = nodeMap.get(edge.source)
        const tgt = nodeMap.get(edge.target)
        if (!src || !tgt) return null
        const pathData = getMSTEdgePath(src.x, src.y, tgt.x, tgt.y)
        if (!pathData) return null

        return (
          <Path
            key={`mst-${i}`}
            path={pathData}
            color={Colors.vizMstEdge}
            style="stroke"
            strokeWidth={MST_STROKE_WIDTH}
            strokeCap="round"
          />
        )
      })}

      {/* Candidate edge — yellow highlight showing edge being considered */}
      {candidateEdge && (() => {
        const src = nodeMap.get(candidateEdge.source)
        const tgt = nodeMap.get(candidateEdge.target)
        if (!src || !tgt) return null
        const pathData = getMSTEdgePath(src.x, src.y, tgt.x, tgt.y)
        if (!pathData) return null

        return (
          <Path
            path={pathData}
            color={Colors.vizCandidate}
            style="stroke"
            strokeWidth={2.5}
            strokeCap="round"
          />
        )
      })()}
    </>
  )
}
