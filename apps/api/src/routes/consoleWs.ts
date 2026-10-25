import type { FastifyInstance } from "fastify";
import type { LabRuntime } from "@network-lab-studio/engine";

export async function registerConsoleRoutes(app: FastifyInstance, runtime: LabRuntime): Promise<void> {
  app.get("/api/labs/:labId/nodes/:nodeId/console", { websocket: true }, async (socket, request) => {
    const { labId, nodeId } = request.params as { labId: string; nodeId: string };

    try {
      const session = await runtime.openConsole(labId, nodeId);

      session.onData((chunk) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(chunk);
        }
      });

      socket.on("message", (data: Buffer) => {
        session.write(Buffer.from(data));
      });

      socket.on("close", () => {
        session.close();
      });
    } catch (err) {
      socket.send(JSON.stringify({ error: (err as Error).message }));
      socket.close();
    }
  });
}
