import { create } from "zustand";
import type {
  Lab,
  LabLink,
  LabNode,
  LinkEndpoint,
  NodeTypeDef,
  PortDef,
  QemuNodeConfig,
} from "@network-lab-studio/shared-types";

interface LabStoreState {
  lab: Lab | null;
  dirty: boolean;
  selectedNodeId: string | null;
  setLab: (lab: Lab) => void;
  markSaved: (lab: Lab) => void;
  addNode: (nodeType: NodeTypeDef, position: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  addLink: (a: LinkEndpoint, b: LinkEndpoint) => void;
  removeLink: (linkId: string) => void;
  selectNode: (nodeId: string | null) => void;
  updateQemuConfig: (nodeId: string, patch: Partial<Omit<QemuNodeConfig, "kind">>) => void;
}

function makePorts(count: number): PortDef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    label: `eth${index}`,
    index,
  }));
}

export const useLabStore = create<LabStoreState>((set) => ({
  lab: null,
  dirty: false,
  selectedNodeId: null,

  setLab: (lab) => set({ lab, dirty: false, selectedNodeId: null }),

  markSaved: (lab) => set({ lab, dirty: false }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  addNode: (nodeType, position) =>
    set((state) => {
      if (!state.lab) return state;
      // QEMU types are always instanced fresh per drop (never shared) so
      // each VM can point at its own image/cpu/memory independently; Docker
      // types are safely shared since every instance uses the same image.
      const isQemu = nodeType.config.kind === "qemu";
      const instancedType: NodeTypeDef = isQemu ? { ...nodeType, id: crypto.randomUUID() } : nodeType;
      const hasType = state.lab.nodeTypes.some((t) => t.id === instancedType.id);

      const newNode: LabNode = {
        id: crypto.randomUUID(),
        nodeTypeId: instancedType.id,
        label: nodeType.name,
        position,
        ports: makePorts(nodeType.portCount),
      };
      return {
        lab: {
          ...state.lab,
          nodeTypes: hasType ? state.lab.nodeTypes : [...state.lab.nodeTypes, instancedType],
          nodes: [...state.lab.nodes, newNode],
        },
        dirty: true,
      };
    }),

  removeNode: (nodeId) =>
    set((state) => {
      if (!state.lab) return state;
      return {
        lab: {
          ...state.lab,
          nodes: state.lab.nodes.filter((n) => n.id !== nodeId),
          links: state.lab.links.filter((l) => l.a.nodeId !== nodeId && l.b.nodeId !== nodeId),
        },
        dirty: true,
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      };
    }),

  updateNodePosition: (nodeId, position) =>
    set((state) => {
      if (!state.lab) return state;
      return {
        lab: {
          ...state.lab,
          nodes: state.lab.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n)),
        },
        dirty: true,
      };
    }),

  addLink: (a, b) =>
    set((state) => {
      if (!state.lab) return state;
      const newLink: LabLink = { id: crypto.randomUUID(), a, b };
      return { lab: { ...state.lab, links: [...state.lab.links, newLink] }, dirty: true };
    }),

  removeLink: (linkId) =>
    set((state) => {
      if (!state.lab) return state;
      return {
        lab: { ...state.lab, links: state.lab.links.filter((l) => l.id !== linkId) },
        dirty: true,
      };
    }),

  updateQemuConfig: (nodeId, patch) =>
    set((state) => {
      if (!state.lab) return state;
      const node = state.lab.nodes.find((n) => n.id === nodeId);
      if (!node) return state;
      return {
        lab: {
          ...state.lab,
          nodeTypes: state.lab.nodeTypes.map((t) => {
            if (t.id !== node.nodeTypeId || t.config.kind !== "qemu") return t;
            return { ...t, config: { ...t.config, ...patch } };
          }),
        },
        dirty: true,
      };
    }),
}));
