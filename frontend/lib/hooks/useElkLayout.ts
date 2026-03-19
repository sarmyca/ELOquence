'use client';
import { useCallback, useRef } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';

interface ElkNode {
  id: string;
  width: number;
  height: number;
}

interface ElkEdge {
  id: string;
  source: string;
  target: string;
}

interface LayoutResult {
  children: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  edges: Array<{
    id: string;
    sections?: Array<{
      startPoint: { x: number; y: number };
      endPoint: { x: number; y: number };
      bendPoints?: Array<{ x: number; y: number }>;
    }>;
  }>;
}

export function useElkLayout() {
  const elkRef = useRef(new ELK());

  const computeLayout = useCallback(
    async (nodes: ElkNode[], edges: ElkEdge[], options?: Record<string, string>): Promise<LayoutResult> => {
      const graph = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': '60',
          'elk.layered.spacing.nodeNodeBetweenLayers': '120',
          'elk.spacing.edgeNode': '30',
          'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
          'elk.edgeRouting': 'ORTHOGONAL',
          ...options,
        },
        children: nodes.map((node) => ({
          id: node.id,
          width: node.width || 140,
          height: node.height || 80,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      };

      const result = await elkRef.current.layout(graph);
      return result as LayoutResult;
    },
    []
  );

  return { computeLayout };
}
