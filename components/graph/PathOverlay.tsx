// PathOverlay.tsx
// Highlights edges that are part of the Dijkstra shortest path.

import React from 'react'
import { GraphEdgeComponent } from './GraphEdge'
import type { GraphNode, GraphEdge } from '@/types'

type PathOverlayProps = {
  path: string[]
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export function PathOverlay({ path, nodes, edges }: PathOverlayProps) {
  if (path.length < 2) return null

  // Build set of path edges
  const pathEdges = new Set<string>()
  for (let i = 0; i < path.length - 1; i++) {
    pathEdges.add(`${path[i]}→${path[i + 1]}`)
  }

  const highlightedEdges = edges.filter((e) => pathEdges.has(`${e.source}→${e.target}`))

  return (
    <>
      {highlightedEdges.map((edge, i) => (
        <GraphEdgeComponent key={i} edge={edge} nodes={nodes} highlighted />
      ))}
    </>
  )
}
