import { z } from "zod";

/**
 * Core domain model for a Lab: a saved network topology plus everything
 * needed to bring it up (node types, nodes, links). One Lab = one JSON file.
 */

export const PortDefSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  index: z.number().int().nonnegative(),
});
export type PortDef = z.infer<typeof PortDefSchema>;

export const DockerNodeConfigSchema = z.object({
  kind: z.literal("docker"),
  image: z.string().min(1),
  command: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  privileged: z.boolean().optional(),
  capAdd: z.array(z.string()).optional(),
});
export type DockerNodeConfig = z.infer<typeof DockerNodeConfigSchema>;

export const QemuNodeConfigSchema = z.object({
  kind: z.literal("qemu"),
  imagePath: z.string().min(1),
  cpu: z.number().int().positive(),
  memoryMiB: z.number().int().positive(),
  biosOrUefi: z.enum(["bios", "uefi"]).optional(),
  extraArgs: z.array(z.string()).optional(),
  consoleType: z.enum(["serial", "vnc"]),
  bootOrder: z.string().optional(),
});
export type QemuNodeConfig = z.infer<typeof QemuNodeConfigSchema>;

export const NodeTypeDefSchema = z.object({
  // Not required to be a UUID: builtin catalog entries use stable readable slugs
  // (e.g. "builtin-alpine-docker"); user-created types use crypto.randomUUID().
  id: z.string().min(1),
  name: z.string().min(1),
  portCount: z.number().int().nonnegative(),
  config: z.discriminatedUnion("kind", [DockerNodeConfigSchema, QemuNodeConfigSchema]),
});
export type NodeTypeDef = z.infer<typeof NodeTypeDefSchema>;
export type NodeTypeKind = NodeTypeDef["config"]["kind"];

export const LabNodeSchema = z.object({
  id: z.string().uuid(),
  nodeTypeId: z.string().min(1), // references NodeTypeDef.id, which is not necessarily a UUID
  label: z.string().min(1),
  position: z.object({ x: z.number(), y: z.number() }),
  ports: z.array(PortDefSchema),
});
export type LabNode = z.infer<typeof LabNodeSchema>;

export const LinkEndpointSchema = z.object({
  nodeId: z.string().uuid(),
  portId: z.string().uuid(),
});
export type LinkEndpoint = z.infer<typeof LinkEndpointSchema>;

export const LabLinkSchema = z.object({
  id: z.string().uuid(),
  a: LinkEndpointSchema,
  b: LinkEndpointSchema,
  // Reserved for future link-impairment features; unused in MVP.
  lossPercent: z.number().min(0).max(100).optional(),
  delayMs: z.number().nonnegative().optional(),
});
export type LabLink = z.infer<typeof LabLinkSchema>;

export const LabSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  nodeTypes: z.array(NodeTypeDefSchema),
  nodes: z.array(LabNodeSchema),
  links: z.array(LabLinkSchema),
});
export type Lab = z.infer<typeof LabSchema>;

/** Creates a new, empty Lab with sensible defaults. */
export function createEmptyLab(params: { id: string; name: string; now?: string }): Lab {
  const now = params.now ?? new Date().toISOString();
  return {
    schemaVersion: 1,
    id: params.id,
    name: params.name,
    createdAt: now,
    updatedAt: now,
    nodeTypes: [],
    nodes: [],
    links: [],
  };
}

/** Parses and validates unknown input (e.g. from disk or an HTTP body) as a Lab. */
export function parseLab(data: unknown): Lab {
  return LabSchema.parse(data);
}
