import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Lab, parseLab } from "@network-lab-studio/shared-types";

export interface LabSummary {
  id: string;
  name: string;
  updatedAt: string;
}

/** Filesystem-backed storage for Lab documents, one JSON file per lab. */
export class LabStore {
  constructor(private readonly labsDir: string) {}

  private pathFor(id: string): string {
    return join(this.labsDir, `${id}.json`);
  }

  async ensureReady(): Promise<void> {
    await mkdir(this.labsDir, { recursive: true });
  }

  async list(): Promise<LabSummary[]> {
    await this.ensureReady();
    const files = await readdir(this.labsDir);
    const summaries: LabSummary[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await readFile(join(this.labsDir, file), "utf-8");
      const lab = parseLab(JSON.parse(raw));
      summaries.push({ id: lab.id, name: lab.name, updatedAt: lab.updatedAt });
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Lab | undefined> {
    await this.ensureReady();
    try {
      const raw = await readFile(this.pathFor(id), "utf-8");
      return parseLab(JSON.parse(raw));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw err;
    }
  }

  async save(lab: Lab): Promise<void> {
    await this.ensureReady();
    await writeFile(this.pathFor(lab.id), JSON.stringify(lab, null, 2), "utf-8");
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureReady();
    try {
      await rm(this.pathFor(id));
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw err;
    }
  }
}
