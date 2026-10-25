import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { DeviceNodeData } from "./adapters";
import { useNodeStatusStore } from "../lifecycle/useNodeStatusStore";

const STATUS_COLOR: Record<string, string> = {
  running: "#16a34a",
  stopped: "#94a3b8",
  error: "#dc2626",
};

export function DeviceNode({ id, data, selected }: NodeProps & { data: DeviceNodeData }) {
  const status = useNodeStatusStore((s) => s.statuses[id]);

  return (
    <div
      style={{
        border: selected ? "2px solid #2563eb" : "1px solid #94a3b8",
        borderRadius: 8,
        background: "#ffffff",
        padding: "8px 12px",
        minWidth: 120,
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
        fontSize: 13,
        position: "relative",
      }}
    >
      {status && (
        <span
          title={status}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: STATUS_COLOR[status] ?? "#94a3b8",
          }}
        />
      )}
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      <div style={{ color: "#64748b", fontSize: 11 }}>{data.nodeTypeName}</div>
      {data.ports.map((port, i) => {
        const top = data.ports.length === 1 ? 24 : 16 + (i * 32) / Math.max(1, data.ports.length - 1 || 1);
        return (
          <Handle
            key={port.id}
            id={port.id}
            type="source"
            position={Position.Right}
            style={{ top }}
            title={port.label}
          />
        );
      })}
    </div>
  );
}

export const nodeTypes = { device: DeviceNode };
