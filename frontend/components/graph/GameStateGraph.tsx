'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import GameStateNode, { type GameStateNodeData } from './GameStateNode';
import GuessEdge, { type GuessEdgeData } from './GuessEdge';
import { useElkLayout } from '@/lib/hooks/useElkLayout';
import api from '@/lib/api';

interface GraphData {
  nodes: Array<{
    id: string;
    remaining_count: number;
    entropy: number;
    example_words: string[];
    is_start: boolean;
    is_accept: boolean;
    is_critical_decision: boolean;
    depth: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    guess_word: string;
    pattern: number;
    info_gained: number;
    classification: string;
    is_player_path: boolean;
    is_optimal_path: boolean;
    is_alternative: boolean;
  }>;
  player_path_node_ids: string[];
  optimal_path_node_ids: string[];
}

interface Props {
  gameId: string;
}

const nodeTypes = { gameState: GameStateNode };
const edgeTypes = { guessEdge: GuessEdge };

function GraphInner({ gameId }: Props) {
  const { fitView } = useReactFlow();
  const { computeLayout } = useElkLayout();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GameStateNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<GuessEdgeData>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAlternatives, setShowAlternatives] = useState(true);

  // Explore state
  const [exploreNodeId, setExploreNodeId] = useState<string | null>(null);
  const [exploreGuess, setExploreGuess] = useState('');
  const [exploring, setExploring] = useState(false);

  const graphDataRef = useRef<GraphData | null>(null);

  const applyLayout = useCallback(async (graphData: GraphData) => {
    const playerSet = new Set(graphData.player_path_node_ids);
    const optimalSet = new Set(graphData.optimal_path_node_ids);

    // Prepare ELK nodes
    const elkNodes = graphData.nodes.map((n) => {
      const logSize = Math.max(1, Math.log2(n.remaining_count + 1));
      const maxLog = Math.log2(2400);
      const sizeRatio = logSize / maxLog;
      const w = n.is_accept ? 48 : 90 + sizeRatio * 60;
      const h = n.is_accept ? 48 : 56 + sizeRatio * 30;
      return { id: n.id, width: w, height: h };
    });

    // Filter edges based on alternative visibility
    const visibleEdges = showAlternatives
      ? graphData.edges
      : graphData.edges.filter(e => e.is_player_path || e.is_optimal_path);

    const elkEdges = visibleEdges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
    }));

    // Compute layout via web worker
    const result = await computeLayout(elkNodes, elkEdges);

    // Map positions to React Flow nodes
    const posMap: Record<string, { x: number; y: number }> = {};
    for (const child of result.children || []) {
      posMap[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
    }

    const rfNodes: Node<GameStateNodeData>[] = graphData.nodes
      .filter(n => {
        // If alternatives hidden, only show nodes on player/optimal path
        if (!showAlternatives && !playerSet.has(n.id) && !optimalSet.has(n.id)) return false;
        return true;
      })
      .map((n) => ({
        id: n.id,
        type: 'gameState',
        position: posMap[n.id] || { x: 0, y: 0 },
        data: {
          ...n,
          isPlayerPath: playerSet.has(n.id),
          isOptimalPath: optimalSet.has(n.id),
          onExplore: (nodeId: string) => setExploreNodeId(nodeId),
        },
      }));

    const rfEdges: Edge<GuessEdgeData>[] = visibleEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'guessEdge',
      data: {
        guess_word: e.guess_word,
        pattern: e.pattern,
        info_gained: e.info_gained,
        classification: e.classification,
        is_player_path: e.is_player_path,
        is_optimal_path: e.is_optimal_path,
        is_alternative: e.is_alternative,
      },
    }));

    setNodes(rfNodes);
    setEdges(rfEdges);

    // Smooth fitView after layout
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 600 });
    }, 100);
  }, [computeLayout, fitView, setNodes, setEdges, showAlternatives]);

  // Fetch graph data
  useEffect(() => {
    if (!gameId) return;
    setLoading(true);
    setError('');

    api.post(`/graph/games/${gameId}/build`)
      .then((res) => {
        graphDataRef.current = res.data;
        return applyLayout(res.data);
      })
      .catch((err) => {
        const msg = err?.response?.data?.detail || err?.message || 'Unknown error';
        setError(`Failed to build game graph: ${msg}`);
      })
      .finally(() => setLoading(false));
  }, [gameId]); // applyLayout intentionally excluded to avoid refetch loop

  // Re-layout when alternatives toggle changes
  useEffect(() => {
    if (graphDataRef.current) {
      applyLayout(graphDataRef.current);
    }
  }, [showAlternatives, applyLayout]);

  // Handle explore
  const handleExplore = async () => {
    if (!exploreNodeId || exploreGuess.length !== 5 || exploring) return;
    setExploring(true);
    try {
      const res = await api.post('/graph/explore', {
        state_hash: exploreNodeId,
        guess: exploreGuess,
      });
      const { new_node, edge } = res.data;

      // Add to graph data
      if (graphDataRef.current) {
        const existing = graphDataRef.current.nodes.find(n => n.id === new_node.id);
        if (!existing) {
          graphDataRef.current.nodes.push(new_node);
        }
        graphDataRef.current.edges.push(edge);
        await applyLayout(graphDataRef.current);
      }

      setExploreGuess('');
      setExploreNodeId(null);
    } catch {
      // Could show error
    } finally {
      setExploring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-[#538d4e] border-t-transparent animate-spin" />
          <span className="text-xs text-text-secondary">Building game graph...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[500px] text-sm text-text-ghost">
        {error}
      </div>
    );
  }

  return (
    <div className="relative" style={{ height: 500 }}>
      {/* Controls bar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          onClick={() => setShowAlternatives(!showAlternatives)}
          className={`text-[10px] font-medium px-2.5 py-1 rounded-md border transition-colors ${
            showAlternatives
              ? 'bg-bg-elevated border-white/[0.15] text-text-primary'
              : 'bg-bg-tertiary border-white/[0.08] text-text-secondary'
          }`}
        >
          {showAlternatives ? 'Hide' : 'Show'} Alternatives
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-3 bg-bg-primary/80 backdrop-blur-sm rounded-md px-2.5 py-1.5 border border-white/[0.06]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }} />
          <span className="text-[9px] text-text-ghost">Player</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 rounded-full border-t border-dashed border-[#538d4e]" />
          <span className="text-[9px] text-text-ghost">Optimal</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 rounded-full bg-white/10" />
          <span className="text-[9px] text-text-ghost">Alternative</span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: '#0f1012' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.04)" />
        <Controls
          showInteractive={false}
          style={{ backgroundColor: '#16171a', borderColor: 'rgba(255,255,255,0.1)' }}
        />
      </ReactFlow>

      {/* Explore modal */}
      <AnimatePresence>
        {exploreNodeId && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-bg-elevated border border-white/[0.12] rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3"
          >
            <Search size={14} className="text-text-ghost shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-text-ghost uppercase tracking-wider">
                Explore from state
              </span>
              <input
                type="text"
                value={exploreGuess}
                onChange={(e) => setExploreGuess(e.target.value.toUpperCase().slice(0, 5))}
                onKeyDown={(e) => e.key === 'Enter' && handleExplore()}
                placeholder="WORD"
                maxLength={5}
                className="bg-bg-tertiary border border-white/[0.1] rounded-md px-2 py-1 text-sm font-mono uppercase text-text-primary w-20 focus:outline-none focus:border-[#538d4e]/50"
                autoFocus
              />
            </div>
            <button
              onClick={handleExplore}
              disabled={exploreGuess.length !== 5 || exploring}
              className="px-3 py-1.5 rounded-md bg-[#538d4e] hover:bg-[#6aaa64] text-white text-xs font-medium disabled:opacity-40 transition-colors"
            >
              {exploring ? '...' : 'Go'}
            </button>
            <button
              onClick={() => { setExploreNodeId(null); setExploreGuess(''); }}
              className="p-1 rounded-md text-text-ghost hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GameStateGraph({ gameId }: Props) {
  return (
    <ReactFlowProvider>
      <GraphInner gameId={gameId} />
    </ReactFlowProvider>
  );
}
