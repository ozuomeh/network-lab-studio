import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildApp } from "./app.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labsDir = process.env.LABS_DIR ?? join(__dirname, "..", "..", "..", "labs");
const webDistDir = process.env.WEB_DIST_DIR ?? join(__dirname, "..", "..", "..", "apps", "web", "dist");
const port = Number(process.env.PORT ?? 4001);
// 127.0.0.1 for local dev; the installed systemd service sets HOST=0.0.0.0
// so the UI is reachable from other machines on the network.
const host = process.env.HOST ?? "127.0.0.1";

const app = await buildApp(labsDir, { webDistDir });

app
  .listen({ port, host })
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://${host}:${port} (labs dir: ${labsDir})`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
