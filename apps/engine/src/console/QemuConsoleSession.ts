import net from "node:net";
import type { ConsoleSession } from "./ConsoleSession.js";
import { stripTelnetIAC } from "./telnetFilter.js";

/**
 * Opens the raw TCP connection to a QEMU VM's `-serial telnet:...` port and
 * wraps it to satisfy the same kind-agnostic ConsoleSession interface the
 * Docker exec session does — the WS relay and xterm.js panel don't need to
 * know which kind of node they're talking to.
 */
export function openQemuConsole(port: number, nodeId: string): ConsoleSession {
  const sock = net.connect(port, "127.0.0.1");
  const dataCallbacks: Array<(chunk: Buffer) => void> = [];

  sock.on("data", (chunk: Buffer) => {
    const filtered = stripTelnetIAC(chunk);
    if (filtered.length === 0) return;
    for (const cb of dataCallbacks) cb(filtered);
  });

  return {
    nodeId,
    onData(cb) {
      dataCallbacks.push(cb);
    },
    write(chunk) {
      sock.write(chunk);
    },
    // No resize concept for a plain serial line — intentionally omitted.
    close() {
      sock.end();
    },
  };
}
