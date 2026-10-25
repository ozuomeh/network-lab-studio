import { useEffect, useState } from "react";
import { useLabStore } from "../topology/useLabStore";

function parseExtraArgs(text: string): string[] {
  // Split on any whitespace (not just newlines) since a flag and its value
  // are separate argv entries either way; this field does not support
  // individual arguments that themselves contain spaces.
  return text
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function NodeInspector() {
  const lab = useLabStore((s) => s.lab);
  const selectedNodeId = useLabStore((s) => s.selectedNodeId);
  const updateQemuConfig = useLabStore((s) => s.updateQemuConfig);

  const node = lab?.nodes.find((n) => n.id === selectedNodeId);
  const nodeType = lab?.nodeTypes.find((t) => t.id === node?.nodeTypeId);
  const qemuConfig = nodeType?.config.kind === "qemu" ? nodeType.config : undefined;

  // Local draft: committing the parsed array on every keystroke (instead of
  // on blur) fights real typing — a trailing space the user just typed gets
  // stripped by filter(Boolean) on the very next render, making it
  // impossible to type a second argument after the first (confirmed via a
  // real keystroke-driven typing test, not just programmatic value-setting).
  const [extraArgsDraft, setExtraArgsDraft] = useState("");
  useEffect(() => {
    setExtraArgsDraft((qemuConfig?.extraArgs ?? []).join(" "));
    // Only resync when the selected node changes, not on every store update,
    // or the user's in-progress typing would get clobbered on each commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  if (!lab || !selectedNodeId || !node || !nodeType) return null;

  return (
    <aside
      style={{
        width: 260,
        borderLeft: "1px solid #e2e8f0",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflowY: "auto",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>NODE PROPERTIES</div>
      <div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>Label</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{node.label}</div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>Kind</div>
        <div style={{ fontSize: 13 }}>{nodeType.config.kind}</div>
      </div>

      {qemuConfig && (
        <>
          <label style={{ fontSize: 12 }}>
            Image path
            <input
              style={{ width: "100%", padding: 6, marginTop: 2, fontSize: 12 }}
              value={qemuConfig.imagePath}
              onChange={(e) => updateQemuConfig(node.id, { imagePath: e.target.value })}
              placeholder="/path/to/your-image.qcow2"
            />
          </label>
          <label style={{ fontSize: 12 }}>
            CPUs
            <input
              type="number"
              min={1}
              style={{ width: "100%", padding: 6, marginTop: 2, fontSize: 12 }}
              value={qemuConfig.cpu}
              onChange={(e) => updateQemuConfig(node.id, { cpu: Number(e.target.value) || 1 })}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            Memory (MiB)
            <input
              type="number"
              min={128}
              step={128}
              style={{ width: "100%", padding: 6, marginTop: 2, fontSize: 12 }}
              value={qemuConfig.memoryMiB}
              onChange={(e) => updateQemuConfig(node.id, { memoryMiB: Number(e.target.value) || 512 })}
            />
          </label>
          <label style={{ fontSize: 12 }}>
            Extra QEMU args (space/newline separated)
            <textarea
              rows={4}
              style={{ width: "100%", padding: 6, marginTop: 2, fontSize: 11, fontFamily: "monospace" }}
              value={extraArgsDraft}
              onChange={(e) => setExtraArgsDraft(e.target.value)}
              onBlur={() => updateQemuConfig(node.id, { extraArgs: parseExtraArgs(extraArgsDraft) })}
              placeholder="-kernel /path/vmlinuz -initrd /path/initrd -append console=ttyS0"
            />
          </label>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            Point this at a local disk image you supply — nothing is downloaded automatically.
          </div>
        </>
      )}
    </aside>
  );
}
