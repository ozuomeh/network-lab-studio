import type Docker from "dockerode";
import type { ConsoleSession } from "./ConsoleSession.js";

/**
 * Opens an interactive shell inside a running container via `docker exec`
 * with a TTY, wrapped to satisfy the kind-agnostic ConsoleSession interface
 * the WS relay and the browser's xterm.js panel both talk to.
 */
export async function openDockerConsole(
  docker: Docker,
  containerId: string,
  nodeId: string,
): Promise<ConsoleSession> {
  const container = docker.getContainer(containerId);
  const exec = await container.exec({
    Cmd: ["/bin/sh"],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
  });
  // With Tty: true, dockerode returns a single raw duplex stream (stdout and
  // stderr are not multiplexed, unlike the non-TTY case).
  const stream = await exec.start({ hijack: true, stdin: true, Tty: true });

  const dataCallbacks: Array<(chunk: Buffer) => void> = [];
  stream.on("data", (chunk: Buffer) => {
    for (const cb of dataCallbacks) cb(chunk);
  });

  return {
    nodeId,
    onData(cb) {
      dataCallbacks.push(cb);
    },
    write(chunk) {
      stream.write(chunk);
    },
    resize(cols, rows) {
      exec.resize({ h: rows, w: cols }).catch(() => undefined);
    },
    close() {
      stream.end();
    },
  };
}
