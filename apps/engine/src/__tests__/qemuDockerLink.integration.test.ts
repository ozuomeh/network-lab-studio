import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import net from "node:net";
import { promisify } from "node:util";
import type { LabNode, NodeTypeDef } from "@network-lab-studio/shared-types";
import { describe, expect, it } from "vitest";
import { DockerDriver } from "../drivers/DockerDriver.js";
import { QemuDriver } from "../drivers/QemuDriver.js";
import {
  attachDockerEndpoint,
  attachQemuEndpoint,
  createLinkBridge,
  destroyLinkBridge,
  detachDockerEndpoint,
  detachQemuEndpoint,
} from "../net/LinkWiring.js";

const execFileAsync = promisify(execFile);

const IMAGES_DIR = "/mnt/c/Users/eozuo/Downloads/network-lab-studio/images";

function makeNode(label: string, portLabel: string): { node: LabNode; portId: string } {
  const portId = randomUUID();
  return {
    node: {
      id: randomUUID(),
      nodeTypeId: randomUUID(),
      label,
      position: { x: 0, y: 0 },
      ports: [{ id: portId, label: portLabel, index: 0 }],
    },
    portId,
  };
}

/** Minimal scripted serial-console client for test purposes only. */
function sendToSerial(port: number, commands: string[], gapMs = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, "127.0.0.1");
    let buf = "";
    sock.on("data", (d) => {
      buf += d.toString("utf8");
    });
    sock.on("error", reject);

    // Booting with a disk attached (needed for driver realism) triggers an
    // initramfs "mounting boot media" probe that fails and falls through to
    // an emergency recovery shell — still a working root shell, just slower
    // and with boot-message noise that can eat early keystrokes. Wait it out.
    let t = 10_000;
    for (const cmd of commands) {
      setTimeout(() => sock.write(`${cmd}\r`), t);
      t += gapMs;
    }
    setTimeout(() => {
      sock.end();
      resolve(buf);
    }, t + 1000);
  });
}

describe("QEMU driver + Docker↔QEMU mixed link wiring (requires Linux host with KVM + docker + sudo)", () => {
  it(
    "boots a QEMU node and a Docker node, wires a bridge link between them, and pings across it",
    async () => {
      const dockerDriver = new DockerDriver();
      const qemuDriver = new QemuDriver();

      const { node: dockerNode, portId: dockerPortId } = makeNode("DockerSide", "eth0");
      const dockerType: NodeTypeDef = {
        id: randomUUID(),
        name: "Alpine",
        portCount: 1,
        config: { kind: "docker", image: "alpine:3.20", command: ["sleep", "infinity"] },
      };

      const { node: qemuNode, portId: qemuPortId } = makeNode("QemuSide", "eth0");
      const qemuType: NodeTypeDef = {
        id: randomUUID(),
        name: "Alpine netboot (test only)",
        portCount: 1,
        config: {
          kind: "qemu",
          imagePath: `${IMAGES_DIR}/alpine-test.qcow2`,
          cpu: 1,
          memoryMiB: 512,
          consoleType: "serial",
          // Test-only: boots straight to a root shell via the netboot
          // kernel/initramfs instead of the disk's own (password-protected)
          // login, so the test doesn't depend on unknown image credentials.
          extraArgs: [
            "-kernel", `${IMAGES_DIR}/vmlinuz-virt`,
            "-initrd", `${IMAGES_DIR}/initramfs-virt`,
            "-append", "console=ttyS0",
          ],
        },
      };

      const dockerHandle = await dockerDriver.start(dockerNode, dockerType);
      const qemuHandle = await qemuDriver.start(qemuNode, qemuType);

      try {
        expect(await dockerDriver.status(dockerHandle)).toBe("running");
        expect(await qemuDriver.status(qemuHandle)).toBe("running");

        const linkId = randomUUID();
        const bridge = await createLinkBridge(linkId);

        try {
          const dockerAttach = await attachDockerEndpoint(bridge, dockerHandle.pid, "eth0", "a");
          const qemuTap = qemuHandle.tapByPortId.get(qemuPortId);
          if (!qemuTap) throw new Error("no tap allocated for qemu test port");
          const qemuAttach = await attachQemuEndpoint(bridge, qemuTap);

          try {
            await execFileAsync("sudo", [
              "nsenter", "-t", String(dockerHandle.pid), "-n",
              "ip", "addr", "add", "10.88.0.1/24", "dev", "eth0",
            ]);

            // Give the VM time to finish booting to its shell before driving it.
            const bootOutput = await sendToSerial(qemuHandle.serialPort, [
              "ip addr add 10.88.0.2/24 dev eth0",
              "ip link set eth0 up",
              "ping -c 3 -W 2 10.88.0.1",
            ], 4000);

            expect(bootOutput).toContain("3 packets transmitted");

            const { stdout } = await execFileAsync("sudo", [
              "nsenter", "-t", String(dockerHandle.pid), "-n",
              "ping", "-c", "3", "-W", "2", "10.88.0.2",
            ]);
            expect(stdout).toContain("0% packet loss");
          } finally {
            await detachDockerEndpoint(dockerAttach);
            await detachQemuEndpoint(qemuAttach);
          }
        } finally {
          await destroyLinkBridge(bridge);
        }
      } finally {
        await dockerDriver.stop(dockerHandle);
        await qemuDriver.stop(qemuHandle);
      }
    },
    120_000,
  );
});
