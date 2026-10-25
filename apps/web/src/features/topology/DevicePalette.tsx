import type { DragEvent } from "react";
import { BUILTIN_NODE_TYPES } from "./builtinNodeTypes";

export const PALETTE_DRAG_MIME = "application/x-network-lab-studio-nodetype";

export function DevicePalette() {
  function onDragStart(event: DragEvent<HTMLDivElement>, nodeTypeId: string) {
    event.dataTransfer.setData(PALETTE_DRAG_MIME, nodeTypeId);
    event.dataTransfer.effectAllowed = "move";
  }

  return (
    <aside
      style={{
        width: 200,
        borderRight: "1px solid #e2e8f0",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
        DEVICE PALETTE
      </div>
      {BUILTIN_NODE_TYPES.map((nt) => (
        <div
          key={nt.id}
          draggable
          onDragStart={(e) => onDragStart(e, nt.id)}
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            padding: "6px 10px",
            cursor: "grab",
            fontSize: 13,
            background: "#f8fafc",
          }}
        >
          {nt.name}
        </div>
      ))}
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
        Drag a device onto the canvas.
      </div>
    </aside>
  );
}
