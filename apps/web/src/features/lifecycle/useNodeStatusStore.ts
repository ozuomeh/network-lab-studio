import { create } from "zustand";
import type { NodeRunStatus } from "../../api/labsClient";

interface NodeStatusState {
  statuses: Record<string, NodeRunStatus["state"]>;
  setStatuses: (nodes: NodeRunStatus[]) => void;
  clear: () => void;
}

export const useNodeStatusStore = create<NodeStatusState>((set) => ({
  statuses: {},
  setStatuses: (nodes) =>
    set({ statuses: Object.fromEntries(nodes.map((n) => [n.nodeId, n.state])) }),
  clear: () => set({ statuses: {} }),
}));
