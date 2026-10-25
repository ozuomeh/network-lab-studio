import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { LabRuntime } from "@network-lab-studio/engine";
import { LabStore } from "./storage/labStore.js";
import { registerLabRoutes } from "./routes/labs.js";
import { registerLifecycleRoutes } from "./routes/lifecycle.js";
import { registerConsoleRoutes } from "./routes/consoleWs.js";

export async function buildApp(labsDir: string): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(websocket);

  const store = new LabStore(labsDir);
  const runtime = new LabRuntime();

  await registerLabRoutes(app, store);
  await registerLifecycleRoutes(app, store, runtime);
  await registerConsoleRoutes(app, runtime);

  app.get("/api/health", async () => ({ status: "ok" }));

  return app;
}
