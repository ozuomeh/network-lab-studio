import { createHash } from "node:crypto";

/**
 * Linux interface names are capped at IFNAMSIZ-1 = 15 usable characters, so
 * names are built from short hashes of lab/link/node/port ids, never raw
 * UUIDs.
 */
function shortHash(input: string, length = 8): string {
  return createHash("sha1").update(input).digest("hex").slice(0, length);
}

export function bridgeName(linkId: string): string {
  return `br-${shortHash(linkId)}`; // 11 chars
}

export function vethHostName(linkId: string, side: "a" | "b"): string {
  return `ve-${shortHash(linkId + side)}h`; // 12 chars
}

export function vethNsName(linkId: string, side: "a" | "b"): string {
  return `ve-${shortHash(linkId + side)}n`; // 12 chars
}

/**
 * One tap per QEMU NIC, created once at VM start (QEMU NICs must be defined
 * at launch, before the engine knows which links use which ports) and keyed
 * by (nodeId, portId) rather than linkId — a port's tap exists whether or
 * not it ends up attached to a link's bridge.
 */
export function tapNameForPort(nodeId: string, portId: string): string {
  return `tap-${shortHash(nodeId + portId)}`; // 12 chars
}

/** Deterministic, locally-administered MAC (QEMU's own 52:54:00 OUI prefix). */
export function deterministicMac(nodeId: string, portId: string): string {
  const hash = shortHash(nodeId + portId, 6);
  const bytes = hash.match(/.{2}/g) ?? [];
  return `52:54:00:${bytes.join(":")}`;
}
