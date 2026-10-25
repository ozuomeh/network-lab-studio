import { useLabStore } from "../topology/useLabStore";
import { useConsoleDockStore } from "./useConsoleDockStore";
import { ConsolePanel } from "./ConsolePanel";

export function ConsoleDock({ labId }: { labId: string }) {
  const lab = useLabStore((s) => s.lab);
  const openNodeIds = useConsoleDockStore((s) => s.openNodeIds);
  const activeNodeId = useConsoleDockStore((s) => s.activeNodeId);
  const setActive = useConsoleDockStore((s) => s.setActive);
  const close = useConsoleDockStore((s) => s.close);

  if (openNodeIds.length === 0 || !lab) return null;

  return (
    <div style={{ height: 260, borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 4, padding: "4px 8px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        {openNodeIds.map((nodeId) => {
          const label = lab.nodes.find((n) => n.id === nodeId)?.label ?? nodeId;
          const isActive = nodeId === activeNodeId;
          return (
            <div
              key={nodeId}
              onClick={() => setActive(nodeId)}
              style={{
                padding: "4px 10px",
                borderRadius: 4,
                background: isActive ? "#1e293b" : "#e2e8f0",
                color: isActive ? "#fff" : "#1e293b",
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{label}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  close(nodeId);
                }}
                style={{ opacity: 0.7 }}
              >
                ×
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1, background: "#000", minHeight: 0, position: "relative" }}>
        {openNodeIds.map((nodeId) => (
          <div key={nodeId} style={{ position: "absolute", inset: 0 }}>
            <ConsolePanel labId={labId} nodeId={nodeId} visible={nodeId === activeNodeId} />
          </div>
        ))}
      </div>
    </div>
  );
}
