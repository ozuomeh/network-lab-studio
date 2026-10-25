import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildApp } from "./app.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const labsDir = process.env.LABS_DIR ?? join(__dirname, "..", "..", "..", "labs");
const port = Number(process.env.PORT ?? 4001);

const app = await buildApp(labsDir);

app
  .listen({ port, host: "127.0.0.1" })
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://127.0.0.1:${port} (labs dir: ${labsDir})`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
