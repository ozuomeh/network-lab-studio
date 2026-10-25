import type { FastifyInstance } from "fastify";
import type { LabRuntime } from "@network-lab-studio/engine";
import type { LabStore } from "../storage/labStore.js";

export async function registerLifecycleRoutes(
  app: FastifyInstance,
  store: LabStore,
  runtime: LabRuntime,
): Promise<void> {
  app.post("/api/labs/:labId/start", async (request, reply) => {
    const { labId } = request.params as { labId: string };
    const lab = await store.get(labId);
    if (!lab) {
      reply.code(404);
      return { error: "not_found" };
    }
    if (runtime.isRunning(labId)) {
      reply.code(409);
      return { error: "already_running" };
    }
    try {
      await runtime.startLab(lab);
    } catch (err) {
      reply.code(500);
      return { error: "start_failed", message: (err as Error).message };
    }
    return { status: "running" };
  });

  app.post("/api/labs/:labId/stop", async (request) => {
    const { labId } = request.params as { labId: string };
    await runtime.stopLab(labId);
    return { status: "stopped" };
  });

  app.get("/api/labs/:labId/status", async (request) => {
    const { labId } = request.params as { labId: string };
    return runtime.getLabStatus(labId);
  });
}
