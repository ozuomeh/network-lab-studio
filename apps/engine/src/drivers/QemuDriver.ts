import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { stat } from "node:fs/promises";
import { userInfo } from "node:os";
import type { LabNode, NodeTypeDef } from "@network-lab-studio/shared-types";
import { deterministicMac, tapNameForPort } from "../net/ifaceNames.js";
import { sudoExec, sudoExecBestEffort } from "../net/exec.js";
import type { NodeDriver, NodeStatus, RunningNodeHandle } from "./NodeDriver.js";

export interface QemuRunningNodeHandle extends RunningNodeHandle {
  kind: "qemu";
  process: ChildProcess;
  serialPort: number;
  /** portId -> tap interface name, for LinkWiring to attach to a bridge. */
  tapByPortId: Map<string, string>;
}

function isQemuHandle(handle: RunningNodeHandle): handle is QemuRunningNodeHandle {
  return handle.kind === "qemu";
}

/** Picks a free TCP port by briefly binding to port 0 and reading it back. */
async function allocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const { port } = address;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Failed to allocate a free port")));
      }
    });
  });
}

export class QemuDriver implements NodeDriver {
  async start(node: LabNode, nodeType: NodeTypeDef): Promise<QemuRunningNodeHandle> {
    if (nodeType.config.kind !== "qemu") {
      throw new Error(`QemuDriver cannot start a node of kind "${nodeType.config.kind}"`);
    }
    const { imagePath, cpu, memoryMiB, extraArgs } = nodeType.config;

    try {
      await stat(imagePath);
    } catch {
      throw new Error(`QEMU image not found at "${imagePath}" — supply your own local disk image`);
    }

    const serialPort = await allocatePort();
    const username = userInfo().username;
    const tapByPortId = new Map<string, string>();
    const netArgs: string[] = [];

    // Tap devices are created here, before QEMU starts, so the engine (not
    // QEMU's own helper scripts) fully owns bridge membership — matching
    // how the Docker side's veth wiring already works. `user <username>`
    // lets the non-root QEMU process below open the tap directly.
    for (const port of node.ports) {
      const tap = tapNameForPort(node.id, port.id);
      await sudoExec("ip", ["tuntap", "add", "dev", tap, "mode", "tap", "user", username]);
      await sudoExec("ip", ["link", "set", tap, "up"]);
      tapByPortId.set(port.id, tap);

      const netId = `net${port.index}`;
      const mac = deterministicMac(node.id, port.id);
      netArgs.push(
        "-netdev", `tap,id=${netId},ifname=${tap},script=no,downscript=no`,
        "-device", `virtio-net-pci,netdev=${netId},mac=${mac}`,
      );
    }

    const args = [
      "-enable-kvm",
      "-cpu", "host",
      "-smp", String(cpu),
      "-m", String(memoryMiB),
      "-drive", `file=${imagePath},if=virtio,format=qcow2`,
      ...netArgs,
      "-serial", `telnet:127.0.0.1:${serialPort},server,nowait`,
      "-display", "none",
      ...(extraArgs ?? []),
    ];

    const proc = spawn("qemu-system-x86_64", args, { stdio: "ignore" });

    const exitedEarly = await new Promise<boolean>((resolve) => {
      const onExit = () => resolve(true);
      proc.once("exit", onExit);
      setTimeout(() => {
        proc.off("exit", onExit);
        resolve(false);
      }, 1000);
    });

    if (exitedEarly) {
      for (const tap of tapByPortId.values()) {
        await sudoExecBestEffort("ip", ["link", "del", tap]);
      }
      throw new Error(`qemu-system-x86_64 exited immediately for node ${node.id} (exit code ${proc.exitCode})`);
    }

    return { nodeId: node.id, kind: "qemu", process: proc, serialPort, tapByPortId };
  }

  async stop(handle: RunningNodeHandle): Promise<void> {
    if (!isQemuHandle(handle)) {
      throw new Error("QemuDriver.stop called with a non-qemu handle");
    }
    handle.process.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (handle.process.exitCode !== null) return resolve();
      handle.process.once("exit", () => resolve());
      setTimeout(() => {
        if (handle.process.exitCode === null) handle.process.kill("SIGKILL");
        resolve();
      }, 3000);
    });
    for (const tap of handle.tapByPortId.values()) {
      await sudoExecBestEffort("ip", ["link", "del", tap]);
    }
  }

  async status(handle: RunningNodeHandle): Promise<NodeStatus> {
    if (!isQemuHandle(handle)) {
      throw new Error("QemuDriver.status called with a non-qemu handle");
    }
    if (handle.process.exitCode !== null) return "stopped";
    return "running";
  }
}
