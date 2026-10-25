import type { Node as FlowNode, Edge as FlowEdge } from "@xyflow/react";
import type { Lab, LabNode, NodeTypeDef } from "@network-lab-studio/shared-types";

export interface DeviceNodeData {
  label: string;
  nodeTypeName: string;
  ports: LabNode["ports"];
  [key: string]: unknown;
}

export function toFlowNodes(lab: Lab): FlowNode<DeviceNodeData>[] {
  const typeById = new Map(lab.nodeTypes.map((t) => [t.id, t] as const));
  return lab.nodes.map((node) => {
    const nodeType: NodeTypeDef | undefined = typeById.get(node.nodeTypeId);
    return {
      id: node.id,
      type: "device",
      position: node.position,
      data: {
        label: node.label,
        nodeTypeName: nodeType?.name ?? "Unknown type",
        ports: node.ports,
      },
    };
  });
}

export function toFlowEdges(lab: Lab): FlowEdge[] {
  return lab.links.map((link) => ({
    id: link.id,
    source: link.a.nodeId,
    sourceHandle: link.a.portId,
    target: link.b.nodeId,
    targetHandle: link.b.portId,
  }));
}
