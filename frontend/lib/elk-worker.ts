import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

self.onmessage = async (event: MessageEvent) => {
  const { nodes, edges, options } = event.data;

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
    children: nodes.map((node: any) => ({
      id: node.id,
      width: node.width || 140,
      height: node.height || 80,
    })),
    edges: edges.map((edge: any) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  try {
    const result = await elk.layout(graph);
    self.postMessage({ type: 'layout', result });
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) });
  }
};
