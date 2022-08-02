import { Node, INodeBase, INodePosition, DEFAULT_NODE_PROPERTIES } from './node';
import { DEFAULT_EDGE_PROPERTIES, Edge, IEdgeBase } from './edge';
import { IRectangle } from '../common/rectangle';
import { IPosition } from '../common/position';
import { IGraphStyle } from './style';
import { ImageHandler } from '../services/images';
import { ISimulationEdge } from '../simulator/interface';
import { getEdgeOffsets } from './topology';

export interface IGraphData<N extends INodeBase, E extends IEdgeBase> {
  nodes: N[];
  edges: E[];
}

type IEdgeFilter<N extends INodeBase, E extends IEdgeBase> = (edge: Edge<N, E>) => boolean;

type INodeFilter<N extends INodeBase, E extends IEdgeBase> = (node: Node<N, E>) => boolean;

export class Graph<N extends INodeBase, E extends IEdgeBase> {
  protected nodeById: { [id: number]: Node<N, E> } = {};
  protected edgeById: { [id: number]: Edge<N, E> } = {};

  private style?: Partial<IGraphStyle<N, E>>;

  constructor(data?: Partial<IGraphData<N, E>>) {
    const nodes = data?.nodes ?? [];
    const edges = data?.edges ?? [];
    this.setup({ nodes, edges });
  }

  /**
   * Returns a list of nodes.
   *
   * @param {INodeFilter} filterBy Filter function for nodes
   * @return {Node[]} List of nodes
   */
  getNodes(filterBy?: INodeFilter<N, E>): Node<N, E>[] {
    const nodes = Object.values(this.nodeById);
    if (!filterBy) {
      return nodes;
    }

    const filteredNodes: Node<N, E>[] = [];
    for (let i = 0; i < nodes.length; i++) {
      if (filterBy(nodes[i])) {
        filteredNodes.push(nodes[i]);
      }
    }
    return filteredNodes;
  }

  /**
   * Returns a list of edges.
   *
   * @param {IEdgeFilter} filterBy Filter function for edges
   * @return {Edge[]} List of edges
   */
  getEdges(filterBy?: IEdgeFilter<N, E>): Edge<N, E>[] {
    const edges = Object.values(this.edgeById);
    if (!filterBy) {
      return edges;
    }

    const filteredEdges: Edge<N, E>[] = [];
    for (let i = 0; i < edges.length; i++) {
      if (filterBy(edges[i])) {
        filteredEdges.push(edges[i]);
      }
    }
    return filteredEdges;
  }

  /**
   * Returns the total node count.
   *
   * @return {number} Total node count
   */
  getNodeCount(): number {
    return Object.keys(this.nodeById).length;
  }

  /**
   * Returns the total edge count.
   *
   * @return {number} Total edge count
   */
  getEdgeCount(): number {
    return Object.keys(this.edgeById).length;
  }

  /**
   * Returns node by node id.
   *
   * @param {number} id Node id
   * @return {Node | undefined} Node or undefined
   */
  getNodeById(id: number): Node<N, E> | undefined {
    return this.nodeById[id];
  }

  /**
   * Returns edge by edge id.
   *
   * @param {number} id Edge id
   * @return {Edge | undefined} Edge or undefined
   */
  getEdgeById(id: number): Edge<N, E> | undefined {
    return this.edgeById[id];
  }

  /**
   * Returns a list of current node positions.
   *
   * @return {INodePosition[]} List of node positions
   */
  getNodePositions(): INodePosition[] {
    const nodes = this.getNodes();
    const positions: INodePosition[] = new Array<INodePosition>(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      positions[i] = nodes[i].position;
    }
    return positions;
  }

  setNodePositions(positions: INodePosition[]) {
    for (let i = 0; i < positions.length; i++) {
      const node = this.nodeById[positions[i].id];
      if (node) {
        node.position = positions[i];
      }
    }
  }

  setEdgePositions(positions: ISimulationEdge[]) {
    for (let i = 0; i < positions.length; i++) {
      const edge = this.edgeById[positions[i].id];
      if (edge) {
        edge.position = positions[i];
      }
    }
  }

  getEdgePositions(): ISimulationEdge[] {
    const edges = this.getEdges();
    const positions: ISimulationEdge[] = new Array<ISimulationEdge>(edges.length);
    for (let i = 0; i < edges.length; i++) {
      const position = edges[i].position;
      if (position) {
        positions[i] = position;
      }
    }
    return positions;
  }

  setStyle(style: Partial<IGraphStyle<N, E>>) {
    this.style = style;
    const styleImageUrls: Set<string> = new Set<string>();

    const nodes = this.getNodes();
    for (let i = 0; i < nodes.length; i++) {
      const properties = style.getNodeStyle?.(nodes[i]);
      if (properties) {
        nodes[i].properties = properties;
        // TODO @toni: Add these checks for any property setup (maybe to the node itself) - check below
        if (properties.imageUrl) {
          styleImageUrls.add(properties.imageUrl);
        }
        if (properties.imageUrlSelected) {
          styleImageUrls.add(properties.imageUrlSelected);
        }
      }
    }

    const edges = this.getEdges();
    for (let i = 0; i < edges.length; i++) {
      const properties = style.getEdgeStyle?.(edges[i]);
      if (properties) {
        edges[i].properties = properties;
      }
    }

    if (styleImageUrls.size) {
      ImageHandler.getInstance().loadImages(Array.from(styleImageUrls), () => {
        // TODO @toni: Either call internal render or an event for the user to rerender
        // TODO @toni: Or orb can use the singleton of ImageHandler and listen for new images
      });
    }
  }

  /**
   * Sets default style to nodes and edges.
   */
  setDefaultStyle() {
    this.style = undefined;

    const nodes = this.getNodes();
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].properties = DEFAULT_NODE_PROPERTIES;
    }

    const edges = this.getEdges();
    for (let i = 0; i < edges.length; i++) {
      edges[i].properties = DEFAULT_EDGE_PROPERTIES;
    }
  }

  setup(data: Partial<IGraphData<N, E>>) {
    this.nodeById = {};
    this.edgeById = {};

    const nodes = data?.nodes ?? [];
    const edges = data?.edges ?? [];

    this._insertNodes(nodes);
    this._insertEdges(edges);

    this._applyEdgeOffsets();
    this._applyStyle();
  }

  join(data: Partial<IGraphData<N, E>>) {
    const nodes = data.nodes ?? [];
    const edges = data.edges ?? [];

    this._upsertNodes(nodes);
    this._upsertEdges(edges);

    this._applyEdgeOffsets();
    this._applyStyle();
  }

  hide(data: Partial<{ nodeIds: number[]; edgeIds: number[] }>) {
    const nodeIds = data.nodeIds ?? [];
    const edgeIds = data.edgeIds ?? [];

    this._removeNodes(nodeIds);
    this._removeEdges(edgeIds);

    this._applyEdgeOffsets();
    this._applyStyle();
  }

  isEqual<T extends INodeBase, K extends IEdgeBase>(graph: Graph<T, K>): boolean {
    if (this.getNodeCount() !== graph.getNodeCount()) {
      return false;
    }

    if (this.getEdgeCount() !== graph.getEdgeCount()) {
      return false;
    }

    const nodes = this.getNodes();
    for (let i = 0; i < nodes.length; i++) {
      if (!graph.getNodeById(nodes[i].id)) {
        return false;
      }
    }

    const edges = this.getEdges();
    for (let i = 0; i < edges.length; i++) {
      if (!graph.getEdgeById(edges[i].id)) {
        return false;
      }
    }

    return true;
  }

  getBoundingBox(): IRectangle {
    const nodes = this.getNodes();
    const minPoint: IPosition = { x: 0, y: 0 };
    const maxPoint: IPosition = { x: 0, y: 0 };

    for (let i = 0; i < nodes.length; i++) {
      const { x, y } = nodes[i].getCenter();

      if (x === undefined || y === undefined) {
        continue;
      }

      const size = nodes[i].getBorderedRadius();

      if (i === 0) {
        minPoint.x = x - size;
        maxPoint.x = x + size;
        minPoint.y = y - size;
        maxPoint.y = y + size;
        continue;
      }

      if (x + size > maxPoint.x) {
        maxPoint.x = x + size;
      }
      if (x - size < minPoint.x) {
        minPoint.x = x - size;
      }
      if (y + size > maxPoint.y) {
        maxPoint.y = y + size;
      }
      if (y - size < minPoint.y) {
        minPoint.y = y - size;
      }
    }

    return {
      x: minPoint.x,
      y: minPoint.y,
      width: Math.abs(maxPoint.x - minPoint.x),
      height: Math.abs(maxPoint.y - minPoint.y),
    };
  }

  getNearestNode(point: IPosition): Node<N, E> | undefined {
    // Reverse is needed to check from the top drawn to the bottom drawn node
    const nodes = this.getNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].includesPoint(point)) {
        return nodes[i];
      }
    }
  }

  getNearestEdge(point: IPosition, minDistance = 3): Edge<N, E> | undefined {
    let nearestEdge: Edge<N, E> | undefined;
    let nearestDistance = minDistance;

    const edges = this.getEdges();
    for (let i = 0; i < edges.length; i++) {
      const distance = edges[i].getDistance(point);
      if (distance <= nearestDistance) {
        nearestDistance = distance;
        nearestEdge = edges[i];
      }
    }
    return nearestEdge;
  }

  private _insertNodes(nodes: N[]) {
    for (let i = 0; i < nodes.length; i++) {
      const node = new Node<N, E>({ data: nodes[i] });
      this.nodeById[node.id] = node;
    }
  }

  private _insertEdges(edges: E[]) {
    for (let i = 0; i < edges.length; i++) {
      const edge = new Edge<N, E>({ data: edges[i] });

      const startNode = this.getNodeById(edge.start);
      const endNode = this.getNodeById(edge.end);

      if (startNode && endNode) {
        edge.connect(startNode, endNode);
        this.edgeById[edge.id] = edge;
      }
    }
  }

  private _upsertNodes(nodes: N[]) {
    for (let i = 0; i < nodes.length; i++) {
      const existingNode = this.getNodeById(nodes[i].id);
      if (existingNode) {
        existingNode.data = nodes[i];
        continue;
      }

      const node = new Node<N, E>({ data: nodes[i] });
      this.nodeById[node.id] = node;
    }
  }

  private _upsertEdges(edges: E[]) {
    for (let i = 0; i < edges.length; i++) {
      const existingEdge = this.getEdgeById(edges[i].id);
      if (existingEdge) {
        const newEdge = edges[i];

        if (existingEdge.start !== newEdge.start || existingEdge.end !== newEdge.end) {
          existingEdge.disconnect();
          delete this.edgeById[existingEdge.id];

          const startNode = this.getNodeById(newEdge.start);
          const endNode = this.getNodeById(newEdge.end);

          if (startNode && endNode) {
            existingEdge.connect(startNode, endNode);
            this.edgeById[existingEdge.id] = existingEdge;
          }
        }

        existingEdge.data = newEdge;
        continue;
      }

      const edge = new Edge<N, E>({ data: edges[i] });
      const startNode = this.getNodeById(edge.start);
      const endNode = this.getNodeById(edge.end);

      if (startNode && endNode) {
        edge.connect(startNode, endNode);
        this.edgeById[edge.id] = edge;
      }
    }
  }

  private _removeNodes(nodeIds: number[]) {
    for (let i = 0; i < nodeIds.length; i++) {
      const node = this.getNodeById(nodeIds[i]);
      if (!node) {
        continue;
      }

      const edges = node.getEdges();
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        edge.disconnect();
        delete this.edgeById[edge.id];
      }

      delete this.nodeById[node.id];
    }
  }

  private _removeEdges(edgeIds: number[]) {
    for (let i = 0; i < edgeIds.length; i++) {
      const edge = this.getEdgeById(edgeIds[i]);
      if (!edge) {
        continue;
      }

      edge.disconnect();
      delete this.edgeById[edge.id];
    }
  }

  private _applyEdgeOffsets() {
    const graphEdges = this.getEdges();
    const edgeOffsets = getEdgeOffsets<N, E>(graphEdges);
    for (let i = 0; i < edgeOffsets.length; i++) {
      const edge = graphEdges[i];
      const edgeOffset = edgeOffsets[i];
      this.edgeById[edge.id] = edge.copy({ offset: edgeOffset });
    }
  }

  private _applyStyle() {
    if (this.style?.getNodeStyle) {
      const newNodes = this.getNodes();
      for (let i = 0; i < newNodes.length; i++) {
        const properties = this.style.getNodeStyle(newNodes[i]);
        if (properties) {
          newNodes[i].properties = properties;
        }
      }
    }

    if (this.style?.getEdgeStyle) {
      const newEdges = this.getEdges();
      for (let i = 0; i < newEdges.length; i++) {
        const properties = this.style.getEdgeStyle(newEdges[i]);
        if (properties) {
          newEdges[i].properties = properties;
        }
      }
    }
  }
}
