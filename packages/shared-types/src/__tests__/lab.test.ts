import { describe, expect, it } from "vitest";
import { createEmptyLab, parseLab, type Lab } from "../lab.js";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

describe("Lab schema round-trip", () => {
  it("creates a valid empty lab and round-trips through JSON", () => {
    const lab = createEmptyLab({ id: NIL_UUID, name: "Test Lab" });
    const roundTripped = parseLab(JSON.parse(JSON.stringify(lab)));
    expect(roundTripped).toEqual(lab);
  });

  it("validates a lab with a docker node and a qemu node linked together", () => {
    const now = new Date().toISOString();
    const dockerTypeId = "11111111-1111-1111-1111-111111111111";
    const qemuTypeId = "22222222-2222-2222-2222-222222222222";
    const node1Id = "33333333-3333-3333-3333-333333333333";
    const node2Id = "44444444-4444-4444-4444-444444444444";
    const port1Id = "55555555-5555-5555-5555-555555555555";
    const port2Id = "66666666-6666-6666-6666-666666666666";

    const lab: Lab = {
      schemaVersion: 1,
      id: NIL_UUID,
      name: "Mixed lab",
      createdAt: now,
      updatedAt: now,
      nodeTypes: [
        {
          id: dockerTypeId,
          name: "Alpine",
          portCount: 1,
          config: { kind: "docker", image: "alpine:3.20" },
        },
        {
          id: qemuTypeId,
          name: "Generic QEMU image",
          portCount: 1,
          config: {
            kind: "qemu",
            imagePath: "/images/example.qcow2",
            cpu: 1,
            memoryMiB: 512,
            consoleType: "serial",
          },
        },
      ],
      nodes: [
        {
          id: node1Id,
          nodeTypeId: dockerTypeId,
          label: "R1",
          position: { x: 0, y: 0 },
          ports: [{ id: port1Id, label: "eth0", index: 0 }],
        },
        {
          id: node2Id,
          nodeTypeId: qemuTypeId,
          label: "R2",
          position: { x: 200, y: 0 },
          ports: [{ id: port2Id, label: "eth0", index: 0 }],
        },
      ],
      links: [
        {
          id: "77777777-7777-7777-7777-777777777777",
          a: { nodeId: node1Id, portId: port1Id },
          b: { nodeId: node2Id, portId: port2Id },
        },
      ],
    };

    expect(() => parseLab(lab)).not.toThrow();
  });

  it("rejects an invalid lab (bad discriminant)", () => {
    expect(() =>
      parseLab({
        schemaVersion: 1,
        id: NIL_UUID,
        name: "Bad",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodeTypes: [
          { id: NIL_UUID, name: "Bad", portCount: 1, config: { kind: "not-a-kind" } },
        ],
        nodes: [],
        links: [],
      }),
    ).toThrow();
  });
});
