import { existsSync } from "node:fs";
import { join } from "node:path";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import staticPlugin from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { LabRuntime } from "@network-lab-studio/engine";
import { LabStore } from "./storage/labStore.js";
import { registerLabRoutes } from "./routes/labs.js";
import { registerLifecycleRoutes } from "./routes/lifecycle.js";
import { registerConsoleRoutes } from "./routes/consoleWs.js";

export interface BuildAppOptions {
  /**
   * Absolute path to the built frontend (apps/web/dist). When provided and
   * the directory exists, the API also serves the built SPA directly —
   * one process for both API and UI, which is what the systemd unit
   * installed by the autoinstall config runs. Dev mode (`pnpm dev`) never
   * passes this; Vite's own dev server serves the frontend instead.
   */
  webDistDir?: string;
}

export async function buildApp(labsDir: string, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(websocket);

  const store = new LabStore(labsDir);
  const runtime = new LabRuntime();

  await registerLabRoutes(app, store);
  await registerLifecycleRoutes(app, store, runtime);
  await registerConsoleRoutes(app, runtime);

  app.get("/api/health", async () => ({ status: "ok" }));

  if (options.webDistDir && existsSync(options.webDistDir)) {
    await app.register(staticPlugin, { root: options.webDistDir });
    // SPA fallback: any non-/api, non-asset GET (e.g. a direct load of
    // /labs/:id) serves index.html so client-side routing can take over.
    app.setNotFoundHandler((request, reply) => {
      if (request.method !== "GET" || request.url.startsWith("/api/")) {
        reply.code(404);
        return { error: "not_found" };
      }
      return reply.sendFile("index.html", options.webDistDir);
    });
  }

  return app;
}
