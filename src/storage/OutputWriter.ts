import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sha256Uri } from "../utils/hash.js";

export class OutputWriter {
  constructor(private readonly rootDir = "out") {}

  async writeJson(name: string, data: unknown): Promise<{ path: string; hash: string }> {
    const path = join(this.rootDir, name.endsWith(".json") ? name : `${name}.json`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    return {
      path,
      hash: sha256Uri(data),
    };
  }
}
