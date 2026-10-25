import { create } from "zustand";

interface ConsoleDockState {
  openNodeIds: string[];
  activeNodeId: string | null;
  open: (nodeId: string) => void;
  close: (nodeId: string) => void;
  setActive: (nodeId: string) => void;
}

export const useConsoleDockStore = create<ConsoleDockState>((set) => ({
  openNodeIds: [],
  activeNodeId: null,

  open: (nodeId) =>
    set((state) => ({
      openNodeIds: state.openNodeIds.includes(nodeId) ? state.openNodeIds : [...state.openNodeIds, nodeId],
      activeNodeId: nodeId,
    })),

  close: (nodeId) =>
    set((state) => {
      const openNodeIds = state.openNodeIds.filter((id) => id !== nodeId);
      const activeNodeId = state.activeNodeId === nodeId ? openNodeIds.at(-1) ?? null : state.activeNodeId;
      return { openNodeIds, activeNodeId };
    }),

  setActive: (nodeId) => set({ activeNodeId: nodeId }),
}));
