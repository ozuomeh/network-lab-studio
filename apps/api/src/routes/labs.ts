import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LabSchema } from "@network-lab-studio/shared-types";
import { createEmptyLab } from "@network-lab-studio/shared-types";
import type { LabStore } from "../storage/labStore.js";

const CreateLabBodySchema = z.object({
  name: z.string().min(1),
});

export async function registerLabRoutes(app: FastifyInstance, store: LabStore): Promise<void> {
  app.get("/api/labs", async () => {
    return store.list();
  });

  app.post("/api/labs", async (request, reply) => {
    const parsed = CreateLabBodySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_body", issues: parsed.error.issues };
    }
    const lab = createEmptyLab({ id: randomUUID(), name: parsed.data.name });
    await store.save(lab);
    reply.code(201);
    return lab;
  });

  app.get("/api/labs/:labId", async (request, reply) => {
    const { labId } = request.params as { labId: string };
    const lab = await store.get(labId);
    if (!lab) {
      reply.code(404);
      return { error: "not_found" };
    }
    return lab;
  });

  app.put("/api/labs/:labId", async (request, reply) => {
    const { labId } = request.params as { labId: string };
    const parsed = LabSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_body", issues: parsed.error.issues };
    }
    if (parsed.data.id !== labId) {
      reply.code(400);
      return { error: "id_mismatch" };
    }
    const existing = await store.get(labId);
    const lab = { ...parsed.data, updatedAt: new Date().toISOString() };
    await store.save(lab);
    reply.code(existing ? 200 : 201);
    return lab;
  });

  app.delete("/api/labs/:labId", async (request, reply) => {
    const { labId } = request.params as { labId: string };
    const deleted = await store.delete(labId);
    if (!deleted) {
      reply.code(404);
      return { error: "not_found" };
    }
    reply.code(204);
  });
}
