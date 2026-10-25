import type { Lab } from "@network-lab-studio/shared-types";

export interface LabSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface NodeRunStatus {
  nodeId: string;
  state: "running" | "stopped" | "error";
}

export interface LabRunStatus {
  running: boolean;
  nodes: NodeRunStatus[];
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${res.statusText} ${body}`);
  }
  return res.json() as Promise<T>;
}

export const labsClient = {
  async list(): Promise<LabSummary[]> {
    const res = await fetch("/api/labs");
    return parseOrThrow(res);
  },

  async create(name: string): Promise<Lab> {
    const res = await fetch("/api/labs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return parseOrThrow(res);
  },

  async get(id: string): Promise<Lab> {
    const res = await fetch(`/api/labs/${id}`);
    return parseOrThrow(res);
  },

  async save(lab: Lab): Promise<Lab> {
    const res = await fetch(`/api/labs/${lab.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lab),
    });
    return parseOrThrow(res);
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`/api/labs/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Delete failed: ${res.status}`);
    }
  },

  async start(id: string): Promise<{ status: string }> {
    const res = await fetch(`/api/labs/${id}/start`, { method: "POST" });
    return parseOrThrow(res);
  },

  async stop(id: string): Promise<{ status: string }> {
    const res = await fetch(`/api/labs/${id}/stop`, { method: "POST" });
    return parseOrThrow(res);
  },

  async status(id: string): Promise<LabRunStatus> {
    const res = await fetch(`/api/labs/${id}/status`);
    return parseOrThrow(res);
  },
};
