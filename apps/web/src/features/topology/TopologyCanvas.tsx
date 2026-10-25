import { useCallback, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BUILTIN_NODE_TYPES } from "./builtinNodeTypes";
import { nodeTypes } from "./DeviceNode";
import { toFlowEdges, toFlowNodes, type DeviceNodeData } from "./adapters";
import { useLabStore } from "./useLabStore";
import { PALETTE_DRAG_MIME } from "./DevicePalette";
import { useConsoleDockStore } from "../console/useConsoleDockStore";

function TopologyCanvasInner() {
  const lab = useLabStore((s) => s.lab);
  const addNode = useLabStore((s) => s.addNode);
  const removeNode = useLabStore((s) => s.removeNode);
  const updateNodePosition = useLabStore((s) => s.updateNodePosition);
  const addLink = useLabStore((s) => s.addLink);
  const removeLink = useLabStore((s) => s.removeLink);
  const openConsole = useConsoleDockStore((s) => s.open);
  const selectNode = useLabStore((s) => s.selectNode);

  const rfInstanceRef = useRef<ReactFlowInstance<Node<DeviceNodeData>, Edge> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const flowNodes = useMemo(() => (lab ? toFlowNodes(lab) : []), [lab]);
  const flowEdges = useMemo(() => (lab ? toFlowEdges(lab) : []), [lab]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, flowNodes);
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          updateNodePosition(change.id, change.position);
        } else if (change.type === "remove") {
          removeNode(change.id);
        }
      }
      void next; // React Flow view state is derived from the store; this keeps intent explicit.
    },
    [flowNodes, updateNodePosition, removeNode],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      applyEdgeChanges(changes, flowEdges);
      for (const change of changes) {
        if (change.type === "remove") {
          removeLink(change.id);
        }
      }
    },
    [flowEdges, removeLink],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.sourceHandle || !connection.targetHandle) return;
      addLink(
        { nodeId: connection.source, portId: connection.sourceHandle },
        { nodeId: connection.target, portId: connection.targetHandle },
      );
    },
    [addLink],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeTypeId = event.dataTransfer.getData(PALETTE_DRAG_MIME);
      const nodeType = BUILTIN_NODE_TYPES.find((nt) => nt.id === nodeTypeId);
      if (!nodeType || !rfInstanceRef.current || !wrapperRef.current) return;
      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = rfInstanceRef.current.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      addNode(nodeType, position);
    },
    [addNode],
  );

  const onNodeDoubleClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      openConsole(node.id);
    },
    [openConsole],
  );

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      selectNode(node.id);
    },
    [selectNode],
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  return (
    <div ref={wrapperRef} style={{ flex: 1, height: "100%" }} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={(instance) => {
          rfInstanceRef.current = instance;
        }}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

export function TopologyCanvas() {
  return (
    <ReactFlowProvider>
      <TopologyCanvasInner />
    </ReactFlowProvider>
  );
}
