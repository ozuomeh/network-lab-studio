import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { labsClient } from "../api/labsClient";
import { DevicePalette } from "../features/topology/DevicePalette";
import { TopologyCanvas } from "../features/topology/TopologyCanvas";
import { useLabStore } from "../features/topology/useLabStore";
import { StartStopControls } from "../features/lifecycle/StartStopControls";
import { ConsoleDock } from "../features/console/ConsoleDock";
import { NodeInspector } from "../features/inspector/NodeInspector";

export function LabEditorPage() {
  const { labId } = useParams<{ labId: string }>();
  const navigate = useNavigate();
  const lab = useLabStore((s) => s.lab);
  const dirty = useLabStore((s) => s.dirty);
  const setLab = useLabStore((s) => s.setLab);
  const markSaved = useLabStore((s) => s.markSaved);

  const labQuery = useQuery({
    queryKey: ["lab", labId],
    queryFn: () => labsClient.get(labId as string),
    enabled: Boolean(labId),
  });

  useEffect(() => {
    if (labQuery.data) setLab(labQuery.data);
  }, [labQuery.data, setLab]);

  const saveMutation = useMutation({
    mutationFn: () => labsClient.save(lab!),
    onSuccess: (saved) => markSaved(saved),
  });

  if (labQuery.isLoading) return <p style={{ padding: 24 }}>Loading lab...</p>;
  if (labQuery.isError || !lab) return <p style={{ padding: 24 }}>Failed to load lab.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 16px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <button onClick={() => navigate("/")}>&larr; Labs</button>
        <strong>{lab.name}</strong>
        {dirty && <span style={{ color: "#b45309", fontSize: 12 }}>unsaved changes</span>}
        <div style={{ flex: 1 }} />
        <StartStopControls labId={lab.id} />
        <button disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? "Saving..." : "Save"}
        </button>
      </header>
      <div style={{ flex: 1, display: "flex", minHeight: 0, flexDirection: "column" }}>
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <DevicePalette />
          <TopologyCanvas />
          <NodeInspector />
        </div>
        <ConsoleDock labId={lab.id} />
      </div>
    </div>
  );
}
