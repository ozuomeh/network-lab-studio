import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type { LabNode, NodeTypeDef } from "@network-lab-studio/shared-types";
import { describe, expect, it } from "vitest";
import { DockerDriver } from "../drivers/DockerDriver.js";
import {
  attachDockerEndpoint,
  createLinkBridge,
  destroyLinkBridge,
  detachDockerEndpoint,
} from "../net/LinkWiring.js";

const execFileAsync = promisify(execFile);

function makeAlpineNode(label: string): { node: LabNode; nodeType: NodeTypeDef } {
  const nodeTypeId = randomUUID();
  const nodeType: NodeTypeDef = {
    id: nodeTypeId,
    name: "Alpine",
    portCount: 1,
    config: { kind: "docker", image: "alpine:3.20", command: ["sleep", "infinity"] },
  };
  const node: LabNode = {
    id: randomUUID(),
    nodeTypeId,
    label,
    position: { x: 0, y: 0 },
    ports: [{ id: randomUUID(), label: "eth0", index: 0 }],
  };
  return { node, nodeType };
}

describe("Docker driver + link wiring integration (requires Linux host with docker + sudo)", () => {
  it(
    "starts two containers, wires a bridge link between them, and pings across it end to end",
    async () => {
      const driver = new DockerDriver();
      const { node: nodeA, nodeType: typeA } = makeAlpineNode("A");
      const { node: nodeB, nodeType: typeB } = makeAlpineNode("B");

      const handleA = await driver.start(nodeA, typeA);
      const handleB = await driver.start(nodeB, typeB);

      try {
        expect(await driver.status(handleA)).toBe("running");
        expect(await driver.status(handleB)).toBe("running");

        const linkId = randomUUID();
        const bridge = await createLinkBridge(linkId);

        try {
          const attachA = await attachDockerEndpoint(bridge, handleA.pid, "eth0", "a");
          const attachB = await attachDockerEndpoint(bridge, handleB.pid, "eth0", "b");

          try {
            await execFileAsync("sudo", [
              "nsenter", "-t", String(handleA.pid), "-n",
              "ip", "addr", "add", "10.77.0.1/24", "dev", "eth0",
            ]);
            await execFileAsync("sudo", [
              "nsenter", "-t", String(handleB.pid), "-n",
              "ip", "addr", "add", "10.77.0.2/24", "dev", "eth0",
            ]);

            const { stdout } = await execFileAsync("sudo", [
              "nsenter", "-t", String(handleA.pid), "-n",
              "ping", "-c", "3", "-W", "2", "10.77.0.2",
            ]);
            expect(stdout).toContain("0% packet loss");
          } finally {
            await detachDockerEndpoint(attachA);
            await detachDockerEndpoint(attachB);
          }
        } finally {
          await destroyLinkBridge(bridge);
        }
      } finally {
        await driver.stop(handleA);
        await driver.stop(handleB);
      }
    },
    60_000,
  );
});
