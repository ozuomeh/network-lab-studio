import Docker from "dockerode";
import type { Lab } from "@network-lab-studio/shared-types";
import { DockerDriver, type DockerRunningNodeHandle } from "./drivers/DockerDriver.js";
import { QemuDriver, type QemuRunningNodeHandle } from "./drivers/QemuDriver.js";
import type { RunningNodeHandle } from "./drivers/NodeDriver.js";
import {
  attachDockerEndpoint,
  attachQemuEndpoint,
  createLinkBridge,
  destroyLinkBridge,
  detachDockerEndpoint,
  detachQemuEndpoint,
  type BridgeHandle,
  type DockerEndpointAttachment,
  type QemuEndpointAttachment,
} from "./net/LinkWiring.js";
import { openDockerConsole } from "./console/DockerConsoleSession.js";
import { openQemuConsole } from "./console/QemuConsoleSession.js";
import type { ConsoleSession } from "./console/ConsoleSession.js";

type EndpointAttachment = DockerEndpointAttachment | QemuEndpointAttachment;

interface RunningLab {
  nodeHandles: Map<string, RunningNodeHandle>;
  bridges: Map<string, BridgeHandle>;
  attachments: Map<string, EndpointAttachment[]>;
}

function findPort(lab: Lab, nodeId: string, portId: string) {
  const port = lab.nodes.find((n) => n.id === nodeId)?.ports.find((p) => p.id === portId);
  if (!port) throw new Error(`Port ${portId} not found on node ${nodeId}`);
  return port;
}

async function detachEndpoint(attachment: EndpointAttachment): Promise<void> {
  if (attachment.kind === "docker") {
    await detachDockerEndpoint(attachment);
  } else {
    await detachQemuEndpoint(attachment);
  }
}

/**
 * Orchestrates a whole Lab: starts each node via the right driver, wires
 * links between running nodes (Docker↔Docker, Docker↔QEMU, QEMU↔QEMU all
 * share the same per-link bridge model), and tracks what's running so the
 * console pipeline and status endpoints have something to point at.
 */
export class LabRuntime {
  private readonly docker = new Docker({ socketPath: "/var/run/docker.sock" });
  private readonly dockerDriver = new DockerDriver(this.docker);
  private readonly qemuDriver = new QemuDriver();
  private readonly runningLabs = new Map<string, RunningLab>();

  async startLab(lab: Lab): Promise<void> {
    if (this.runningLabs.has(lab.id)) {
      throw new Error(`Lab ${lab.id} is already running`);
    }
    const nodeHandles = new Map<string, RunningNodeHandle>();
    const bridges = new Map<string, BridgeHandle>();
    const attachments = new Map<string, EndpointAttachment[]>();
    const typeById = new Map(lab.nodeTypes.map((t) => [t.id, t] as const));

    try {
      for (const node of lab.nodes) {
        const nodeType = typeById.get(node.nodeTypeId);
        if (!nodeType) throw new Error(`Node ${node.id} references unknown nodeType ${node.nodeTypeId}`);
        const handle =
          nodeType.config.kind === "docker"
            ? await this.dockerDriver.start(node, nodeType)
            : await this.qemuDriver.start(node, nodeType);
        nodeHandles.set(node.id, handle);
      }

      for (const link of lab.links) {
        const handleA = nodeHandles.get(link.a.nodeId);
        const handleB = nodeHandles.get(link.b.nodeId);
        if (!handleA || !handleB) continue;

        const bridge = await createLinkBridge(link.id);
        bridges.set(link.id, bridge);

        const attachA = await this.attachEndpoint(bridge, lab, handleA, link.a.nodeId, link.a.portId, "a");
        const attachB = await this.attachEndpoint(bridge, lab, handleB, link.b.nodeId, link.b.portId, "b");
        attachments.set(link.id, [attachA, attachB]);
      }

      this.runningLabs.set(lab.id, { nodeHandles, bridges, attachments });
    } catch (err) {
      for (const atts of attachments.values()) {
        for (const att of atts) await detachEndpoint(att).catch(() => undefined);
      }
      for (const bridge of bridges.values()) {
        await destroyLinkBridge(bridge).catch(() => undefined);
      }
      for (const handle of nodeHandles.values()) {
        await this.stopHandle(handle).catch(() => undefined);
      }
      throw err;
    }
  }

  private async attachEndpoint(
    bridge: BridgeHandle,
    lab: Lab,
    handle: RunningNodeHandle,
    nodeId: string,
    portId: string,
    side: "a" | "b",
  ): Promise<EndpointAttachment> {
    const port = findPort(lab, nodeId, portId);
    if (handle.kind === "docker") {
      return attachDockerEndpoint(bridge, (handle as DockerRunningNodeHandle).pid, port.label, side);
    }
    const tap = (handle as QemuRunningNodeHandle).tapByPortId.get(portId);
    if (!tap) throw new Error(`No tap allocated for port ${portId} on node ${nodeId}`);
    return attachQemuEndpoint(bridge, tap);
  }

  private async stopHandle(handle: RunningNodeHandle): Promise<void> {
    if (handle.kind === "docker") await this.dockerDriver.stop(handle);
    else await this.qemuDriver.stop(handle);
  }

  async stopLab(labId: string): Promise<void> {
    const running = this.runningLabs.get(labId);
    if (!running) return;
    for (const atts of running.attachments.values()) {
      for (const att of atts) await detachEndpoint(att).catch(() => undefined);
    }
    for (const bridge of running.bridges.values()) {
      await destroyLinkBridge(bridge).catch(() => undefined);
    }
    for (const handle of running.nodeHandles.values()) {
      await this.stopHandle(handle).catch(() => undefined);
    }
    this.runningLabs.delete(labId);
  }

  isRunning(labId: string): boolean {
    return this.runningLabs.has(labId);
  }

  async getLabStatus(labId: string): Promise<{ running: boolean; nodes: { nodeId: string; state: string }[] }> {
    const running = this.runningLabs.get(labId);
    if (!running) return { running: false, nodes: [] };
    const nodes = await Promise.all(
      Array.from(running.nodeHandles.entries()).map(async ([nodeId, handle]) => {
        const state =
          handle.kind === "docker" ? await this.dockerDriver.status(handle) : await this.qemuDriver.status(handle);
        return { nodeId, state };
      }),
    );
    return { running: true, nodes };
  }

  getNodeHandle(labId: string, nodeId: string): RunningNodeHandle | undefined {
    return this.runningLabs.get(labId)?.nodeHandles.get(nodeId);
  }

  async openConsole(labId: string, nodeId: string): Promise<ConsoleSession> {
    const handle = this.getNodeHandle(labId, nodeId);
    if (!handle) throw new Error(`Node ${nodeId} is not running in lab ${labId}`);
    if (handle.kind === "docker") {
      return openDockerConsole(this.docker, (handle as DockerRunningNodeHandle).containerId, nodeId);
    }
    return openQemuConsole((handle as QemuRunningNodeHandle).serialPort, nodeId);
  }
}
