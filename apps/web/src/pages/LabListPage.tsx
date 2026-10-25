import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { labsClient } from "../api/labsClient";

export function LabListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");

  const labsQuery = useQuery({ queryKey: ["labs"], queryFn: labsClient.list });

  const createMutation = useMutation({
    mutationFn: (name: string) => labsClient.create(name),
    onSuccess: (lab) => {
      void queryClient.invalidateQueries({ queryKey: ["labs"] });
      navigate(`/labs/${lab.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => labsClient.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["labs"] }),
  });

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h1>Network Lab Studio</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New lab name"
          style={{ flex: 1, padding: 8 }}
        />
        <button
          disabled={!newName.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate(newName.trim())}
        >
          New Lab
        </button>
      </div>

      {labsQuery.isLoading && <p>Loading...</p>}
      {labsQuery.isError && <p>Failed to load labs.</p>}
      {labsQuery.data?.length === 0 && <p>No labs yet. Create one above.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {labsQuery.data?.map((lab) => (
          <li
            key={lab.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <span onClick={() => navigate(`/labs/${lab.id}`)} style={{ cursor: "pointer" }}>
              {lab.name}
            </span>
            <button onClick={() => deleteMutation.mutate(lab.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
