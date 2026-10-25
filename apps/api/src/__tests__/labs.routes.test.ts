import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("Lab CRUD routes", () => {
  let app: FastifyInstance;
  let labsDir: string;

  beforeEach(async () => {
    labsDir = await mkdtemp(join(tmpdir(), "nls-labs-test-"));
    app = await buildApp(labsDir);
  });

  afterEach(async () => {
    await app.close();
    await rm(labsDir, { recursive: true, force: true });
  });

  it("health check responds ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("starts with an empty lab list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/labs" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("creates, lists, loads, updates and deletes a lab", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/labs",
      payload: { name: "My First Lab" },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.name).toBe("My First Lab");
    expect(created.nodes).toEqual([]);

    const listRes = await app.inject({ method: "GET", url: "/api/labs" });
    expect(listRes.json()).toEqual([
      { id: created.id, name: "My First Lab", updatedAt: created.updatedAt },
    ]);

    const getRes = await app.inject({ method: "GET", url: `/api/labs/${created.id}` });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toEqual(created);

    const updated = { ...created, name: "Renamed Lab" };
    const putRes = await app.inject({
      method: "PUT",
      url: `/api/labs/${created.id}`,
      payload: updated,
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().name).toBe("Renamed Lab");
    expect(putRes.json().updatedAt).not.toBe(created.updatedAt);

    const deleteRes = await app.inject({ method: "DELETE", url: `/api/labs/${created.id}` });
    expect(deleteRes.statusCode).toBe(204);

    const getAfterDeleteRes = await app.inject({ method: "GET", url: `/api/labs/${created.id}` });
    expect(getAfterDeleteRes.statusCode).toBe(404);
  });

  it("404s for an unknown lab id", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/labs/00000000-0000-0000-0000-000000000000",
    });
    expect(res.statusCode).toBe(404);
  });

  it("400s on a malformed create body", async () => {
    const res = await app.inject({ method: "POST", url: "/api/labs", payload: { name: "" } });
    expect(res.statusCode).toBe(400);
  });

  it("400s when PUT body id does not match the URL param", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/labs",
      payload: { name: "A" },
    });
    const created = createRes.json();
    const res = await app.inject({
      method: "PUT",
      url: "/api/labs/11111111-1111-1111-1111-111111111111",
      payload: created,
    });
    expect(res.statusCode).toBe(400);
  });
});
