'use client';
import { useRef, useCallback, useEffect } from 'react';

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
  const workerRef = useRef<Worker | null>(null);
  const resolveRef = useRef<((result: LayoutResult) => void) | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../elk-worker.ts', import.meta.url)
    );
    workerRef.current.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'layout' && resolveRef.current) {
        resolveRef.current(event.data.result);
        resolveRef.current = null;
      }
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const computeLayout = useCallback(
    (nodes: ElkNode[], edges: ElkEdge[], options?: Record<string, string>): Promise<LayoutResult> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        workerRef.current?.postMessage({ nodes, edges, options });
      });
    },
    []
  );

  return { computeLayout };
}
