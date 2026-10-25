import type { NodeTypeDef } from "@network-lab-studio/shared-types";

/**
 * Hardcoded starter catalog for the MVP device palette. "Generic QEMU image"
 * lets the user point at their own locally-supplied disk image; we never
 * bundle or fetch any vendor OS image ourselves.
 */
export const BUILTIN_NODE_TYPES: readonly NodeTypeDef[] = [
  {
    id: "builtin-alpine-docker",
    name: "Alpine (Docker)",
    portCount: 1,
    config: { kind: "docker", image: "alpine:3.20" },
  },
  {
    id: "builtin-frr-docker",
    name: "FRRouting (Docker)",
    portCount: 2,
    config: {
      kind: "docker",
      image: "frrouting/frr:latest",
      capAdd: ["NET_ADMIN", "NET_RAW"],
      privileged: false,
    },
  },
  {
    id: "builtin-generic-qemu",
    name: "Generic QEMU image",
    portCount: 1,
    config: {
      kind: "qemu",
      // Placeholder — user must point this at their own locally-supplied image
      // via the device-config form (added in a later phase); never auto-fetched.
      imagePath: "/images/REPLACE_ME.qcow2",
      cpu: 1,
      memoryMiB: 512,
      consoleType: "serial",
    },
  },
];
