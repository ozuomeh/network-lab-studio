import Docker from "dockerode";
import type { LabNode, NodeTypeDef } from "@network-lab-studio/shared-types";
import type { NodeDriver, NodeStatus, RunningNodeHandle } from "./NodeDriver.js";

export interface DockerRunningNodeHandle extends RunningNodeHandle {
  kind: "docker";
  containerId: string;
  pid: number;
}

function isDockerHandle(handle: RunningNodeHandle): handle is DockerRunningNodeHandle {
  return handle.kind === "docker";
}

export class DockerDriver implements NodeDriver {
  private readonly docker: Docker;

  constructor(docker: Docker = new Docker({ socketPath: "/var/run/docker.sock" })) {
    this.docker = docker;
  }

  async start(node: LabNode, nodeType: NodeTypeDef): Promise<DockerRunningNodeHandle> {
    if (nodeType.config.kind !== "docker") {
      throw new Error(`DockerDriver cannot start a node of kind "${nodeType.config.kind}"`);
    }
    const { image, command, env, capAdd, privileged } = nodeType.config;

    await this.ensureImage(image);

    const container = await this.docker.createContainer({
      Image: image,
      name: `nls-${node.id}`,
      Cmd: command,
      Env: env ? Object.entries(env).map(([k, v]) => `${k}=${v}`) : undefined,
      Tty: true,
      OpenStdin: true,
      HostConfig: {
        // Deliberate: our own LinkWiring attaches interfaces manually per
        // drawn link, not Docker's own bridge networking (see LinkWiring.ts).
        NetworkMode: "none",
        CapAdd: capAdd,
        Privileged: privileged ?? false,
      },
    });
    await container.start();

    const info = await container.inspect();
    const pid = info.State.Pid;
    if (!pid) {
      throw new Error(`Container ${container.id} started but reported no PID`);
    }

    return { nodeId: node.id, kind: "docker", containerId: container.id, pid };
  }

  async stop(handle: RunningNodeHandle): Promise<void> {
    if (!isDockerHandle(handle)) {
      throw new Error("DockerDriver.stop called with a non-docker handle");
    }
    const container = this.docker.getContainer(handle.containerId);
    await container.stop({ t: 2 }).catch(() => undefined);
    await container.remove({ force: true }).catch(() => undefined);
  }

  async status(handle: RunningNodeHandle): Promise<NodeStatus> {
    if (!isDockerHandle(handle)) {
      throw new Error("DockerDriver.status called with a non-docker handle");
    }
    try {
      const info = await this.docker.getContainer(handle.containerId).inspect();
      return info.State.Running ? "running" : "stopped";
    } catch {
      return "error";
    }
  }

  private async ensureImage(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect();
    } catch {
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(image, (err: Error | null, stream?: NodeJS.ReadableStream) => {
          if (err || !stream) return reject(err ?? new Error("docker pull returned no stream"));
          this.docker.modem.followProgress(stream, (err2: Error | null) =>
            err2 ? reject(err2) : resolve(),
          );
        });
      });
    }
  }
}
