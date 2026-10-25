import { bridgeName, vethHostName, vethNsName } from "./ifaceNames.js";
import { sudoExec, sudoExecBestEffort } from "./exec.js";

/**
 * Every LabLink becomes exactly one Linux bridge with exactly two member
 * interfaces (point-to-point). A node with 3 links gets 3 separate per-link
 * bridges, never one shared bridge. This is the piece that lets a Docker
 * container and a QEMU VM (added in a later phase) share an L2 link: each
 * side just attaches whatever interface type it has to the same bridge.
 */
export interface BridgeHandle {
  linkId: string;
  bridgeName: string;
}

export async function createLinkBridge(linkId: string): Promise<BridgeHandle> {
  const name = bridgeName(linkId);
  await sudoExec("ip", ["link", "add", "name", name, "type", "bridge"]);
  await sudoExec("ip", ["link", "set", name, "up"]);
  // Required: Docker sets the iptables FORWARD chain's default policy to
  // DROP and only ACCEPTs traffic it manages itself. Bridge netfilter hooks
  // catch our manually-created bridge's traffic too, so without this rule
  // every packet on the link bridge is silently dropped. Confirmed via a
  // manual bridge+veth+netns smoke test before writing this driver.
  await sudoExec("iptables", ["-I", "FORWARD", "-i", name, "-j", "ACCEPT"]);
  await sudoExec("iptables", ["-I", "FORWARD", "-o", name, "-j", "ACCEPT"]);
  return { linkId, bridgeName: name };
}

export async function destroyLinkBridge(handle: BridgeHandle): Promise<void> {
  await sudoExecBestEffort("iptables", ["-D", "FORWARD", "-i", handle.bridgeName, "-j", "ACCEPT"]);
  await sudoExecBestEffort("iptables", ["-D", "FORWARD", "-o", handle.bridgeName, "-j", "ACCEPT"]);
  await sudoExecBestEffort("ip", ["link", "del", handle.bridgeName]);
}

export interface DockerEndpointAttachment {
  kind: "docker";
  vethHost: string;
  vethNs: string;
  ifaceNameInContainer: string;
}

/**
 * Attaches a running Docker container (started with NetworkMode: "none") to
 * a link bridge: creates a veth pair, leaves the host end on the bridge, and
 * moves the namespace end into the container's network namespace (found via
 * its PID), renaming it to the requested interface name there.
 */
export async function attachDockerEndpoint(
  bridge: BridgeHandle,
  containerPid: number,
  ifaceNameInContainer: string,
  side: "a" | "b",
): Promise<DockerEndpointAttachment> {
  const vethHost = vethHostName(bridge.linkId, side);
  const vethNs = vethNsName(bridge.linkId, side);

  await sudoExec("ip", ["link", "add", vethHost, "type", "veth", "peer", "name", vethNs]);
  await sudoExec("ip", ["link", "set", vethHost, "master", bridge.bridgeName]);
  await sudoExec("ip", ["link", "set", vethHost, "up"]);
  await sudoExec("ip", ["link", "set", vethNs, "netns", String(containerPid)]);
  await sudoExec("nsenter", ["-t", String(containerPid), "-n", "ip", "link", "set", vethNs, "name", ifaceNameInContainer]);
  await sudoExec("nsenter", ["-t", String(containerPid), "-n", "ip", "link", "set", ifaceNameInContainer, "up"]);
  await sudoExec("nsenter", ["-t", String(containerPid), "-n", "ip", "link", "set", "lo", "up"]);

  return { kind: "docker", vethHost, vethNs, ifaceNameInContainer };
}

/**
 * Deletes the host-side veth end. Deleting one end of a veth pair removes
 * both ends (including the one now living inside the container's netns), so
 * no separate cleanup inside the container is needed.
 */
export async function detachDockerEndpoint(attachment: DockerEndpointAttachment): Promise<void> {
  await sudoExecBestEffort("ip", ["link", "del", attachment.vethHost]);
}

export interface QemuEndpointAttachment {
  kind: "qemu";
  tapName: string;
}

/**
 * Attaches a QEMU VM's pre-existing tap device (created at VM start, one per
 * NIC — see QemuDriver) to a link bridge. Unlike the Docker case there's
 * nothing to create here: the tap already exists, it just joins the bridge.
 */
export async function attachQemuEndpoint(bridge: BridgeHandle, tap: string): Promise<QemuEndpointAttachment> {
  await sudoExec("ip", ["link", "set", tap, "master", bridge.bridgeName]);
  return { kind: "qemu", tapName: tap };
}

/**
 * Leaves the bridge without deleting the tap itself — QemuDriver owns the
 * tap's lifecycle and removes it when the VM stops.
 */
export async function detachQemuEndpoint(attachment: QemuEndpointAttachment): Promise<void> {
  await sudoExecBestEffort("ip", ["link", "set", attachment.tapName, "nomaster"]);
}
