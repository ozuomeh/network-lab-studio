import type { LabNode, NodeTypeDef } from "@network-lab-studio/shared-types";

export interface RunningNodeHandle {
  nodeId: string;
  kind: "docker" | "qemu";
}

export type NodeStatus = "running" | "stopped" | "error";

export interface NodeDriver {
  start(node: LabNode, nodeType: NodeTypeDef): Promise<RunningNodeHandle>;
  stop(handle: RunningNodeHandle): Promise<void>;
  status(handle: RunningNodeHandle): Promise<NodeStatus>;
}
