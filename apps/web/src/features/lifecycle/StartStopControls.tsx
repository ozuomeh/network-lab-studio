import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { labsClient } from "../../api/labsClient";
import { useNodeStatusStore } from "./useNodeStatusStore";

export function StartStopControls({ labId }: { labId: string }) {
  const queryClient = useQueryClient();
  const setStatuses = useNodeStatusStore((s) => s.setStatuses);
  const clearStatuses = useNodeStatusStore((s) => s.clear);

  const statusQuery = useQuery({
    queryKey: ["lab-status", labId],
    queryFn: () => labsClient.status(labId),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (statusQuery.data) setStatuses(statusQuery.data.nodes);
  }, [statusQuery.data, setStatuses]);

  useEffect(() => () => clearStatuses(), [labId, clearStatuses]);

  const startMutation = useMutation({
    mutationFn: () => labsClient.start(labId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lab-status", labId] }),
  });

  const stopMutation = useMutation({
    mutationFn: () => labsClient.stop(labId),
    onSuccess: () => {
      clearStatuses();
      void queryClient.invalidateQueries({ queryKey: ["lab-status", labId] });
    },
  });

  const running = statusQuery.data?.running ?? false;
  const busy = startMutation.isPending || stopMutation.isPending;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: running ? "#16a34a" : "#94a3b8",
          display: "inline-block",
        }}
      />
      <span style={{ fontSize: 12, color: "#64748b" }}>{running ? "Running" : "Stopped"}</span>
      {running ? (
        <button disabled={busy} onClick={() => stopMutation.mutate()}>
          {stopMutation.isPending ? "Stopping..." : "Stop Lab"}
        </button>
      ) : (
        <button disabled={busy} onClick={() => startMutation.mutate()}>
          {startMutation.isPending ? "Starting..." : "Start Lab"}
        </button>
      )}
      {startMutation.isError && (
        <span style={{ color: "#dc2626", fontSize: 12 }}>{(startMutation.error as Error).message}</span>
      )}
    </div>
  );
}
