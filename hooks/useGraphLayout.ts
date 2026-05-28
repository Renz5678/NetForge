// useGraphLayout.ts
// Runs d3-force simulation to completion (tick 300 times)
// Returns stable GraphNode[] with x/y positions and GraphEdge[]

import { useMemo } from 'react'
import * as d3 from 'd3-force'
import { detectCycles } from '@/lib/algorithms/cycleDetection'
import { validateConnectivity } from '@/lib/algorithms/bfsValidator'
import type { Department, GraphNode, GraphEdge } from '@/types'

type GraphLayout = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

type D3Node = {
  id: string
  x: number
  y: number
  vx?: number
  vy?: number
}

type D3Link = {
  source: string | D3Node
  target: string | D3Node
}

export function useGraphLayout(
  departments: Department[],
  width: number,
  height: number
): GraphLayout {
  return useMemo(() => {
    if (departments.length === 0) return { nodes: [], edges: [] }

    // Detect cycles and isolated nodes for status coloring
    const { hasCycle, cycle } = detectCycles(departments)
    const { isolated } = validateConnectivity(departments)
    const cycleSet = new Set(cycle)
    const isolatedSet = new Set(isolated)

    // Build d3 nodes
    const d3Nodes: D3Node[] = departments.map((d) => ({
      id: d.id,
      x: width / 2 + (Math.random() - 0.5) * 100,
      y: height / 2 + (Math.random() - 0.5) * 100,
    }))

    // Build d3 links
    const d3Links: D3Link[] = []
    for (const dept of departments) {
      for (const peerId of dept.peers) {
        if (departments.find((d) => d.id === peerId)) {
          d3Links.push({ source: dept.id, target: peerId })
        }
      }
    }

    // Create simulation
    const simulation = d3
      .forceSimulation<D3Node>(d3Nodes)
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Link>(d3Links)
          .id((n) => n.id)
          .distance(180)
          .strength(0.5)
      )
      .force('charge', d3.forceManyBody<D3Node>().strength(-400))
      .force('center', d3.forceCenter<D3Node>(width / 2, height / 2))
      .force('collision', d3.forceCollide<D3Node>(95))
      .stop()

    // Run to completion
    simulation.tick(300)

    // Map to GraphNode[]
    const idToName = new Map(departments.map((d) => [d.id, d.name]))
    const idToSubnet = new Map(departments.map((d) => [d.id, d.subnet ?? '—']))
    const idToVlan = new Map(departments.map((d) => [d.id, d.vlanId ?? 0]))
    const idToType = new Map(departments.map((d) => [d.id, d.type ?? 'department']))

    const nodes: GraphNode[] = d3Nodes.map((n) => {
      const name = idToName.get(n.id) ?? n.id
      let status: GraphNode['status'] = 'valid'
      if (hasCycle && cycleSet.has(name)) status = 'cycle'
      else if (isolatedSet.has(name)) status = 'isolated'

      return {
        id: n.id,
        label: name,
        subnet: idToSubnet.get(n.id) ?? '—',
        vlanId: idToVlan.get(n.id) ?? 0,
        x: n.x,
        y: n.y,
        status,
        type: idToType.get(n.id),
      }
    })

    // Map edges using resolved node positions
    const edges: GraphEdge[] = d3Links.map((link) => ({
      source: typeof link.source === 'string' ? link.source : (link.source as D3Node).id,
      target: typeof link.target === 'string' ? link.target : (link.target as D3Node).id,
    }))

    return { nodes, edges }
  }, [departments, width, height])
}
