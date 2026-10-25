import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4001",
        // Required for the console WebSocket endpoint: Vite's proxy does
        // NOT forward WS upgrade requests with the plain string shorthand,
        // it just leaves the handshake hanging forever (confirmed live —
        // no open/error/close event ever fired on the client).
        ws: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    passWithNoTests: true,
  },
});
